import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const url = process.env.DATABASE_URL ?? "";
  // prisma+postgres:// URLs use Prisma Postgres (Accelerate); plain postgresql:// use pg adapter
  if (url.startsWith("prisma+postgres://")) {
    // When using Prisma Postgres local dev server or Prisma Accelerate, pass accelerateUrl
    return new PrismaClient({ accelerateUrl: url } as ConstructorParameters<typeof PrismaClient>[0]);
  }
  const adapter = new PrismaPg({ connectionString: url });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
