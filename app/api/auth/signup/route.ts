import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session-store";
import { setSessionCookie } from "@/lib/auth/current-user";
import { cleanName, normalizeEmail, passwordProblem } from "@/lib/auth/validation";
import { authLimiter, clientIp } from "@/lib/auth/rate-limit";

export async function POST(request: Request) {
  if (process.env.ALLOW_SIGNUP === "false") {
    return NextResponse.json({ error: "Sign-ups are closed." }, { status: 403 });
  }

  const limit = authLimiter(`signup:${clientIp(request)}`);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }
  const fields = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;

  const email = normalizeEmail(fields.email);
  const name = cleanName(fields.name);
  const problem = passwordProblem(fields.password);

  if (!email) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "Enter your name (1 to 60 characters)." }, { status: 400 });
  }
  if (problem) {
    return NextResponse.json({ error: problem }, { status: 400 });
  }

  const passwordHash = await hashPassword(fields.password as string);

  try {
    const user = await prisma.$transaction(async (tx) => {
      const isFirstUser = (await tx.user.count()) === 0;

      const created = await tx.user.create({
        data: { email, name, passwordHash },
        select: { id: true, email: true, name: true },
      });

      // The first account inherits documents created before accounts existed
      if (isFirstUser) {
        await tx.document.updateMany({
          where: { ownerId: null },
          data: { ownerId: created.id },
        });
      }
      return created;
    });

    const { token, expiresAt } = await createSession(user.id);
    await setSessionCookie(token, expiresAt);
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: "An account with that email already exists." },
        { status: 409 },
      );
    }
    console.error("Sign-up failed:", error);
    return NextResponse.json({ error: "Unable to create the account." }, { status: 500 });
  }
}