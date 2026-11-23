import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getDocumentRole } from "@/lib/auth/access";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const role = await getDocumentRole(user.id, id);
  // 404 rather than 403, so strangers can't tell which ids exist
  if (!role) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  try {
    const document = await prisma.document.findUnique({
      where: { id },
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    });
    if (!document) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }
    return NextResponse.json({ document: { ...document, role } });
  } catch (error) {
    console.error("Failed to retrieve document:", error);
    return NextResponse.json(
      { error: "Unable to retrieve document." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const role = await getDocumentRole(user.id, id);
  if (!role) return NextResponse.json({ error: "Document not found." }, { status: 404 });
  if (role !== "owner") {
    return NextResponse.json(
      { error: "Only the owner can delete a document." },
      { status: 403 },
    );
  }

  try {
    await prisma.document.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Failed to delete document:", error);
    return NextResponse.json(
      { error: "Unable to delete document." },
      { status: 500 },
    );
  }
}