import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session-store";
import { setSessionCookie } from "@/lib/auth/current-user";
import { normalizeEmail } from "@/lib/auth/validation";
import { authLimiter, clientIp } from "@/lib/auth/rate-limit";

const INVALID = { error: "Invalid email or password." };

export async function POST(request: Request) {
  const limit = authLimiter(`login:${clientIp(request)}`);
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
  const password = typeof fields.password === "string" ? fields.password.slice(0, 128) : "";
  if (!email || !password) {
    return NextResponse.json(INVALID, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Spend the same time as a real check so response time doesn't reveal which emails exist
      await hashPassword(password);
      return NextResponse.json(INVALID, { status: 401 });
    }

    if (!(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json(INVALID, { status: 401 });
    }

    const { token, expiresAt } = await createSession(user.id);
    await setSessionCookie(token, expiresAt);
    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (error) {
    console.error("Login failed:", error);
    return NextResponse.json({ error: "Unable to sign in." }, { status: 500 });
  }
}