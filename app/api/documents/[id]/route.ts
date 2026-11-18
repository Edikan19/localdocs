
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  _request: Request,
  { params }: RouteContext,
) {
  const { id } = await params;

  try {
    const document = await prisma.document.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        content: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found." },
        { status: 404 },
      );
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

export async function PATCH(
  request: Request,
  { params }: RouteContext,
) {
  const { id } = await params;

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

  const fields = body as Record<string, unknown>;
  const keys = Object.keys(fields);

  if (
    keys.length === 0 ||
    keys.some((key) => key !== "title" && key !== "content")
  ) {
    return NextResponse.json(
      { error: "Provide a title or content to update." },
      { status: 400 },
    );
  }

  const data: { title?: string; content?: string } = {};

  if ("title" in fields) {
    if (typeof fields.title !== "string") {
      return NextResponse.json(
        { error: "Title must be a string." },
        { status: 400 },
      );
    }

    const title = fields.title.trim();

    if (title.length === 0 || title.length > 120) {
      return NextResponse.json(
        { error: "Title must contain between 1 and 120 characters." },
        { status: 400 },
      );
    }

    data.title = title;
  }

  if ("content" in fields) {
    if (typeof fields.content !== "string") {
      return NextResponse.json(
        { error: "Content must be a string." },
        { status: 400 },
      );
    }

    if (fields.content.length > 1_000_000) {
      return NextResponse.json(
        { error: "Content must not exceed 1,000,000 characters." },
        { status: 413 },
      );
    }

    data.content = fields.content;
  }

  try {
    const existingDocument = await prisma.document.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingDocument) {
      return NextResponse.json(
        { error: "Document not found." },
        { status: 404 },
      );
    }

    const document = await prisma.document.update({
      where: { id },
      data,
      select: {
        id: true,
        title: true,
        content: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ document });
  } catch (error) {
    console.error("Failed to update document:", error);

    return NextResponse.json(
      { error: "Unable to update document." },
      { status: 500 },
    );
  }
}
