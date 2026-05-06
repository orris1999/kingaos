import crypto from "node:crypto";

const OSS = require("ali-oss") as new (options: {
  region: string;
  bucket: string;
  endpoint: string;
  accessKeyId: string;
  accessKeySecret: string;
}) => {
  signatureUrl: (name: string, options?: Record<string, unknown>, strictObjectNameValidation?: boolean) => string;
  delete: (name: string) => Promise<unknown>;
};

export const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/plain"
]);

export const BLOCKED_ATTACHMENT_EXTENSIONS = new Set([".exe", ".js", ".html", ".htm", ".sh", ".bat"]);

type OssEnv = Record<string, string | undefined>;

export type OssConfig = {
  region: string;
  bucket: string;
  endpoint: string;
  accessKeyId: string;
  accessKeySecret: string;
  uploadPrefix: "customers";
  signedUrlExpiresSeconds: number;
  maxFileSizeBytes: number;
};

export type OssUploadRequest = {
  fileName: string;
  fileSize: number;
  mimeType: string;
};

export function isOssConfigured(env: OssEnv = process.env) {
  return Boolean(
    env.ALIYUN_OSS_REGION &&
      env.ALIYUN_OSS_BUCKET &&
      env.ALIYUN_OSS_ENDPOINT &&
      env.ALIYUN_OSS_ACCESS_KEY_ID &&
      env.ALIYUN_OSS_ACCESS_KEY_SECRET
  );
}

export function getOssConfig(env: OssEnv = process.env): OssConfig {
  if (!isOssConfigured(env)) {
    throw new Error("OSS 尚未配置，暂时只能添加附件链接。");
  }
  const uploadPrefix = (env.ALIYUN_OSS_UPLOAD_PREFIX || "customers").replace(/^\/+|\/+$/g, "");
  if (uploadPrefix !== "customers") {
    throw new Error("OSS 上传前缀必须是 customers。");
  }
  const expires = Number(env.ALIYUN_OSS_SIGNED_URL_EXPIRES_SECONDS || 600);
  const maxFileSizeMb = Number(env.ALIYUN_OSS_MAX_FILE_SIZE_MB || 20);
  return {
    region: env.ALIYUN_OSS_REGION!,
    bucket: env.ALIYUN_OSS_BUCKET!,
    endpoint: env.ALIYUN_OSS_ENDPOINT!,
    accessKeyId: env.ALIYUN_OSS_ACCESS_KEY_ID!,
    accessKeySecret: env.ALIYUN_OSS_ACCESS_KEY_SECRET!,
    uploadPrefix: "customers",
    signedUrlExpiresSeconds: Number.isFinite(expires) && expires > 0 ? expires : 600,
    maxFileSizeBytes: Math.max(1, Number.isFinite(maxFileSizeMb) && maxFileSizeMb > 0 ? maxFileSizeMb : 20) * 1024 * 1024
  };
}

export function createOssClient(config = getOssConfig()) {
  return new OSS({
    region: config.region,
    bucket: config.bucket,
    endpoint: config.endpoint,
    accessKeyId: config.accessKeyId,
    accessKeySecret: config.accessKeySecret
  });
}

export function sanitizeOssFileName(fileName: string) {
  const baseName = String(fileName || "file")
    .normalize("NFKC")
    .split(/[\\/]/)
    .pop() || "file";
  const safe = baseName
    .replace(/\.\.+/g, ".")
    .replace(/[^\p{L}\p{N}._-]+/gu, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
  if (!safe || safe === "." || safe === "..") return "file";
  return safe.startsWith(".") ? `file${safe}` : safe;
}

export function fileExtension(fileName: string) {
  const safeName = sanitizeOssFileName(fileName);
  const dotIndex = safeName.lastIndexOf(".");
  return dotIndex >= 0 ? safeName.slice(dotIndex).toLowerCase() : "";
}

export function validateOssUploadRequest(input: OssUploadRequest, env: OssEnv = process.env) {
  const config = getOssConfig(env);
  const fileName = sanitizeOssFileName(input.fileName);
  const fileSize = Number(input.fileSize);
  const mimeType = String(input.mimeType || "").trim().toLowerCase();
  const ext = fileExtension(fileName);

  if (!fileName) throw new Error("文件名无效。");
  if (!Number.isFinite(fileSize) || fileSize <= 0) throw new Error("文件大小无效。");
  if (fileSize > config.maxFileSizeBytes) throw new Error(`文件不能超过 ${Math.round(config.maxFileSizeBytes / 1024 / 1024)}MB。`);
  if (!ALLOWED_ATTACHMENT_MIME_TYPES.has(mimeType)) throw new Error("文件类型不允许上传。");
  if (BLOCKED_ATTACHMENT_EXTENSIONS.has(ext)) throw new Error("该文件扩展名不允许上传。");

  return { fileName, fileSize, mimeType, maxFileSizeBytes: config.maxFileSizeBytes };
}

function safeCustomerId(customerId: string) {
  const safe = String(customerId || "").replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safe) throw new Error("客户 ID 无效。");
  return safe;
}

export function generateCustomerAttachmentObjectKey(customerId: string, fileName: string, now = new Date()) {
  const customerKey = safeCustomerId(customerId);
  const year = String(now.getFullYear());
  const safeFileName = sanitizeOssFileName(fileName);
  return `customers/${customerKey}/${year}/${crypto.randomUUID()}-${safeFileName}`;
}

export function assertCustomerOssObjectKey(customerId: string, objectKey: string) {
  const key = String(objectKey || "");
  const prefix = `customers/${safeCustomerId(customerId)}/`;
  const rest = key.slice(prefix.length);
  const generatedKeyPattern = /^\d{4}\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}-[^/]+$/i;
  if (!key.startsWith(prefix) || key.includes("..") || key.includes("\\") || key.includes("//") || !generatedKeyPattern.test(rest)) {
    throw new Error("OSS objectKey 无效。");
  }
  return key;
}

export function generatePutSignedUrl(customerId: string, input: OssUploadRequest) {
  const normalized = validateOssUploadRequest(input);
  const config = getOssConfig();
  const objectKey = generateCustomerAttachmentObjectKey(customerId, normalized.fileName);
  const client = createOssClient(config);
  const uploadUrl = client.signatureUrl(objectKey, {
    method: "PUT",
    expires: config.signedUrlExpiresSeconds,
    "Content-Type": normalized.mimeType
  });
  return {
    uploadUrl,
    objectKey,
    expiresAt: new Date(Date.now() + config.signedUrlExpiresSeconds * 1000).toISOString(),
    mimeType: normalized.mimeType,
    fileSize: normalized.fileSize
  };
}

export function generateGetSignedUrl(objectKey: string) {
  const config = getOssConfig();
  const client = createOssClient(config);
  return {
    downloadUrl: client.signatureUrl(objectKey, {
      method: "GET",
      expires: config.signedUrlExpiresSeconds
    }),
    expiresAt: new Date(Date.now() + config.signedUrlExpiresSeconds * 1000).toISOString()
  };
}

export async function deleteOssObject(objectKey: string) {
  const client = createOssClient();
  await client.delete(objectKey);
}
