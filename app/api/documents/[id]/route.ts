import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;

  try {
    const document = await prisma.document.findUnique({
      where: { id },
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }
    return NextResponse.json({ document });
  } catch (error) {
    console.error("Failed to retrieve document:", error);
    return NextResponse.json(
      { error: "Unable to retrieve document." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;

  try {
    const { count } = await prisma.document.deleteMany({ where: { id } });

    if (count === 0) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Failed to delete document:", error);
    return NextResponse.json(
      { error: "Unable to delete document." },
      { status: 500 },
    );
  }
}