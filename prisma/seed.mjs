import { PrismaClient } from "@prisma/client";
import { defaultCustomerFields, permissionGroups } from "./seed-data.mjs";

const prisma = new PrismaClient();

for (const group of permissionGroups) {
  for (const [key, label] of group.items) {
    await prisma.permission.upsert({
      where: { key },
      update: { label, group: group.group, reserved: group.reserved },
      create: { key, label, group: group.group, reserved: group.reserved }
    });
  }
}

let createdFieldCount = 0;
for (const field of defaultCustomerFields()) {
  const existing = await prisma.customerFieldConfig.findUnique({
    where: { moduleKey_fieldKey: { moduleKey: field.moduleKey, fieldKey: field.fieldKey } }
  });
  if (existing) continue;
  await prisma.customerFieldConfig.create({ data: field });
  createdFieldCount += 1;
}

await prisma.$disconnect();
console.log(`KingaOS system seed complete. Created missing field configs: ${createdFieldCount}. Users and customers were not modified.`);
