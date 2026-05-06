-- Make 客户来源 configurable in field settings while keeping Customer.source for legacy compatibility.
UPDATE "CustomerFieldConfig"
SET "isSystemField" = false,
    "updatedAt" = NOW()
WHERE "moduleKey" = 'export_customer'
  AND "fieldKey" = 'source';
