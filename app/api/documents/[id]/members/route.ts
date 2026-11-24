import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getDocumentRole } from "@/lib/auth/access";
import { normalizeEmail, parseShareRole } from "@/lib/auth/validation";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** Only the owner can see or change who a document is shared with. */
async function authorizeOwner(documentId: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { response: NextResponse.json({ error: "Not signed in." }, { status: 401 }) };
  }

  const role = await getDocumentRole(user.id, documentId);
  if (!role) {
    return { response: NextResponse.json({ error: "Document not found." }, { status: 404 }) };
  }
  if (role !== "owner") {
    return {
      response: NextResponse.json(
        { error: "Only the owner can manage sharing." },
        { status: 403 },
      ),
    };
  }
  return { user };
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const auth = await authorizeOwner(id);
  if ("response" in auth) return auth.response;

  try {
    const document = await prisma.document.findUnique({
      where: { id },
      select: {
        owner: { select: { name: true, email: true } },
        members: {
          orderBy: { createdAt: "asc" },
          select: {
            role: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });
    if (!document) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    return NextResponse.json({
      owner: document.owner,
      members: document.members.map((member) => ({
        userId: member.user.id,
        name: member.user.name,
        email: member.user.email,
        role: member.role,
      })),
    });
  } catch (error) {
    console.error("Failed to list members:", error);
    return NextResponse.json({ error: "Unable to load sharing settings." }, { status: 500 });
  }
}

/** Adds someone, or changes their role if they already have access. */
export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const auth = await authorizeOwner(id);
  if ("response" in auth) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }
  const fields = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;

  const email = normalizeEmail(fields.email);
  const role = parseShareRole(fields.role);
  if (!email) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (!role) {
    return NextResponse.json({ error: "Choose editor or viewer." }, { status: 400 });
  }

  try {
    const target = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!target) {
      return NextResponse.json(
        { error: "No account with that email. Ask them to sign up first." },
        { status: 404 },
      );
    }
    if (target.id === auth.user.id) {
      return NextResponse.json({ error: "You already own this document." }, { status: 400 });
    }

    await prisma.documentMember.upsert({
      where: { documentId_userId: { documentId: id, userId: target.id } },
      create: { documentId: id, userId: target.id, role },
      update: { role },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to share document:", error);
    return NextResponse.json({ error: "Unable to share the document." }, { status: 500 });
  }
}