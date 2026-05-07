import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertCustomerOssObjectKey,
  generateCustomerAttachmentObjectKey,
  isOssConfigured,
  sanitizeOssFileName,
  validateOssUploadRequest
} from "@/lib/honoa/server/oss";

const ossEnv = {
  ALIYUN_OSS_REGION: "oss-cn-guangzhou",
  ALIYUN_OSS_BUCKET: "kinga",
  ALIYUN_OSS_ENDPOINT: "https://oss-cn-guangzhou.aliyuncs.com",
  ALIYUN_OSS_ACCESS_KEY_ID: "test-key-id",
  ALIYUN_OSS_ACCESS_KEY_SECRET: "test-key-secret",
  ALIYUN_OSS_UPLOAD_PREFIX: "customers",
  ALIYUN_OSS_SIGNED_URL_EXPIRES_SECONDS: "600",
  ALIYUN_OSS_MAX_FILE_SIZE_MB: "20"
};

const uploadUrlRoute = readFileSync(join(process.cwd(), "app/api/export/customers/[customerId]/attachments/upload-url/route.ts"), "utf8");
const createAttachmentRoute = readFileSync(join(process.cwd(), "app/api/export/customers/[customerId]/attachments/route.ts"), "utf8");
const downloadRoute = readFileSync(join(process.cwd(), "app/api/export/customers/[customerId]/attachments/[attachmentId]/download-url/route.ts"), "utf8");
const customerServer = readFileSync(join(process.cwd(), "lib/honoa/server/customers.ts"), "utf8");
const fieldConfigServer = readFileSync(join(process.cwd(), "lib/honoa/server/field-config.ts"), "utf8");
const fieldSettingsPage = readFileSync(join(process.cwd(), "app/export/customers/settings/fields/page.tsx"), "utf8");
const attachmentPanel = readFileSync(join(process.cwd(), "components/customer-attachments-panel.tsx"), "utf8");
const ossUploadClient = readFileSync(join(process.cwd(), "components/customer-oss-upload.tsx"), "utf8");

describe("KingaOS OSS customer attachments", () => {
  it("OSS 配置缺失时可识别为未配置", () => {
    expect(isOssConfigured({})).toBe(false);
    expect(isOssConfigured(ossEnv)).toBe(true);
  });

  it("文件名会 sanitize，objectKey 只能由服务端生成到 customers 前缀", () => {
    expect(sanitizeOssFileName("../evil 名片.jpg")).toBe("evil_名片.jpg");
    const key = generateCustomerAttachmentObjectKey("cus_123", "../evil 名片.jpg", new Date("2026-05-06T00:00:00.000Z"));
    expect(key).toMatch(/^customers\/cus_123\/2026\/[0-9a-f-]+-evil_名片\.jpg$/);
    expect(assertCustomerOssObjectKey("cus_123", key)).toBe(key);
    expect(() => assertCustomerOssObjectKey("cus_123", "customers/other/2026/file.jpg")).toThrow("objectKey");
    expect(() => assertCustomerOssObjectKey("cus_123", "customers/cus_123/../file.jpg")).toThrow("objectKey");
  });

  it("业务允许的文件类型和大小可以通过校验", () => {
    const result = validateOssUploadRequest({ fileName: "合同.pdf", fileSize: 1024, mimeType: "application/pdf" }, ossEnv);
    expect(result.mimeType).toBe("application/pdf");
    expect(result.fileSize).toBe(1024);
  });

  it("超过大小限制会被拒绝", () => {
    expect(() => validateOssUploadRequest({ fileName: "large.pdf", fileSize: 21 * 1024 * 1024, mimeType: "application/pdf" }, ossEnv)).toThrow("20MB");
  });

  it("禁止类型和危险扩展名会被拒绝", () => {
    expect(() => validateOssUploadRequest({ fileName: "shell.sh", fileSize: 1024, mimeType: "text/plain" }, ossEnv)).toThrow("扩展名");
    expect(() => validateOssUploadRequest({ fileName: "page.html", fileSize: 1024, mimeType: "text/html" }, ossEnv)).toThrow("文件类型");
  });

  it("上传 URL 接口必须登录并做服务端编辑权限校验", () => {
    expect(uploadUrlRoute).toContain("getCurrentUser");
    expect(uploadUrlRoute).toContain("status: 401");
    expect(uploadUrlRoute).toContain("canEditCustomerServer");
    expect(uploadUrlRoute).toContain("generatePutSignedUrl");
    expect(uploadUrlRoute).toContain("customer_attachment.upload_url.generate");
  });

  it("OSS 上传成功后保存 CustomerAttachment 元数据，不保存 uploadUrl", () => {
    expect(createAttachmentRoute).toContain("createCustomerAttachmentFromOss");
    expect(customerServer).toContain('storageProvider: "aliyun_oss"');
    expect(customerServer).toContain("storageKey");
    expect(customerServer).toContain("mimeType");
    expect(customerServer).toContain("fileSize");
    expect(customerServer).not.toMatch(/uploadUrl\s*:/);
  });

  it("下载 URL 生成前必须检查 canViewCustomer", () => {
    expect(downloadRoute).toContain("getCurrentUser");
    expect(downloadRoute).toContain("getCustomerAttachmentDownloadUrl");
    expect(customerServer).toContain("canViewCustomerServer(actor, customer)");
    expect(customerServer).toContain("generateGetSignedUrl");
  });

  it("删除附件仍然是软删除并写 AuditLog", () => {
    expect(customerServer).toContain("data: { deletedAt: new Date() }");
    expect(customerServer).toContain("customer_attachment.delete");
  });

  it("前端直接 PUT 到 OSS，再保存 metadata，不再显示旧附件链接提交表单", () => {
    expect(ossUploadClient).toContain('method: "PUT"');
    expect(ossUploadClient).toContain("uploadPayload.uploadUrl");
    expect(ossUploadClient).toContain("objectKey");
    expect(ossUploadClient).toContain("OSS 尚未配置，暂时不能上传文件");
    expect(attachmentPanel).not.toContain("添加附件链接");
    expect(attachmentPanel).not.toContain("createCustomerAttachmentAction");
  });

  it("附件类型由管理员在字段配置页维护，并用于服务端校验", () => {
    expect(fieldConfigServer).toContain("getCustomerAttachmentTypes");
    expect(fieldConfigServer).toContain("updateCustomerAttachmentTypesAction");
    expect(fieldConfigServer).toContain("customer_attachment_types.update");
    expect(fieldSettingsPage).toContain("附件类型配置");
    expect(fieldSettingsPage).toContain("保存附件类型");
    expect(uploadUrlRoute).toContain("getCustomerAttachmentTypes");
    expect(customerServer).toContain("await getCustomerAttachmentTypes()");
    expect(attachmentPanel).toContain("attachmentTypes?: string[]");
    expect(attachmentPanel).toContain("AttachmentTypeSelect");
  });
});
