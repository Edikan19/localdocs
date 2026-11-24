const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && EMAIL_PATTERN.test(email) ? email : null;
}

export function cleanName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  return name.length >= 1 && name.length <= 60 ? name : null;
}

/** Returns a message if the password is unacceptable, or null if it's fine. */
export function passwordProblem(value: unknown): string | null {
  if (typeof value !== "string") return "Password is required.";
  if (value.length < 8) return "Password must be at least 8 characters.";
  if (value.length > 128) return "Password must be at most 128 characters.";
  return null;
}


/** Only allow redirects to paths on this site, and never back to the auth pages. */
export function safeNextPath(value: unknown): string {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return "/";
  }
  if (value.startsWith("/login") || value.startsWith("/signup")) return "/";
  return value;
}

export function parseShareRole(value: unknown): "editor" | "viewer" | null {
  return value === "editor" || value === "viewer" ? value : null;
}