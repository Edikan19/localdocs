
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const documents = await prisma.document.findMany({
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ documents });
  } catch (error) {
    console.error("Failed to retrieve documents:", error);

    return NextResponse.json(
      { error: "Unable to retrieve documents." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body)
  ) {
    return NextResponse.json(
      { error: "Request body must be a JSON object." },
      { status: 400 },
    );
  }

  const titleValue = (body as Record<string, unknown>).title;
  let title = "Untitled document";

  if (titleValue !== undefined) {
    if (typeof titleValue !== "string") {
      return NextResponse.json(
        { error: "Title must be a string." },
        { status: 400 },
      );
    }

    title = titleValue.trim();

    if (title.length === 0 || title.length > 120) {
      return NextResponse.json(
        { error: "Title must contain between 1 and 120 characters." },
        { status: 400 },
      );
    }
  }

  try {
    const document = await prisma.document.create({
      data: { title },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
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
