import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function normalizeCustomerName(input) {
  let value = String(input || "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[\s\u00a0]+/g, "")
    .replace(/[\p{P}\p{S}]/gu, "");
  if (value.endsWith("客户") && value.length > 2) value = value.slice(0, -2);
  return value;
}

const duplicateGroups = new Map();

const customers = await prisma.customer.findMany({ orderBy: { createdAt: "asc" } });

for (const customer of customers) {
  const normalizedName = normalizeCustomerName(customer.name);
  if (!normalizedName) continue;
  const identity = await prisma.customerIdentity.upsert({
    where: { scope_normalizedName: { scope: "export_customer", normalizedName } },
    update: {},
    create: {
      scope: "export_customer",
      displayName: customer.name,
      normalizedName
    }
  });
  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      customerIdentityId: identity.id,
      normalizedCustomerName: normalizedName
    }
  });
  const group = duplicateGroups.get(normalizedName) || [];
  group.push(customer.id);
  duplicateGroups.set(normalizedName, group);
}

for (const [normalizedName, customerIds] of duplicateGroups.entries()) {
  if (customerIds.length <= 1) continue;
  await prisma.auditLog.create({
    data: {
      actorUserId: null,
      action: "customer_identity.backfill_duplicate_group",
      entityType: "CustomerIdentity",
      entityId: null,
      metadata: { normalizedName, existingCustomerIds: customerIds }
    }
  });
  console.log(`Duplicate customer identity group: ${normalizedName} -> ${customerIds.join(", ")}`);
}

await prisma.$disconnect();
console.log(`Backfilled customer identities for ${customers.length} customers.`);
