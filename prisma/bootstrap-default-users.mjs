import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";
import { permissionGroups, seedUsers } from "./seed-data.mjs";

if (process.env.ALLOW_DEFAULT_USER_BOOTSTRAP !== "true") {
  console.error("Refusing to bootstrap default users. Set ALLOW_DEFAULT_USER_BOOTSTRAP=true only for first-time demo/dev initialization.");
  process.exit(1);
}

if (
  process.env.NODE_ENV === "production" &&
  process.env.BOOTSTRAP_DEFAULT_USERS_CONFIRM !== "I_UNDERSTAND_THIS_CREATES_USERS"
) {
  console.error(
    "Refusing to bootstrap default users in production. Set BOOTSTRAP_DEFAULT_USERS_CONFIRM=I_UNDERSTAND_THIS_CREATES_USERS only after backup and manual approval."
  );
  process.exit(1);
}

const prisma = new PrismaClient();
const seedEmails = seedUsers.map((user) => user.email);

const nonDefaultUserCount = await prisma.user.count({
  where: { email: { notIn: seedEmails } }
});

if (
  nonDefaultUserCount > 0 &&
  process.env.BOOTSTRAP_NON_DEFAULT_USERS_CONFIRM !== "I_UNDERSTAND_THIS_DATABASE_ALREADY_HAS_USERS"
) {
  await prisma.$disconnect();
  console.error(
    `Refusing to bootstrap default users because the database already has ${nonDefaultUserCount} non-default user(s). Set BOOTSTRAP_NON_DEFAULT_USERS_CONFIRM=I_UNDERSTAND_THIS_DATABASE_ALREADY_HAS_USERS only after confirming this is intentional.`
  );
  process.exit(1);
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("base64url");
  const hash = crypto.pbkdf2Sync(password, salt, 210000, 32, "sha256").toString("base64url");
  return `pbkdf2_sha256$210000$${salt}$${hash}`;
}

for (const group of permissionGroups) {
  for (const [key, label] of group.items) {
    await prisma.permission.upsert({
      where: { key },
      update: { label, group: group.group, reserved: group.reserved },
      create: { key, label, group: group.group, reserved: group.reserved }
    });
  }
}

for (const seedUser of seedUsers) {
  const existing = await prisma.user.findUnique({ where: { email: seedUser.email } });
  if (existing) {
    console.log(`Default user exists, not modifying: ${seedUser.email}`);
    continue;
  }
  const user = await prisma.user.create({
    data: {
      name: seedUser.name,
      email: seedUser.email,
      passwordHash: hashPassword(seedUser.password),
      department: seedUser.department,
      role: seedUser.role,
      isActive: true
    }
  });
  if (seedUser.role !== "super_admin") {
    await prisma.userPermission.createMany({
      data: seedUser.permissions.map((permissionKey) => ({ userId: user.id, permissionKey })),
      skipDuplicates: true
    });
  }
  console.log(`Created default user: ${seedUser.email}`);
}

await prisma.$disconnect();
console.log("KingaOS default user bootstrap complete.");
