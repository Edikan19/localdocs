import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  const doc = await prisma.document.create({ data: {} });
  console.log(`Created document: ${doc.id}`);
  console.log(`Open: http://localhost:3000/documents/${doc.id}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());