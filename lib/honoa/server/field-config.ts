import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  CUSTOMER_ATTACHMENT_CONFIG_MODULE_KEY,
  CUSTOMER_ATTACHMENT_TYPE_FIELD_KEY,
  DEFAULT_CUSTOMER_ATTACHMENT_TYPES,
  CUSTOMER_FIELD_GROUPS,
  CUSTOMER_FIELD_TYPES,
  customerFieldLabel
} from "../shared/constants";
import type { CustomerFieldConfig, CustomerFieldGroup, CustomerFieldType } from "../shared/domain-types";
import type { AuthUser } from "./auth";
import { requireCurrentUser, requireServerPermission } from "./auth";
import { prisma } from "./db";

export function mapFieldConfig(field: Awaited<ReturnType<typeof prisma.customerFieldConfig.findMany>>[number]): CustomerFieldConfig {
  return {
    id: field.id,
    moduleKey: "export_customer",
    fieldKey: field.fieldKey,
    fieldLabel: customerFieldLabel(field.fieldKey, field.fieldLabel),
    fieldType: field.fieldType as CustomerFieldType,
    fieldGroup: field.fieldGroup as CustomerFieldGroup,
    required: field.required,
    options: Array.isArray(field.options) ? (field.options as string[]) : [],
    sortOrder: field.sortOrder,
    isActive: field.isActive,
    isSystemField: field.isSystemField,
    createdAt: field.createdAt.toISOString(),
    updatedAt: field.updatedAt.toISOString()
  };
}

export async function listCustomerFieldConfigsForActor(actor?: AuthUser, includeInactive = false) {
  if (includeInactive && actor) requireServerPermission(actor, "export.customers.fields.manage");
  const fields = await prisma.customerFieldConfig.findMany({
    where: { moduleKey: "export_customer", ...(includeInactive ? {} : { isActive: true }) },
    orderBy: [{ sortOrder: "asc" }]
  });
  return fields.map(mapFieldConfig).sort((a, b) => {
    const groupDelta = CUSTOMER_FIELD_GROUPS.indexOf(a.fieldGroup) - CUSTOMER_FIELD_GROUPS.indexOf(b.fieldGroup);
    if (groupDelta !== 0) return groupDelta;
    return a.sortOrder - b.sortOrder;
  });
}

function normalizeAttachmentTypeOptions(input: string[]) {
  const options = input
    .map((item) => item.trim())
    .filter(Boolean);
  const unique = Array.from(new Set(options));
  if (!unique.includes("其他")) unique.push("其他");
  return unique;
}

export async function getCustomerAttachmentTypes() {
  const config = await prisma.customerFieldConfig.upsert({
    where: {
      moduleKey_fieldKey: {
        moduleKey: CUSTOMER_ATTACHMENT_CONFIG_MODULE_KEY,
        fieldKey: CUSTOMER_ATTACHMENT_TYPE_FIELD_KEY
      }
    },
    create: {
      moduleKey: CUSTOMER_ATTACHMENT_CONFIG_MODULE_KEY,
      fieldKey: CUSTOMER_ATTACHMENT_TYPE_FIELD_KEY,
      fieldLabel: "附件类型",
      fieldType: "select",
      fieldGroup: "基础信息",
      required: false,
      options: DEFAULT_CUSTOMER_ATTACHMENT_TYPES,
      sortOrder: 10,
      isActive: true,
      isSystemField: true
    },
    update: {}
  });
  const options = Array.isArray(config.options) ? (config.options as string[]) : DEFAULT_CUSTOMER_ATTACHMENT_TYPES;
  return normalizeAttachmentTypeOptions(options);
}

export async function updateCustomerAttachmentTypesAction(formData: FormData) {
  "use server";

  const actor = await requireCurrentUser();
  requireServerPermission(actor, "export.customers.fields.manage");
  const options = normalizeAttachmentTypeOptions(
    String(formData.get("attachmentTypes") || "")
      .split(/\r?\n|,/)
      .map((item) => item.trim())
  );
  await prisma.$transaction(async (tx) => {
    const existing = await tx.customerFieldConfig.upsert({
      where: {
        moduleKey_fieldKey: {
          moduleKey: CUSTOMER_ATTACHMENT_CONFIG_MODULE_KEY,
          fieldKey: CUSTOMER_ATTACHMENT_TYPE_FIELD_KEY
        }
      },
      create: {
        moduleKey: CUSTOMER_ATTACHMENT_CONFIG_MODULE_KEY,
        fieldKey: CUSTOMER_ATTACHMENT_TYPE_FIELD_KEY,
        fieldLabel: "附件类型",
        fieldType: "select",
        fieldGroup: "基础信息",
        required: false,
        options,
        sortOrder: 10,
        isActive: true,
        isSystemField: true
      },
      update: {
        options,
        isActive: true
      }
    });
    await tx.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: "customer_attachment_types.update",
        entityType: "CustomerFieldConfig",
        entityId: existing.id,
        metadata: {
          moduleKey: CUSTOMER_ATTACHMENT_CONFIG_MODULE_KEY,
          fieldKey: CUSTOMER_ATTACHMENT_TYPE_FIELD_KEY,
          options
        }
      }
    });
  });
  revalidatePath("/export/customers/settings/fields");
  revalidatePath("/export/customers");
  redirect("/export/customers/settings/fields");
}

export async function createCustomerFieldConfigAction(formData: FormData) {
  "use server";

  const actor = await requireCurrentUser();
  requireServerPermission(actor, "export.customers.fields.manage");
  const input = fieldInputFromForm(formData);
  const fieldKey = await uniqueFieldKey(input.fieldLabel);
  await prisma.customerFieldConfig.create({
    data: {
      moduleKey: "export_customer",
      fieldKey,
      fieldLabel: input.fieldLabel,
      fieldType: input.fieldType,
      fieldGroup: input.fieldGroup,
      required: input.required,
      options: input.options,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
      isSystemField: false
    }
  });
  revalidatePath("/export/customers/settings/fields");
  redirect("/export/customers/settings/fields");
}

export async function updateCustomerFieldConfigAction(fieldId: string, formData: FormData) {
  "use server";

  const actor = await requireCurrentUser();
  requireServerPermission(actor, "export.customers.fields.manage");
  const existing = await prisma.customerFieldConfig.findUnique({ where: { id: fieldId } });
  if (!existing) throw new Error("字段不存在。");
  const input = fieldInputFromForm(formData);
  const nextFieldType = existing.isSystemField ? existing.fieldType : input.fieldType;
  await prisma.$transaction(async (tx) => {
    await tx.customerFieldConfig.update({
      where: { id: fieldId },
      data: {
        fieldLabel: input.fieldLabel,
        fieldGroup: input.fieldGroup,
        fieldType: nextFieldType,
        required: input.required,
        options: input.options,
        sortOrder: input.sortOrder,
        isActive: input.isActive
      }
    });
    if (!existing.isSystemField && existing.fieldType !== nextFieldType) {
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "update_customer_field_type",
          entityType: "CustomerFieldConfig",
          entityId: fieldId,
          metadata: {
            fieldKey: existing.fieldKey,
            fieldLabel: input.fieldLabel,
            oldFieldType: existing.fieldType,
            newFieldType: nextFieldType
          }
        }
      });
    }
  });
  revalidatePath("/export/customers/settings/fields");
  redirect("/export/customers/settings/fields");
}

function fieldInputFromForm(formData: FormData) {
  const fieldLabel = String(formData.get("fieldLabel") || "").trim();
  const fieldGroup = String(formData.get("fieldGroup") || CUSTOMER_FIELD_GROUPS[0]) as CustomerFieldGroup;
  const fieldType = String(formData.get("fieldType") || "text") as CustomerFieldType;
  if (!fieldLabel) throw new Error("请填写字段名称。");
  if (!CUSTOMER_FIELD_GROUPS.includes(fieldGroup)) throw new Error("字段分组无效。");
  if (!CUSTOMER_FIELD_TYPES.includes(fieldType)) throw new Error("字段类型无效。");
  return {
    fieldLabel,
    fieldGroup,
    fieldType,
    required: formData.get("required") === "1",
    isActive: formData.get("isActive") === "1",
    sortOrder: Number(formData.get("sortOrder") || 300),
    options: String(formData.get("options") || "")
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean)
  };
}

async function uniqueFieldKey(label: string) {
  const normalized = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
  let key = `custom_${normalized || "field"}`;
  let index = 1;
  while (await prisma.customerFieldConfig.findUnique({ where: { moduleKey_fieldKey: { moduleKey: "export_customer", fieldKey: key } } })) {
    index += 1;
    key = `custom_${normalized || "field"}_${index}`;
  }
  return key;
}
