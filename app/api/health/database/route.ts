import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const documentCount = await prisma.document.count();

    return NextResponse.json({
      status: "ok",
      database: "connected",
      documentCount,
    });
  } catch (error) {
    console.error("Database health check failed:", error);

    return NextResponse.json(
      {
        status: "error",
        database: "unavailable",
      },
      { status: 500 },
    );
  }
}