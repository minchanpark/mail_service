import { createHash } from "node:crypto";

export function buildThreadId(accountId: string, providerMessageId: string) {
  return createHash("sha1")
    .update(`${accountId}:${providerMessageId}`)
    .digest("hex")
    .slice(0, 20);
}

export function formatAttachmentSize(bytes: number | undefined | null) {
  if (!bytes || bytes <= 0) {
    return "0 KB";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
