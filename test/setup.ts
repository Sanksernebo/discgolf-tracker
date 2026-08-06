import { beforeAll, afterAll, beforeEach } from "vitest";
import { execSync } from "child_process";
import { prisma } from "@/lib/prisma";

beforeAll(() => {
  // Reset the test schema at the start of every run. `migrate reset --force
  // --skip-seed` drops all tables and re-applies every migration in order,
  // which keeps the schema aligned with the migrations directory (i.e. what
  // will run at Zone) without depending on ambient dev data.
  execSync("npx prisma migrate reset --force --skip-seed --skip-generate", {
    env: { ...process.env },
    stdio: "inherit",
  });
});

beforeEach(async () => {
  // Order matters: children first, then parents (FKs on Hole/CheckIn/
  // IssueReport/CourseAdmin).
  await prisma.$transaction([
    prisma.hole.deleteMany(),
    prisma.checkIn.deleteMany(),
    prisma.issueReport.deleteMany(),
    prisma.courseAdmin.deleteMany(),
    prisma.course.deleteMany(),
    prisma.admin.deleteMany(),
  ]);
});

afterAll(async () => {
  await prisma.$disconnect();
});
