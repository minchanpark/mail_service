import { createImapDriver } from "@/lib/server/providers/imap/driver";
import { mockProviderDriver } from "@/lib/server/providers/mock";
import type { MailProviderDriver } from "@/lib/server/providers/types";
import type { ProviderId } from "@/lib/shared/types";

const drivers = new Map<ProviderId, MailProviderDriver>([
  ["mock", mockProviderDriver],
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
