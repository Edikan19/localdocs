export type DocumentRole = "owner" | "editor" | "viewer";

export function canEdit(role: DocumentRole | null): boolean {
  return role === "owner" || role === "editor";
}