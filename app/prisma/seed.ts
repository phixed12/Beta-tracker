import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/beta_tracker";
const adapter = url.startsWith("prisma+postgres://")
  ? undefined
  : new PrismaPg({ connectionString: url });

const prisma = adapter
  ? new PrismaClient({ adapter })
  : new PrismaClient({ accelerateUrl: url } as ConstructorParameters<typeof PrismaClient>[0]);

async function main() {
  console.log("Seeding database…");

  // ── Users ────────────────────────────────────────────────────────────────
  const alice = await prisma.user.upsert({
    where: { email: "alice@example.com" },
    update: {},
    create: { name: "Alice Park", email: "alice@example.com", role: "pm" },
  });
  const bob = await prisma.user.upsert({
    where: { email: "bob@example.com" },
    update: {},
    create: { name: "Bob Tran", email: "bob@example.com", role: "pmm" },
  });
  const carol = await prisma.user.upsert({
    where: { email: "carol@example.com" },
    update: {},
    create: { name: "Carol Singh", email: "carol@example.com", role: "csm" },
  });
  const dave = await prisma.user.upsert({
    where: { email: "dave@example.com" },
    update: {},
    create: { name: "Dave Okonkwo", email: "dave@example.com", role: "coordinator" },
  });
  const eve = await prisma.user.upsert({
    where: { email: "eve@example.com" },
    update: {},
    create: { name: "Eve Larsson", email: "eve@example.com", role: "admin" },
  });

  console.log("  ✓ Users");

  // ── Clients ──────────────────────────────────────────────────────────────
  const clientData = [
    { name: "Acme Corp",       tier: 1,  accountHealth: "green"  as const, csmOwnerId: carol.id },
    { name: "Globex Inc",      tier: 2,  accountHealth: "green"  as const, csmOwnerId: carol.id },
    { name: "Initech Ltd",     tier: 3,  accountHealth: "yellow" as const, csmOwnerId: carol.id },
    { name: "Umbrella Co",     tier: 4,  accountHealth: "green"  as const, csmOwnerId: carol.id },
    { name: "Cyberdyne LLC",   tier: 5,  accountHealth: "red"    as const, csmOwnerId: carol.id },
    { name: "Oscorp Solutions", tier: 6, accountHealth: "green"  as const, csmOwnerId: carol.id },
    { name: "Wayne Enterprises", tier: 7, accountHealth: "green" as const, csmOwnerId: carol.id },
    { name: "Stark Industries", tier: 8, accountHealth: "yellow" as const, csmOwnerId: carol.id },
    { name: "LexCorp Systems",  tier: 9, accountHealth: "green"  as const, csmOwnerId: carol.id },
    { name: "Soylent Corp",    tier: 10, accountHealth: "green"  as const, csmOwnerId: carol.id },
  ];

  const clients = await Promise.all(
    clientData.map((c) =>
      prisma.client.upsert({
        where: { id: c.name }, // won't match; will always create
        update: {},
        create: c,
      }).catch(() =>
        prisma.client.findFirst({ where: { name: c.name } }).then((r) => r!)
      )
    )
  );

  console.log("  ✓ Clients");

  // ── Beta Features ─────────────────────────────────────────────────────────
  const today = new Date();
  const daysAgo = (n: number) => new Date(today.getTime() - n * 86400000);
  const daysFrom = (n: number) => new Date(today.getTime() + n * 86400000);

  const featureAlpha = await prisma.betaFeature.upsert({
    where: { id: "seed-feature-alpha" },
    update: {},
    create: {
      id: "seed-feature-alpha",
      name: "Project Alpha — AI Summarization",
      ownerPmId: alice.id,
      ownerPmmId: bob.id,
      targetTesterCount: 15,
      status: "recruiting",
      startDate: daysFrom(14),
      outreachDeadline: daysFrom(7),
      idealClientCriteria: "Mid-market SaaS teams using Docs heavily",
    },
  });

  const featureBeta = await prisma.betaFeature.upsert({
    where: { id: "seed-feature-beta" },
    update: {},
    create: {
      id: "seed-feature-beta",
      name: "Project Beta — Workflow Automation V2",
      ownerPmId: alice.id,
      ownerPmmId: bob.id,
      targetTesterCount: 15,
      status: "in_progress",
      startDate: daysAgo(10),
      outreachDeadline: daysAgo(3),
      idealClientCriteria: "Enterprise clients with 50+ seat licences",
    },
  });

  const featureGamma = await prisma.betaFeature.upsert({
    where: { id: "seed-feature-gamma" },
    update: {},
    create: {
      id: "seed-feature-gamma",
      name: "Project Gamma — SSO Connector",
      ownerPmId: alice.id,
      ownerPmmId: bob.id,
      targetTesterCount: 10,
      status: "closing",
      startDate: daysAgo(45),
      outreachDeadline: daysAgo(38),
      idealClientCriteria: "Clients with IT-managed identity providers",
    },
  });

  const featureDelta = await prisma.betaFeature.upsert({
    where: { id: "seed-feature-delta" },
    update: {},
    create: {
      id: "seed-feature-delta",
      name: "Project Delta — Advanced Analytics",
      ownerPmId: alice.id,
      ownerPmmId: bob.id,
      targetTesterCount: 15,
      status: "closed",
      startDate: daysAgo(90),
      closedAt: daysAgo(5),
      closeReason: "completed",
      outreachDeadline: daysAgo(80),
      idealClientCriteria: "Data-driven teams with BI backgrounds",
    },
  });

  console.log("  ✓ Beta features");

  // ── Enrollments for Project Alpha (recruiting) ────────────────────────────
  // 3 pending CSM approval, 2 approved
  const alphaEnrollments = [
    { clientIdx: 0, testerStatus: "csm_pending" as const, csmApprovalStatus: "pending" as const },
    { clientIdx: 1, testerStatus: "csm_pending" as const, csmApprovalStatus: "pending" as const },
    { clientIdx: 2, testerStatus: "csm_pending" as const, csmApprovalStatus: "pending" as const },
    { clientIdx: 3, testerStatus: "csm_approved" as const, csmApprovalStatus: "approved" as const, csmApprovedAt: daysAgo(1) },
    { clientIdx: 5, testerStatus: "csm_approved" as const, csmApprovalStatus: "approved" as const, csmApprovedAt: daysAgo(2) },
  ];

  for (const e of alphaEnrollments) {
    await prisma.betaEnrollment.upsert({
      where: { clientId_featureId: { clientId: clients[e.clientIdx].id, featureId: featureAlpha.id } },
      update: {},
      create: {
        clientId: clients[e.clientIdx].id,
        featureId: featureAlpha.id,
        assignedById: alice.id,
        testerStatus: e.testerStatus,
        csmApprovalStatus: e.csmApprovalStatus,
        ...(e.csmApprovedAt ? { csmApprovedById: carol.id, csmApprovedAt: e.csmApprovedAt } : {}),
      },
    });
  }

  // ── Enrollments for Project Beta (in_progress) ────────────────────────────
  // Mix of confirmed, active, completed, dropped
  const betaEnrollments = [
    { clientIdx: 0, testerStatus: "active"    as const, csmApprovalStatus: "approved" as const, confirmedAt: daysAgo(8) },
    { clientIdx: 1, testerStatus: "active"    as const, csmApprovalStatus: "approved" as const, confirmedAt: daysAgo(8) },
    { clientIdx: 3, testerStatus: "active"    as const, csmApprovalStatus: "approved" as const, confirmedAt: daysAgo(7) },
    { clientIdx: 5, testerStatus: "completed" as const, csmApprovalStatus: "approved" as const, confirmedAt: daysAgo(9), completedAt: daysAgo(1) },
    { clientIdx: 6, testerStatus: "completed" as const, csmApprovalStatus: "approved" as const, confirmedAt: daysAgo(9), completedAt: daysAgo(2) },
    { clientIdx: 7, testerStatus: "dropped"   as const, csmApprovalStatus: "approved" as const, confirmedAt: daysAgo(8), droppedAt: daysAgo(3), dropReason: "Client deprioritised internally" },
  ];

  for (const e of betaEnrollments) {
    await prisma.betaEnrollment.upsert({
      where: { clientId_featureId: { clientId: clients[e.clientIdx].id, featureId: featureBeta.id } },
      update: {},
      create: {
        clientId: clients[e.clientIdx].id,
        featureId: featureBeta.id,
        assignedById: alice.id,
        testerStatus: e.testerStatus,
        csmApprovalStatus: e.csmApprovalStatus,
        csmApprovedById: carol.id,
        csmApprovedAt: daysAgo(10),
        outreachSentAt: daysAgo(9),
        confirmedAt: "confirmedAt" in e ? e.confirmedAt : undefined,
        completedAt: "completedAt" in e ? e.completedAt : undefined,
        droppedAt: "droppedAt" in e ? e.droppedAt : undefined,
        dropReason: "dropReason" in e ? e.dropReason : undefined,
      },
    });
  }

  // ── Enrollments for Project Gamma (closing) ───────────────────────────────
  // 2 still active, 5 completed, 2 cancelled
  const gammaEnrollments = [
    { clientIdx: 0, testerStatus: "active"    as const, csmApprovalStatus: "approved" as const },
    { clientIdx: 1, testerStatus: "active"    as const, csmApprovalStatus: "approved" as const },
    { clientIdx: 3, testerStatus: "completed" as const, csmApprovalStatus: "approved" as const, completedAt: daysAgo(3) },
    { clientIdx: 5, testerStatus: "completed" as const, csmApprovalStatus: "approved" as const, completedAt: daysAgo(5) },
    { clientIdx: 6, testerStatus: "completed" as const, csmApprovalStatus: "approved" as const, completedAt: daysAgo(7) },
    { clientIdx: 7, testerStatus: "completed" as const, csmApprovalStatus: "approved" as const, completedAt: daysAgo(4) },
    { clientIdx: 8, testerStatus: "completed" as const, csmApprovalStatus: "approved" as const, completedAt: daysAgo(6) },
    { clientIdx: 2, testerStatus: "cancelled" as const, csmApprovalStatus: "pending" as const },
    { clientIdx: 9, testerStatus: "cancelled" as const, csmApprovalStatus: "pending" as const },
  ];

  for (const e of gammaEnrollments) {
    await prisma.betaEnrollment.upsert({
      where: { clientId_featureId: { clientId: clients[e.clientIdx].id, featureId: featureGamma.id } },
      update: {},
      create: {
        clientId: clients[e.clientIdx].id,
        featureId: featureGamma.id,
        assignedById: alice.id,
        testerStatus: e.testerStatus,
        csmApprovalStatus: e.csmApprovalStatus,
        ...(e.csmApprovalStatus === "approved" ? { csmApprovedById: carol.id, csmApprovedAt: daysAgo(40) } : {}),
        ...(e.testerStatus !== "cancelled" ? { outreachSentAt: daysAgo(38), confirmedAt: daysAgo(35) } : {}),
        ...("completedAt" in e ? { completedAt: e.completedAt } : {}),
      },
    });
  }

  // ── Enrollments for Project Delta (closed) ────────────────────────────────
  const deltaEnrollments = [0, 1, 3, 5, 6].map((idx) => ({
    clientIdx: idx,
    testerStatus: "completed" as const,
    completedAt: daysAgo(10 + idx * 3),
  }));
  const deltaDropped = [{ clientIdx: 7, dropReason: "Contract non-renewal" }];

  for (const e of deltaEnrollments) {
    await prisma.betaEnrollment.upsert({
      where: { clientId_featureId: { clientId: clients[e.clientIdx].id, featureId: featureDelta.id } },
      update: {},
      create: {
        clientId: clients[e.clientIdx].id,
        featureId: featureDelta.id,
        assignedById: alice.id,
        testerStatus: e.testerStatus,
        csmApprovalStatus: "approved",
        csmApprovedById: carol.id,
        csmApprovedAt: daysAgo(85),
        outreachSentAt: daysAgo(82),
        confirmedAt: daysAgo(80),
        completedAt: e.completedAt,
      },
    });
  }
  for (const e of deltaDropped) {
    await prisma.betaEnrollment.upsert({
      where: { clientId_featureId: { clientId: clients[e.clientIdx].id, featureId: featureDelta.id } },
      update: {},
      create: {
        clientId: clients[e.clientIdx].id,
        featureId: featureDelta.id,
        assignedById: alice.id,
        testerStatus: "dropped",
        csmApprovalStatus: "approved",
        csmApprovedById: carol.id,
        csmApprovedAt: daysAgo(85),
        outreachSentAt: daysAgo(82),
        confirmedAt: daysAgo(80),
        droppedAt: daysAgo(20),
        dropReason: e.dropReason,
      },
    });
  }

  console.log("  ✓ Enrollments");

  // ── Outreach batch for Alpha (approved enrollments not yet batched) ────────
  const approvedAlphaEnrollments = await prisma.betaEnrollment.findMany({
    where: { featureId: featureAlpha.id, csmApprovalStatus: "approved" },
  });

  if (approvedAlphaEnrollments.length > 0) {
    // Group by client — each client gets one batch
    const byClient = new Map<string, typeof approvedAlphaEnrollments>();
    for (const e of approvedAlphaEnrollments) {
      const list = byClient.get(e.clientId) ?? [];
      list.push(e);
      byClient.set(e.clientId, list);
    }

    for (const [clientId, enrollments] of byClient) {
      const batch = await prisma.outreachBatch.upsert({
        where: { id: `seed-batch-alpha-${clientId}` },
        update: {},
        create: {
          id: `seed-batch-alpha-${clientId}`,
          clientId,
          batchStatus: "ready",
        },
      });

      await prisma.outreachBatchEnrollment.createMany({
        data: enrollments.map((e) => ({ batchId: batch.id, enrollmentId: e.id })),
        skipDuplicates: true,
      });
    }
  }

  console.log("  ✓ Outreach batches");

  // ── Audit log entries ──────────────────────────────────────────────────────
  await prisma.auditLog.createMany({
    skipDuplicates: true,
    data: [
      {
        entityType: "BetaFeature",
        entityId: featureAlpha.id,
        action: "created",
        changedById: alice.id,
        nextState: { status: "draft" },
      },
      {
        entityType: "BetaFeature",
        entityId: featureAlpha.id,
        action: "status_change",
        changedById: alice.id,
        priorState: { status: "draft" },
        nextState: { status: "recruiting" },
      },
      {
        entityType: "BetaFeature",
        entityId: featureDelta.id,
        action: "closed",
        changedById: dave.id,
        priorState: { status: "in_progress" },
        nextState: { status: "closed", closeReason: "completed" },
      },
    ],
  });

  console.log("  ✓ Audit logs");
  console.log("\nSeed complete.");
  console.log(`  Users: alice (pm), bob (pmm), carol (csm), dave (coordinator), eve (admin)`);
  console.log(`  Features: Alpha (recruiting), Beta (in_progress), Gamma (closing), Delta (closed)`);
  console.log(`  Clients: 10 seeded, 1 red-health (Cyberdyne — blocked from nomination)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
