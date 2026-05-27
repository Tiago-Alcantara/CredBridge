import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Fictional Brazilian SME — Tecelagem Ribeiro Indústria Ltda.
// Sacados (debtors) are large Brazilian retailers (publicly known CNPJs)

const SACADOS = [
  { name: 'Magazine Luiza S.A.',    doc: '47.960.950/0001-21' },
  { name: 'Via Varejo S.A.',        doc: '33.041.260/0065-28' },
  { name: 'Americanas S.A.',        doc: '00.776.574/0006-60' },
  { name: 'Lojas Renner S.A.',      doc: '92.754.738/0001-62' },
  { name: 'C&A Modas Ltda.',        doc: '45.242.914/0001-05' },
  { name: 'Riachuelo S.A.',         doc: '33.200.056/0001-06' },
  { name: 'Grupo Mateus Comércio',  doc: '01.797.675/0001-02' },
];

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function fakeTxHash(): string {
  return (
    'G' +
    Array.from({ length: 55 }, () =>
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.charAt(Math.floor(Math.random() * 32)),
    ).join('')
  );
}

function fakeDocHash(): string {
  return Array.from({ length: 64 }, () =>
    '0123456789abcdef'.charAt(Math.floor(Math.random() * 16)),
  ).join('');
}

async function main() {
  console.log('🌱  Seeding CredBridge...');

  // ─── Users ───────────────────────────────────────────────────────────────
  const hash = await bcrypt.hash('demo@1234', 10);

  const pme = await prisma.user.upsert({
    where: { email: 'victorbcbrbc@gmail.com' },
    update: { role: 'pme' },
    create: {
      email: 'victorbcbrbc@gmail.com',
      passwordHash: hash,
      role: 'pme',
    },
  });

  await prisma.user.upsert({
    where: { email: 'victorh.barros011@gmail.com' },
    update: { role: 'investor' },
    create: {
      email: 'victorh.barros011@gmail.com',
      passwordHash: hash,
      role: 'investor',
    },
  });

  await prisma.user.upsert({
    where: { email: 'api@fintechpartner.io' },
    update: {},
    create: {
      email: 'api@fintechpartner.io',
      passwordHash: hash,
      role: 'partner',
    },
  });

  await prisma.user.upsert({
    where: { email: 'victorh.vbarros@gmail.com' },
    update: { role: 'operator' },
    create: {
      email: 'victorh.vbarros@gmail.com',
      passwordHash: hash,
      role: 'operator',
    },
  });

  console.log('✓  Users (senha: demo@1234)');

  // ─── Receivables ─────────────────────────────────────────────────────────
  const receivablesData = [
    // Liquidadas (settled)
    {
      userId: pme.id,
      value: 182_450,
      type: 'invoice',
      status: 'settled',
      debtorName: SACADOS[0].name,
      debtorDocument: SACADOS[0].doc,
      documentHash: fakeDocHash(),
      txHash: fakeTxHash(),
      dueDate: daysFromNow(-18),
    },
    {
      userId: pme.id,
      value: 58_120,
      type: 'invoice',
      status: 'settled',
      debtorName: SACADOS[3].name,
      debtorDocument: SACADOS[3].doc,
      documentHash: fakeDocHash(),
      txHash: fakeTxHash(),
      dueDate: daysFromNow(-5),
    },
    {
      userId: pme.id,
      value: 132_990,
      type: 'invoice',
      status: 'settled',
      debtorName: SACADOS[4].name,
      debtorDocument: SACADOS[4].doc,
      documentHash: fakeDocHash(),
      txHash: fakeTxHash(),
      dueDate: daysFromNow(-15),
    },
    // Em andamento (active)
    {
      userId: pme.id,
      value: 94_200,
      type: 'invoice',
      status: 'active',
      debtorName: SACADOS[1].name,
      debtorDocument: SACADOS[1].doc,
      documentHash: fakeDocHash(),
      txHash: fakeTxHash(),
      dueDate: daysFromNow(30),
    },
    {
      userId: pme.id,
      value: 215_800,
      type: 'invoice',
      status: 'active',
      debtorName: SACADOS[5].name,
      debtorDocument: SACADOS[5].doc,
      documentHash: fakeDocHash(),
      txHash: fakeTxHash(),
      dueDate: daysFromNow(45),
    },
    // Aguardando validação (pending)
    {
      userId: pme.id,
      value: 246_800,
      type: 'invoice',
      status: 'pending',
      debtorName: SACADOS[2].name,
      debtorDocument: SACADOS[2].doc,
      dueDate: daysFromNow(48),
    },
    {
      userId: pme.id,
      value: 87_340,
      type: 'invoice',
      status: 'pending',
      debtorName: SACADOS[6].name,
      debtorDocument: SACADOS[6].doc,
      dueDate: daysFromNow(60),
    },
    // Validada aguardando proposta (validated)
    {
      userId: pme.id,
      value: 163_500,
      type: 'invoice',
      status: 'validated',
      debtorName: SACADOS[1].name,
      debtorDocument: SACADOS[1].doc,
      documentHash: fakeDocHash(),
      dueDate: daysFromNow(35),
    },
    // Inadimplente (defaulted)
    {
      userId: pme.id,
      value: 71_450,
      type: 'invoice',
      status: 'defaulted',
      debtorName: 'Pernambucanas Comércio Ltda.',
      debtorDocument: '61.189.288/0001-89',
      documentHash: fakeDocHash(),
      dueDate: daysFromNow(-6),
    },
  ];

  const receivables = await Promise.all(
    receivablesData.map((r) => prisma.receivable.create({ data: r })),
  );

  console.log(`✓  ${receivables.length} recebíveis`);

  // ─── Documents ───────────────────────────────────────────────────────────
  const docsToCreate = receivables
    .filter((r) => r.documentHash)
    .map((r) => ({
      receivableId: r.id,
      type: 'invoice',
      url: `stub://nfe-${r.id.slice(0, 8)}.xml`,
      hash: r.documentHash!,
    }));

  await prisma.document.createMany({ data: docsToCreate });
  console.log(`✓  ${docsToCreate.length} documentos`);

  // ─── Settlements ─────────────────────────────────────────────────────────
  const settledReceivables = receivables.filter((r) => r.status === 'settled');
  await Promise.all(
    settledReceivables.map((r) =>
      prisma.settlement.create({
        data: {
          receivableId: r.id,
          amount: r.value * 0.97,           // 3% deságio médio
          method: 'pix',
          status: 'settled',
          txHash: r.txHash ?? undefined,
          stellarTxHash: fakeTxHash(),
          settledAt: daysFromNow(-2),
        },
      }),
    ),
  );
  console.log(`✓  ${settledReceivables.length} liquidações`);

  // ─── Audit log ───────────────────────────────────────────────────────────
  const auditEntries: {
    event: string;
    entityId: string;
    entityType: string;
    userId: string;
    txHash?: string;
    metadata?: object;
  }[] = [];

  for (const r of receivables) {
    auditEntries.push({
      event: 'receivable.created',
      entityId: r.id,
      entityType: 'receivable',
      userId: pme.id,
      metadata: { value: r.value, debtorName: r.debtorName },
    });

    if (r.status === 'validated' || r.status === 'active' || r.status === 'settled') {
      auditEntries.push({
        event: 'receivable.validated',
        entityId: r.id,
        entityType: 'receivable',
        userId: pme.id,
        metadata: { sefazCode: 'OK' },
      });
    }

    if (r.status === 'active' || r.status === 'settled') {
      auditEntries.push({
        event: 'receivable.funded',
        entityId: r.id,
        entityType: 'receivable',
        userId: pme.id,
        txHash: r.txHash ?? undefined,
        metadata: { discount: 0.03 },
      });
    }

    if (r.status === 'settled') {
      auditEntries.push({
        event: 'receivable.settled',
        entityId: r.id,
        entityType: 'receivable',
        userId: pme.id,
        txHash: r.txHash ?? undefined,
        metadata: { method: 'pix', amount: r.value * 0.97 },
      });
    }
  }

  await prisma.auditLog.createMany({ data: auditEntries });
  console.log(`✓  ${auditEntries.length} entradas de auditoria`);

  console.log('\n✅  Seed concluído!');
  console.log('   PME login: victorbcbrbc@gmail.com / demo@1234');
  console.log('   Investor:  victorh.barros011@gmail.com / demo@1234');
  console.log('   Partner:   api@fintechpartner.io / demo@1234');
  console.log('   Operator:  victorh.vbarros@gmail.com / demo@1234');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
