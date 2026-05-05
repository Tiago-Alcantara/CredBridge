# Account Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/pme/configuracoes` and `/investor/configuracoes` pages backed by real `GET/PATCH /v1/auth/me` endpoints, replacing the hardcoded user data.

**Architecture:** Single shared `AccountSettings` component reads `getTokenRole()` from the JWT to conditionally show PME or Investor fields. Three backend endpoints (GET/PATCH profile + PATCH password) protected by `JwtAuthGuard`. All new `User` fields are nullable so existing seed data requires no changes.

**Tech Stack:** NestJS (class-validator DTOs, bcrypt, Prisma), React (useState, TanStack Query), existing `useToast`, `Skeleton`, `apiFetch` primitives.

---

## File Map

**Create:**
- `apps/api/src/modules/auth/dto/update-profile.dto.ts`
- `apps/api/src/modules/auth/dto/change-password.dto.ts`
- `apps/api/src/modules/auth/auth.service.spec.ts`
- `apps/web/src/lib/api/me.ts`
- `apps/web/src/components/settings/AccountSettings.tsx`
- `apps/web/src/app/(pme)/pme/configuracoes/page.tsx`
- `apps/web/src/app/(investor)/investor/configuracoes/page.tsx`

**Modify:**
- `apps/api/prisma/schema.prisma`
- `apps/api/src/modules/auth/auth.service.ts`
- `apps/api/src/modules/auth/auth.controller.ts`

---

## Task 1: Prisma Schema Migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Update User model**

Replace the existing `User` model in `apps/api/prisma/schema.prisma`:

```prisma
model User {
  id               String   @id @default(uuid())
  email            String   @unique
  passwordHash     String
  role             String   @default("pme")
  name             String?
  phone            String?
  address          String?
  companyName      String?
  cnpj             String?
  monthlyRevenue   Float?
  sector           String?
  investorType     String?
  riskProfile      String?
  operationalLimit Float?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}
```

- [ ] **Step 2: Ensure Docker Postgres is running**

```bash
docker-compose up -d
```

Expected: container `credbridge_postgres` (or similar) shows `Up`.

- [ ] **Step 3: Run migration**

```bash
cd apps/api && npx prisma migrate dev --name add_user_profile_fields
```

Expected output includes: `The following migration(s) have been applied` and `Your database is now in sync`.

- [ ] **Step 4: Verify generated client**

```bash
cd apps/api && npx prisma generate
```

Expected: `Generated Prisma Client`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat(db): add nullable profile fields to User"
```

---

## Task 2: Backend DTOs

**Files:**
- Create: `apps/api/src/modules/auth/dto/update-profile.dto.ts`
- Create: `apps/api/src/modules/auth/dto/change-password.dto.ts`

- [ ] **Step 1: Create UpdateProfileDto**

Create `apps/api/src/modules/auth/dto/update-profile.dto.ts`:

```typescript
import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

const SECTORS = ['tecnologia', 'varejo', 'industria', 'servicos', 'agronegocio', 'saude', 'construcao', 'transporte', 'educacao', 'financeiro'] as const;
const INVESTOR_TYPES = ['pf', 'pj'] as const;
const RISK_PROFILES = ['conservador', 'moderado', 'arrojado'] as const;

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  cnpj?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyRevenue?: number;

  @IsOptional()
  @IsIn(SECTORS)
  sector?: string;

  @IsOptional()
  @IsIn(INVESTOR_TYPES)
  investorType?: string;

  @IsOptional()
  @IsIn(RISK_PROFILES)
  riskProfile?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  operationalLimit?: number;
}
```

- [ ] **Step 2: Create ChangePasswordDto**

Create `apps/api/src/modules/auth/dto/change-password.dto.ts`:

```typescript
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/auth/dto/
git commit -m "feat(auth): add UpdateProfileDto and ChangePasswordDto"
```

---

## Task 3: AuthService — New Methods (TDD)

**Files:**
- Create: `apps/api/src/modules/auth/auth.service.spec.ts`
- Modify: `apps/api/src/modules/auth/auth.service.ts`

- [ ] **Step 1: Write failing unit tests**

Create `apps/api/src/modules/auth/auth.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../../shared/prisma/prisma.service';

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  passwordHash: '',
  role: 'pme',
  name: 'Test User',
  phone: null,
  address: null,
  companyName: null,
  cnpj: null,
  monthlyRevenue: null,
  sector: null,
  investorType: null,
  riskProfile: null,
  operationalLimit: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const prismaMock = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: { signAsync: jest.fn().mockResolvedValue('token') } },
      ],
    }).compile();
    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('findMe', () => {
    it('returns user without passwordHash', async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      const result = await service.findMe('user-1');
      expect(result).not.toHaveProperty('passwordHash');
      expect(result.email).toBe('test@example.com');
    });

    it('throws UnauthorizedException when user not found', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      await expect(service.findMe('bad-id')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('updateProfile', () => {
    it('updates and returns user without passwordHash', async () => {
      const updated = { ...mockUser, name: 'New Name' };
      prismaMock.user.update.mockResolvedValue(updated);
      const result = await service.updateProfile('user-1', { name: 'New Name' });
      expect(result.name).toBe('New Name');
      expect(result).not.toHaveProperty('passwordHash');
    });
  });

  describe('changePassword', () => {
    it('throws BadRequestException when current password is wrong', async () => {
      const hash = await bcrypt.hash('correct', 10);
      prismaMock.user.findUnique.mockResolvedValue({ ...mockUser, passwordHash: hash });
      await expect(
        service.changePassword('user-1', { currentPassword: 'wrong', newPassword: 'newpass123' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('updates password when current password is correct', async () => {
      const hash = await bcrypt.hash('correct', 10);
      prismaMock.user.findUnique.mockResolvedValue({ ...mockUser, passwordHash: hash });
      prismaMock.user.update.mockResolvedValue({ ...mockUser });
      const result = await service.changePassword('user-1', { currentPassword: 'correct', newPassword: 'newpass123' });
      expect(result).toEqual({ message: 'ok' });
    });
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd apps/api && npm test -- auth.service.spec.ts
```

Expected: `FAIL` — `findMe is not a function` (or similar).

- [ ] **Step 3: Add methods to AuthService**

Replace the entire imports block at the top of `apps/api/src/modules/auth/auth.service.ts`:

```typescript
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
```

Then add these three methods inside the `AuthService` class, after `verifyStellarChallenge` and before `private issueToken`:

```typescript
private readonly userSelect = {
  id: true,
  email: true,
  role: true,
  name: true,
  phone: true,
  address: true,
  companyName: true,
  cnpj: true,
  monthlyRevenue: true,
  sector: true,
  investorType: true,
  riskProfile: true,
  operationalLimit: true,
  createdAt: true,
  updatedAt: true,
} as const;

async findMe(userId: string) {
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
    select: this.userSelect,
  });
  if (!user) throw new UnauthorizedException();
  return user;
}

async updateProfile(userId: string, dto: UpdateProfileDto) {
  return this.prisma.user.update({
    where: { id: userId },
    data: dto,
    select: this.userSelect,
  });
}

async changePassword(userId: string, dto: ChangePasswordDto) {
  const user = await this.prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new UnauthorizedException();
  const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
  if (!ok) throw new BadRequestException('Senha atual incorreta');
  const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
  await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  return { message: 'ok' };
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd apps/api && npm test -- auth.service.spec.ts
```

Expected: `PASS` — 5 tests passing.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/auth/auth.service.ts apps/api/src/modules/auth/auth.service.spec.ts
git commit -m "feat(auth): add findMe, updateProfile, changePassword to AuthService"
```

---

## Task 4: AuthController — New Endpoints

**Files:**
- Modify: `apps/api/src/modules/auth/auth.controller.ts`

- [ ] **Step 1: Update AuthController**

Replace `apps/api/src/modules/auth/auth.controller.ts` with:

```typescript
import { Controller, Post, Get, Patch, Body, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

interface AuthRequest {
  user: { userId: string; email: string; role: string };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @Post('login')
  login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: AuthRequest) {
    return this.authService.findMe(req.user.userId);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMe(@Req() req: AuthRequest, @Body() body: UpdateProfileDto) {
    return this.authService.updateProfile(req.user.userId, body);
  }

  @Patch('me/password')
  @UseGuards(JwtAuthGuard)
  changePassword(@Req() req: AuthRequest, @Body() body: ChangePasswordDto) {
    return this.authService.changePassword(req.user.userId, body);
  }

  @Post('stellar/challenge')
  getStellarChallenge(@Body() body: { stellarAddress: string }) {
    return this.authService.getStellarChallenge(body.stellarAddress);
  }

  @Post('stellar/verify')
  verifyStellarChallenge(@Body() body: { signedTransaction: string }) {
    return this.authService.verifyStellarChallenge(body.signedTransaction);
  }
}
```

- [ ] **Step 2: Build API to verify no TypeScript errors**

```bash
cd apps/api && npm run build 2>&1 | tail -20
```

Expected: no errors. If there are errors, fix them before continuing.

- [ ] **Step 3: Manual smoke test (optional but recommended)**

With API running (`npm run dev:api` from root):

```bash
# Login to get a token
TOKEN=$(curl -s -X POST http://localhost:3001/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"pme@example.com","password":"senha123"}' | jq -r .accessToken)

# Test GET /me
curl -s http://localhost:3001/v1/auth/me \
  -H "Authorization: Bearer $TOKEN" | jq .
```

Expected: JSON with user fields, no `passwordHash`.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/auth/auth.controller.ts
git commit -m "feat(auth): add GET/PATCH /me and PATCH /me/password endpoints"
```

---

## Task 5: Frontend Hooks (`me.ts`)

**Files:**
- Create: `apps/web/src/lib/api/me.ts`

- [ ] **Step 1: Create me.ts**

Create `apps/web/src/lib/api/me.ts`:

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";

export interface MeResponse {
  id: string;
  email: string;
  role: string;
  name: string | null;
  phone: string | null;
  address: string | null;
  companyName: string | null;
  cnpj: string | null;
  monthlyRevenue: number | null;
  sector: string | null;
  investorType: string | null;
  riskProfile: string | null;
  operationalLimit: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileInput {
  name?: string;
  phone?: string;
  address?: string;
  companyName?: string;
  cnpj?: string;
  monthlyRevenue?: number;
  sector?: string;
  investorType?: string;
  riskProfile?: string;
  operationalLimit?: number;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export function useMe() {
  return useQuery<MeResponse>({
    queryKey: ["me"],
    queryFn: () => apiFetch<MeResponse>("/auth/me"),
  });
}

export function useUpdateMe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProfileInput) =>
      apiFetch<MeResponse>("/auth/me", { method: "PATCH", body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

export function useUpdatePassword() {
  return useMutation({
    mutationFn: (input: ChangePasswordInput) =>
      apiFetch<{ message: string }>("/auth/me/password", {
        method: "PATCH",
        body: input,
      }),
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors related to `me.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/api/me.ts
git commit -m "feat(web): add useMe, useUpdateMe, useUpdatePassword hooks"
```

---

## Task 6: AccountSettings Component

**Files:**
- Create: `apps/web/src/components/settings/AccountSettings.tsx`

- [ ] **Step 1: Create the component**

Create `apps/web/src/components/settings/AccountSettings.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { useMe, useUpdateMe, useUpdatePassword } from "@/lib/api/me";
import type { UpdateProfileInput } from "@/lib/api/me";
import { getTokenRole } from "@/lib/api/auth-storage";
import { extractApiErrorMessage } from "@/lib/api/client";
import { useToast } from "@/providers/ToastProvider";
import { Skeleton } from "@/components/primitives/Skeleton";

function formatCnpj(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

const SECTORS = [
  { value: "tecnologia", label: "Tecnologia" },
  { value: "varejo", label: "Varejo" },
  { value: "industria", label: "Indústria" },
  { value: "servicos", label: "Serviços" },
  { value: "agronegocio", label: "Agronegócio" },
  { value: "saude", label: "Saúde" },
  { value: "construcao", label: "Construção" },
  { value: "transporte", label: "Transporte" },
  { value: "educacao", label: "Educação" },
  { value: "financeiro", label: "Financeiro" },
];

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid var(--line)",
  background: "var(--bg-2)",
  color: "var(--fg)",
  font: "inherit",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};

const disabledInputStyle: React.CSSProperties = {
  ...inputStyle,
  opacity: 0.5,
  cursor: "not-allowed",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "var(--fg-2)",
  marginBottom: 6,
  fontFamily: "var(--sans)",
  fontWeight: 500,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const fieldStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 0,
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 16,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  marginBottom: 20,
  paddingBottom: 12,
  borderBottom: "1px solid var(--line)",
};

export function AccountSettings() {
  const { data: me, isLoading } = useMe();
  const updateMe = useUpdateMe();
  const updatePassword = useUpdatePassword();
  const { showToast } = useToast();
  const role = getTokenRole();

  // Profile section state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  // PME section state
  const [companyName, setCompanyName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [monthlyRevenue, setMonthlyRevenue] = useState("");
  const [sector, setSector] = useState("");

  // Investor section state
  const [investorType, setInvestorType] = useState("");
  const [riskProfile, setRiskProfile] = useState("");
  const [operationalLimit, setOperationalLimit] = useState("");

  // Password section state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Populate form from API data
  useEffect(() => {
    if (!me) return;
    setName(me.name ?? "");
    setPhone(me.phone ?? "");
    setAddress(me.address ?? "");
    setCompanyName(me.companyName ?? "");
    setCnpj(me.cnpj ?? "");
    setMonthlyRevenue(me.monthlyRevenue != null ? String(me.monthlyRevenue) : "");
    setSector(me.sector ?? "");
    setInvestorType(me.investorType ?? "");
    setRiskProfile(me.riskProfile ?? "");
    setOperationalLimit(me.operationalLimit != null ? String(me.operationalLimit) : "");
  }, [me]);

  function buildProfilePayload(): UpdateProfileInput {
    const payload: UpdateProfileInput = {};
    if (name.trim()) payload.name = name.trim();
    if (phone.trim()) payload.phone = phone.trim();
    if (address.trim()) payload.address = address.trim();
    return payload;
  }

  function buildPmePayload(): UpdateProfileInput {
    const payload: UpdateProfileInput = {};
    if (companyName.trim()) payload.companyName = companyName.trim();
    if (cnpj.trim()) payload.cnpj = cnpj.trim();
    if (monthlyRevenue) payload.monthlyRevenue = parseFloat(monthlyRevenue);
    if (sector) payload.sector = sector;
    return payload;
  }

  function buildInvestorPayload(): UpdateProfileInput {
    const payload: UpdateProfileInput = {};
    if (investorType) payload.investorType = investorType;
    if (riskProfile) payload.riskProfile = riskProfile;
    if (operationalLimit) payload.operationalLimit = parseFloat(operationalLimit);
    return payload;
  }

  function handleSaveProfile() {
    updateMe.mutate(buildProfilePayload(), {
      onSuccess: () => showToast("Perfil salvo", "success"),
      onError: (err) => showToast(extractApiErrorMessage(err), "error"),
    });
  }

  function handleSavePme() {
    updateMe.mutate(buildPmePayload(), {
      onSuccess: () => showToast("Dados da empresa salvos", "success"),
      onError: (err) => showToast(extractApiErrorMessage(err), "error"),
    });
  }

  function handleSaveInvestor() {
    updateMe.mutate(buildInvestorPayload(), {
      onSuccess: () => showToast("Perfil de investidor salvo", "success"),
      onError: (err) => showToast(extractApiErrorMessage(err), "error"),
    });
  }

  function handleChangePassword() {
    setPasswordError(null);
    if (newPassword.length < 8) {
      setPasswordError("Nova senha deve ter ao menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("As senhas não coincidem.");
      return;
    }
    updatePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          showToast("Senha atualizada", "success");
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
        },
        onError: (err) => {
          const msg = extractApiErrorMessage(err);
          setPasswordError(msg);
        },
      },
    );
  }

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="card" style={{ padding: 32 }}>
            <Skeleton height={20} width={160} style={{ marginBottom: 24 }} />
            <div style={gridStyle}>
              {[0, 1, 2, 3].map((j) => (
                <div key={j}>
                  <Skeleton height={12} width={80} style={{ marginBottom: 8 }} />
                  <Skeleton height={40} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 800 }}>
      <h2 style={{ fontSize: 28, marginBottom: 4 }}>Configurações</h2>
      <p className="t-2" style={{ fontSize: 13, marginTop: 0 }}>Gerencie suas informações de conta.</p>

      {/* Perfil */}
      <div className="card" style={{ padding: 32 }}>
        <p style={sectionTitleStyle}>Perfil</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={gridStyle}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Nome</label>
              <input
                style={inputStyle}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome completo"
              />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Email</label>
              <input style={disabledInputStyle} value={me?.email ?? ""} disabled />
            </div>
          </div>
          <div style={gridStyle}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Telefone</label>
              <input
                style={inputStyle}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 99999-9999"
              />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Endereço</label>
              <input
                style={inputStyle}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Rua, número, cidade"
              />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              className="btn btn-primary"
              onClick={handleSaveProfile}
              disabled={updateMe.isPending}
            >
              {updateMe.isPending ? "Salvando…" : "Salvar perfil"}
            </button>
          </div>
        </div>
      </div>

      {/* PME — Empresa */}
      {role === "pme" && (
        <div className="card" style={{ padding: 32 }}>
          <p style={sectionTitleStyle}>Empresa</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={gridStyle}>
              <div style={fieldStyle}>
                <label style={labelStyle}>Razão Social</label>
                <input
                  style={inputStyle}
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Nome da empresa"
                />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>CNPJ</label>
                <input
                  style={inputStyle}
                  value={cnpj}
                  onChange={(e) => setCnpj(formatCnpj(e.target.value))}
                  placeholder="00.000.000/0001-00"
                />
              </div>
            </div>
            <div style={gridStyle}>
              <div style={fieldStyle}>
                <label style={labelStyle}>Faturamento Mensal (R$)</label>
                <input
                  style={inputStyle}
                  type="number"
                  min="0"
                  value={monthlyRevenue}
                  onChange={(e) => setMonthlyRevenue(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Setor</label>
                <select
                  style={inputStyle}
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                >
                  <option value="">Selecione…</option>
                  {SECTORS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                className="btn btn-primary"
                onClick={handleSavePme}
                disabled={updateMe.isPending}
              >
                {updateMe.isPending ? "Salvando…" : "Salvar empresa"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Investor */}
      {role === "investor" && (
        <div className="card" style={{ padding: 32 }}>
          <p style={sectionTitleStyle}>Perfil de Investidor</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={gridStyle}>
              <div style={fieldStyle}>
                <label style={labelStyle}>Tipo</label>
                <select
                  style={inputStyle}
                  value={investorType}
                  onChange={(e) => setInvestorType(e.target.value)}
                >
                  <option value="">Selecione…</option>
                  <option value="pf">Pessoa Física</option>
                  <option value="pj">Pessoa Jurídica</option>
                </select>
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Perfil de Risco</label>
                <select
                  style={inputStyle}
                  value={riskProfile}
                  onChange={(e) => setRiskProfile(e.target.value)}
                >
                  <option value="">Selecione…</option>
                  <option value="conservador">Conservador</option>
                  <option value="moderado">Moderado</option>
                  <option value="arrojado">Arrojado</option>
                </select>
              </div>
            </div>
            <div style={{ maxWidth: "calc(50% - 8px)" }}>
              <div style={fieldStyle}>
                <label style={labelStyle}>Limite Operacional (R$)</label>
                <input
                  style={inputStyle}
                  type="number"
                  min="0"
                  value={operationalLimit}
                  onChange={(e) => setOperationalLimit(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                className="btn btn-primary"
                onClick={handleSaveInvestor}
                disabled={updateMe.isPending}
              >
                {updateMe.isPending ? "Salvando…" : "Salvar perfil"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Segurança */}
      <div className="card" style={{ padding: 32 }}>
        <p style={sectionTitleStyle}>Segurança</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ maxWidth: "calc(50% - 8px)" }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Senha Atual</label>
              <input
                style={inputStyle}
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>
          <div style={gridStyle}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Nova Senha</label>
              <input
                style={inputStyle}
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
              />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Confirmar Nova Senha</label>
              <input
                style={inputStyle}
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>
          {passwordError && (
            <p style={{ color: "var(--red)", fontSize: 13, margin: 0 }}>{passwordError}</p>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              className="btn btn-primary"
              onClick={handleChangePassword}
              disabled={updatePassword.isPending}
            >
              {updatePassword.isPending ? "Alterando…" : "Alterar senha"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/settings/AccountSettings.tsx
git commit -m "feat(web): add AccountSettings component with profile/password sections"
```

---

## Task 7: Route Pages + Verification

**Files:**
- Create: `apps/web/src/app/(pme)/pme/configuracoes/page.tsx`
- Create: `apps/web/src/app/(investor)/investor/configuracoes/page.tsx`

- [ ] **Step 1: Create PME page**

Create `apps/web/src/app/(pme)/pme/configuracoes/page.tsx`:

```tsx
import { AccountSettings } from "@/components/settings/AccountSettings";

export default function PmeConfiguracoesPage() {
  return <AccountSettings />;
}
```

- [ ] **Step 2: Create Investor page**

Create `apps/web/src/app/(investor)/investor/configuracoes/page.tsx`:

```tsx
import { AccountSettings } from "@/components/settings/AccountSettings";

export default function InvestorConfiguracoesPage() {
  return <AccountSettings />;
}
```

- [ ] **Step 3: Start dev server and verify**

```bash
npm run dev:web
```

Navigate to `http://localhost:3000/pme/configuracoes` (must be logged in as PME user).

Verify:
- Page loads without errors
- Skeleton shows while `useMe` loads
- Perfil, Empresa, and Segurança sections visible (Investidor section hidden)
- Email field is disabled/read-only
- "Salvar perfil" button triggers PATCH `/v1/auth/me` and shows success toast
- Navigate to `/investor/configuracoes` as investor — Empresa hidden, Investidor visible

- [ ] **Step 4: Test password change**

With dev server running:
- Enter wrong current password → verify "Senha atual incorreta" error shows inline (not a logout)
- Enter correct current password + matching new passwords → verify toast "Senha atualizada" + fields clear

- [ ] **Step 5: Final commit**

```bash
git add apps/web/src/app/\(pme\)/pme/configuracoes/ apps/web/src/app/\(investor\)/investor/configuracoes/
git commit -m "feat(web): add /pme/configuracoes and /investor/configuracoes pages"
```
