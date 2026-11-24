import { prisma } from "../prisma";
import type { DocumentRole } from "./roles";

/** The user's role on a document, or null if they have no access or it doesn't exist. */
export async function getDocumentRole(
  userId: string,
  documentId: string,
): Promise<DocumentRole | null> {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      ownerId: true,
      members: { where: { userId }, select: { role: true } },
    },
  });
  if (!document) return null;
  if (document.ownerId === userId) return "owner";

  const role = document.members[0]?.role;
  return role === "editor" || role === "viewer" ? role : null;
}