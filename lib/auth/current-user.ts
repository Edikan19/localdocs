import { cookies } from "next/headers";
import { SESSION_COOKIE } from "./cookies";
import { getUserBySessionToken } from "./session-store";

// Secure cookies need HTTPS. On by default in production; set COOKIE_SECURE=false
// to test the production build over plain http.
const secure = process.env.COOKIE_SECURE
  ? process.env.COOKIE_SECURE === "true"
  : process.env.NODE_ENV === "production";

export async function getCurrentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return getUserBySessionToken(token);
}

export async function setSessionCookie(token: string, expires: Date) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    expires,
  });
}

export async function clearSessionCookie() {
  (await cookies()).set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 0,
  });
}