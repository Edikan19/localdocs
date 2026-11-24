import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getDocumentRole } from "@/lib/auth/access";

type RouteContext = {
  params: Promise<{ id: string; userId: string }>;
};

/** The owner can remove anyone, and people can remove themselves (leave). */
export async function DELETE(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id, userId } = await params;
  const role = await getDocumentRole(user.id, id);
  if (!role) return NextResponse.json({ error: "Document not found." }, { status: 404 });
  if (role !== "owner" && user.id !== userId) {
    return NextResponse.json({ error: "Only the owner can remove people." }, { status: 403 });
  }

  try {
    const { count } = await prisma.documentMember.deleteMany({
      where: { documentId: id, userId },
    });
    if (count === 0) {
      return NextResponse.json({ error: "That person doesn't have access." }, { status: 404 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Failed to remove member:", error);
    return NextResponse.json({ error: "Unable to remove that person." }, { status: 500 });
  }
}