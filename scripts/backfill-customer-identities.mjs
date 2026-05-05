import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY_CONFIRM = "I_UNDERSTAND_THIS_CHANGES_BUSINESS_DATA";
const shouldApply = process.env.BACKFILL_CONFIRM === APPLY_CONFIRM;

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

const customers = await prisma.customer.findMany({
  orderBy: { createdAt: "asc" },
  select: {
    id: true,
    name: true,
    customerIdentityId: true,
    normalizedCustomerName: true
  }
});

const normalizedGroups = new Map();
const identityCache = new Map();

for (const customer of customers) {
  const normalizedName = normalizeCustomerName(customer.name);
  if (!normalizedName) continue;
  const group = normalizedGroups.get(normalizedName) || [];
  group.push(customer);
  normalizedGroups.set(normalizedName, group);
}

const existingIdentities = await prisma.customerIdentity.findMany({
  where: {
    scope: "export_customer",
    normalizedName: { in: [...normalizedGroups.keys()] }
  },
  select: { id: true, normalizedName: true }
});

for (const identity of existingIdentities) {
  identityCache.set(identity.normalizedName, identity.id);
}

const plannedIdentityCreates = [];
const plannedCustomerUpdates = [];
const duplicateGroups = [];

for (const [normalizedName, group] of normalizedGroups.entries()) {
  const existingIdentityId = identityCache.get(normalizedName);
  if (!existingIdentityId) {
    plannedIdentityCreates.push({
      normalizedName,
      displayName: group[0]?.name || normalizedName
    });
  }
  for (const customer of group) {
    if (customer.customerIdentityId !== existingIdentityId || customer.normalizedCustomerName !== normalizedName) {
      plannedCustomerUpdates.push({
        customerId: customer.id,
        normalizedName,
        currentIdentityId: customer.customerIdentityId,
        currentNormalizedName: customer.normalizedCustomerName
      });
    }
  }
  if (group.length > 1) {
    duplicateGroups.push({
      normalizedName,
      customerIds: group.map((customer) => customer.id)
    });
  }
}

console.log("KingaOS customer identity backfill check");
console.log(`Mode: ${shouldApply ? "APPLY" : "DRY-RUN"}`);
console.log(`Customers scanned: ${customers.length}`);
console.log(`CustomerIdentity records to create: ${plannedIdentityCreates.length}`);
console.log(`Customer records to link/update: ${plannedCustomerUpdates.length}`);
console.log(`Duplicate normalized groups found: ${duplicateGroups.length}`);

if (!shouldApply) {
  console.log(`No database writes were made. To apply, set BACKFILL_CONFIRM=${APPLY_CONFIRM}.`);
  await prisma.$disconnect();
  process.exit(0);
}

let identitiesCreated = 0;
let customersUpdated = 0;
let duplicateAuditLogsCreated = 0;

for (const [normalizedName, group] of normalizedGroups.entries()) {
  const identity = await prisma.customerIdentity.upsert({
    where: { scope_normalizedName: { scope: "export_customer", normalizedName } },
    update: {},
    create: {
      scope: "export_customer",
      displayName: group[0]?.name || normalizedName,
      normalizedName
    }
  });
  if (!identityCache.has(normalizedName)) identitiesCreated += 1;

  for (const customer of group) {
    if (customer.customerIdentityId === identity.id && customer.normalizedCustomerName === normalizedName) continue;
    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        customerIdentityId: identity.id,
        normalizedCustomerName: normalizedName
      }
    });
    customersUpdated += 1;
  }

  if (group.length > 1) {
    await prisma.auditLog.create({
      data: {
        actorUserId: null,
        action: "customer_identity.backfill_duplicate_group",
        entityType: "CustomerIdentity",
        entityId: identity.id,
        metadata: { normalizedName, existingCustomerIds: group.map((customer) => customer.id) }
      }
    });
    duplicateAuditLogsCreated += 1;
    console.log(`Duplicate customer identity group: ${normalizedName} -> ${group.map((customer) => customer.id).join(", ")}`);
  }
}

await prisma.$disconnect();
console.log("KingaOS customer identity backfill applied");
console.log(`CustomerIdentity records created: ${identitiesCreated}`);
console.log(`Customer records linked/updated: ${customersUpdated}`);
console.log(`Duplicate audit logs created: ${duplicateAuditLogsCreated}`);
