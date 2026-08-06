import { beforeAll, afterAll, beforeEach } from "vitest";
import { execSync } from "child_process";
import { existsSync, unlinkSync } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";

const TEST_DB_PATH = path.resolve(process.cwd(), "prisma", "test.db");

beforeAll(() => {
  // Fresh schema every test run — cheap for SQLite and avoids drift.
  if (existsSync(TEST_DB_PATH)) unlinkSync(TEST_DB_PATH);
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: `file:./test.db` },
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
