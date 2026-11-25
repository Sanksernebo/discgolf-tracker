import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getCurrentAdmin, canEditCourse } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const MAX_SIZE = 5 * 1024 * 1024;

const extensions: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getCurrentAdmin();

  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  if (!canEditCourse(admin, id)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const course = await prisma.course.findUnique({ where: { id } });

  if (!course) {
    return NextResponse.json({ error: "course_not_found" }, { status: 404 });
  }

  const formData = await req.formData();
  const file = formData.get("image");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "image_required" }, { status: 400 });
  }

  const extension = extensions[file.type];

  if (!extension) {
    return NextResponse.json(
      { error: "Use JPG, PNG or WebP." },
      { status: 400 },
    );
  }

  if (file.size === 0 || file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "Image must be smaller than 5 MB." },
      { status: 400 },
    );
  }

  const filename = `${randomUUID()}${extension}`;
  const directory = path.join(process.cwd(), "public", "uploads", "courses");

  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, filename),
    Buffer.from(await file.arrayBuffer()),
  );

  const imageUrl = `/uploads/courses/${filename}`;

  await prisma.course.update({
    where: { id },
    data: { imageUrl },
  });

  return NextResponse.json({ imageUrl });
}
