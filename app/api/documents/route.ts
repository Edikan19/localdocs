import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MAX_DOCUMENTS = Number(process.env.MAX_DOCUMENTS ?? 200);

const summary = {
  id: true,
  title: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function GET() {
  try {
    const documents = await prisma.document.findMany({
      orderBy: { updatedAt: "desc" },
      select: summary,
    });
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
    const total = await prisma.document.count();
    if (total >= MAX_DOCUMENTS) {
      return NextResponse.json(
        { error: "Document limit reached. Delete one to create another." },
        { status: 429 },
      );
    }

    const document = await prisma.document.create({
      data: title ? { title } : {},
      select: summary,
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