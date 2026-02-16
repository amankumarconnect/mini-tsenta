import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Use raw query to avoid schema mismatch issues if model definition changed
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "JobTextEmbedding" CASCADE;');
  console.log("Truncated JobTextEmbedding table");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
