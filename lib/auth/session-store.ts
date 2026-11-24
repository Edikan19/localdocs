import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../prisma";
import { SESSION_MAX_AGE_SECONDS } from "./cookies";

/** Only a hash of the token is stored, so a leaked database can't be used to log in. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  await prisma.session.create({
    data: { tokenHash: hashToken(token), userId, expiresAt },
  });

  return { token, expiresAt };
}

export async function getUserBySessionToken(token: string | null | undefined) {
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      expiresAt: true,
      user: { select: { id: true, email: true, name: true } },
    },
  });
  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  return session.user;
}

export async function deleteSession(token: string) {
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}