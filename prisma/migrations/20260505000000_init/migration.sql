CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "department" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "lastLoginAt" TIMESTAMP(3),
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Permission" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "group" TEXT NOT NULL,
  "reserved" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserPermission" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "permissionKey" TEXT NOT NULL,
  CONSTRAINT "UserPermission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserSession" (
  "id" TEXT NOT NULL,
  "sessionTokenHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Customer" (
  "id" TEXT NOT NULL,
  "customerCode" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "customerType" TEXT NOT NULL,
  "country" TEXT NOT NULL DEFAULT '',
  "city" TEXT NOT NULL DEFAULT '',
  "source" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "ownerName" TEXT NOT NULL,
  "department" TEXT NOT NULL DEFAULT 'export',
  "contactName" TEXT NOT NULL DEFAULT '',
  "contactTitle" TEXT NOT NULL DEFAULT '',
  "phone" TEXT NOT NULL DEFAULT '',
  "email" TEXT NOT NULL DEFAULT '',
  "wechatOrWhatsapp" TEXT NOT NULL DEFAULT '',
  "companyName" TEXT NOT NULL DEFAULT '',
  "companyWebsite" TEXT NOT NULL DEFAULT '',
  "companyAddress" TEXT NOT NULL DEFAULT '',
  "mainProducts" TEXT NOT NULL DEFAULT '',
  "purchaseNeed" TEXT NOT NULL DEFAULT '',
  "sourceNote" TEXT NOT NULL DEFAULT '',
  "expectedPurchaseNeed" TEXT NOT NULL DEFAULT '',
  "customerNotes" TEXT NOT NULL DEFAULT '',
  "internalNotes" TEXT NOT NULL DEFAULT '',
  "specialReminder" TEXT NOT NULL DEFAULT '',
  "customFields" JSONB NOT NULL DEFAULT '{}',
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerFieldConfig" (
  "id" TEXT NOT NULL,
  "moduleKey" TEXT NOT NULL,
  "fieldKey" TEXT NOT NULL,
  "fieldLabel" TEXT NOT NULL,
  "fieldType" TEXT NOT NULL,
  "fieldGroup" TEXT NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "options" JSONB NOT NULL DEFAULT '[]',
  "sortOrder" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isSystemField" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerFieldConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_department_idx" ON "User"("department");
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "User_isActive_idx" ON "User"("isActive");
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");
CREATE UNIQUE INDEX "UserPermission_userId_permissionKey_key" ON "UserPermission"("userId", "permissionKey");
CREATE INDEX "UserPermission_permissionKey_idx" ON "UserPermission"("permissionKey");
CREATE UNIQUE INDEX "UserSession_sessionTokenHash_key" ON "UserSession"("sessionTokenHash");
CREATE INDEX "UserSession_userId_idx" ON "UserSession"("userId");
CREATE INDEX "UserSession_expiresAt_idx" ON "UserSession"("expiresAt");
CREATE INDEX "UserSession_revokedAt_idx" ON "UserSession"("revokedAt");
CREATE UNIQUE INDEX "Customer_customerCode_key" ON "Customer"("customerCode");
CREATE INDEX "Customer_ownerUserId_idx" ON "Customer"("ownerUserId");
CREATE INDEX "Customer_department_idx" ON "Customer"("department");
CREATE INDEX "Customer_status_idx" ON "Customer"("status");
CREATE INDEX "Customer_updatedAt_idx" ON "Customer"("updatedAt");
CREATE UNIQUE INDEX "CustomerFieldConfig_moduleKey_fieldKey_key" ON "CustomerFieldConfig"("moduleKey", "fieldKey");
CREATE INDEX "CustomerFieldConfig_moduleKey_idx" ON "CustomerFieldConfig"("moduleKey");
CREATE INDEX "CustomerFieldConfig_fieldGroup_idx" ON "CustomerFieldConfig"("fieldGroup");
CREATE INDEX "CustomerFieldConfig_sortOrder_idx" ON "CustomerFieldConfig"("sortOrder");
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");
CREATE INDEX "AuditLog_entityType_idx" ON "AuditLog"("entityType");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_permissionKey_fkey" FOREIGN KEY ("permissionKey") REFERENCES "Permission"("key") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
