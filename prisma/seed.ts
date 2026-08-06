import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.course.count();
  if (existing > 0) {
    console.log(`Skipping seed — ${existing} courses already exist.`);
    return;
  }

  const courses = [
    {
      nameEt: "Tehvandi discgolfi rada",
      nameEn: "Tehvandi Disc Golf Course",
      county: "valga",
      city: "Otepää",
      latitude: 58.0416,
      longitude: 26.5,
      descriptionEt: "Kuulus rada Otepääl, mägine maastik.",
      descriptionEn: "Famous hilly course in Otepää.",
      holes: Array.from({ length: 18 }, (_, i) => ({
        number: i + 1,
        par: 3 + (i % 3 === 0 ? 1 : 0),
        distance: 60 + i * 5,
      })),
    },
    {
      nameEt: "Pirita discgolfi park",
      nameEn: "Pirita Disc Golf Park",
      county: "harju",
      city: "Tallinn",
      latitude: 59.4694,
      longitude: 24.8339,
      descriptionEt: "Populaarne rada Tallinnas Pirita metsades.",
      descriptionEn: "Popular course in Tallinn's Pirita forests.",
      holes: Array.from({ length: 18 }, (_, i) => ({
        number: i + 1,
        par: 3,
        distance: 55 + i * 4,
      })),
    },
    {
      nameEt: "Tartu Tähtvere discgolfi rada",
      nameEn: "Tartu Tähtvere Disc Golf Course",
      county: "tartu",
      city: "Tartu",
      latitude: 58.3872,
      longitude: 26.6844,
      descriptionEt: "Rada Tartu Tähtvere pargis.",
      descriptionEn: "Course in Tartu's Tähtvere park.",
      holes: Array.from({ length: 12 }, (_, i) => ({
        number: i + 1,
        par: 3,
        distance: 50 + i * 6,
      })),
    },
    {
      nameEt: "Pärnu Rannametsa rada",
      nameEn: "Pärnu Rannametsa Course",
      county: "parnu",
      city: "Pärnu",
      latitude: 58.3853,
      longitude: 24.4971,
      descriptionEt: "Mererandlik rada Pärnus.",
      descriptionEn: "Seaside course in Pärnu.",
      holes: Array.from({ length: 9 }, (_, i) => ({
        number: i + 1,
        par: 3,
        distance: 45 + i * 5,
      })),
    },
    {
      nameEt: "Viljandi Männimäe rada",
      nameEn: "Viljandi Männimäe Course",
      county: "viljandi",
      city: "Viljandi",
      latitude: 58.3639,
      longitude: 25.59,
      descriptionEt: "Männimetsa rada Viljandis.",
      descriptionEn: "Pine-forest course in Viljandi.",
      holes: Array.from({ length: 18 }, (_, i) => ({
        number: i + 1,
        par: 3,
        distance: 65 + i * 5,
      })),
    },
    {
      nameEt: "Kuressaare discgolfi rada",
      nameEn: "Kuressaare Disc Golf Course",
      county: "saare",
      city: "Kuressaare",
      latitude: 58.2528,
      longitude: 22.4849,
      descriptionEt: "Rada Saaremaal.",
      descriptionEn: "Course on Saaremaa island.",
      holes: Array.from({ length: 9 }, (_, i) => ({
        number: i + 1,
        par: 3,
        distance: 50 + i * 4,
      })),
    },
  ];

  for (const c of courses) {
    const { holes, ...courseData } = c;
    await prisma.course.create({
      data: {
        ...courseData,
        holes: { create: holes },
      },
    });
  }

  console.log(`Seeded ${courses.length} courses.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
