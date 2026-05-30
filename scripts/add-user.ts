import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import { Pool } from 'pg';

const validRoles = ['pme', 'investor', 'operator'] as const;

type UserRole = (typeof validRoles)[number];

export interface AddUserArguments {
  email: string;
  role: UserRole;
}

export function parseAddUserArguments(args: string[]): AddUserArguments {
  const email = args[0]?.trim().toLowerCase();
  const role = (args[1]?.trim() || 'pme') as UserRole;

  if (!email) {
    throw new Error(
      'Uso: npm run add:user -- email@dominio.com [pme|investor|operator]',
    );
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('E-mail invalido. Informe um e-mail no formato correto.');
  }

  if (!validRoles.includes(role)) {
    throw new Error(
      `Role invalida. Use uma destas: ${validRoles.join(', ')}.`,
    );
  }

  return { email, role };
}

async function main() {
  const { email, role } = parseAddUserArguments(process.argv.slice(2));

  dotenv.config();

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL nao configurada no ambiente.');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        role,
        provider: 'privy',
      },
      create: {
        email,
        role,
        provider: 'privy',
      },
      select: {
        id: true,
        email: true,
        role: true,
        provider: true,
        privyUserId: true,
      },
    });

    console.log('Usuario liberado para login Privy:');
    console.log(JSON.stringify(user, null, 2));
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
