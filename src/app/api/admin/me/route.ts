import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/admin";

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ admin: null }, { status: 200 });
  }
  return NextResponse.json({
    admin: {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      courseIds: admin.courses.map((c) => c.courseId),
    },
  });
}
