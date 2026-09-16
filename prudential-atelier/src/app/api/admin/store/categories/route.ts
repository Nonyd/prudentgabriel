import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { fromStoreError, jsonError } from "@/lib/store/http";

export async function GET() {
  const gate = await requireAdminApi("store");
  if (!gate.ok) return gate.response;

  const items = await prisma.itemCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const gate = await requireAdminApi("store");
  if (!gate.ok) return gate.response;

  let body: { name?: string; sortOrder?: number };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON");
  }
  const name = body.name?.trim();
  if (!name) return jsonError("Category name is required.");

  try {
    const item = await prisma.itemCategory.create({
      data: {
        name,
        sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : 100,
      },
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
      return jsonError("A category with that name already exists.", 409);
    }
    return fromStoreError(e);
  }
}
