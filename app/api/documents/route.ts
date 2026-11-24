import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";

// Maximum documents each person can own
const MAX_DOCUMENTS = Number(process.env.MAX_DOCUMENTS ?? 200);

const UNAUTHORIZED = { error: "Not signed in." };

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json(UNAUTHORIZED, { status: 401 });

  try {
    const rows = await prisma.document.findMany({
      where: {
        OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }],
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        ownerId: true,
        members: { where: { userId: user.id }, select: { role: true } },
      },
    });

    const documents = rows.map((row) => ({
      id: row.id,
      title: row.title,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      role: row.ownerId === user.id ? "owner" : (row.members[0]?.role ?? "viewer"),
    }));

    return NextResponse.json({ documents });
  } catch (error) {
    console.error("Failed to list documents:", error);
    return NextResponse.json(
      { error: "Unable to list documents." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json(UNAUTHORIZED, { status: 401 });

  let title: string | undefined;
  try {
    const body = await request.json();
    if (typeof body?.title === "string") {
      const trimmed = body.title.trim();
      if (trimmed.length > 0 && trimmed.length <= 120) title = trimmed;
    }
  } catch {
    // an empty or invalid body is fine; the default title is used
  }

  try {
    const owned = await prisma.document.count({ where: { ownerId: user.id } });
    if (owned >= MAX_DOCUMENTS) {
      return NextResponse.json(
        { error: "Document limit reached. Delete one to create another." },
        { status: 429 },
      );
    }

    const document = await prisma.document.create({
      data: { ownerId: user.id, ...(title ? { title } : {}) },
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    });
    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    console.error("Failed to create document:", error);
    return NextResponse.json(
      { error: "Unable to create document." },
      { status: 500 },
    );
  }
}