import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

export async function POST() {
  try {
    const document = await prisma.document.create({
      data: {},
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