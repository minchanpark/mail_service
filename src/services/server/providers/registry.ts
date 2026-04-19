import { createImapDriver } from "@/services/server/providers/imap/driver";
import type { MailProviderDriver } from "@/services/server/providers/types";
import type { ProviderId } from "@/models";

const drivers = new Map<ProviderId, MailProviderDriver>([
  ["gmail", createImapDriver("gmail")],
  ["outlook", createImapDriver("outlook")],
  ["naver", createImapDriver("naver")],
  ["custom-imap", createImapDriver("custom-imap")],
]);

export function getProviderDriver(providerId: ProviderId) {
  const driver = drivers.get(providerId);
  if (!driver) {
    throw new Error(`지원하지 않는 provider입니다: ${providerId}`);
  }

  return driver;
}

export function listProviderDescriptors() {
  return [...drivers.values()].map((driver) => driver.descriptor);
}
