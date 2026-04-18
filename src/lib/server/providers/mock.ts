import { createSeedState } from "@/lib/server/store/seed";
import type { MailProviderDriver } from "@/lib/server/providers/types";
import type { ConnectAccountPayload } from "@/lib/shared/types";

export const mockProviderDriver: MailProviderDriver = {
  descriptor: {
    id: "mock",
    label: "Mock Demo",
    description: "실제 계정 없이 데모용 메일 데이터를 연결합니다.",
    authType: "demo",
    provider: "mock",
    fields: [],
  },
  async prepareAccount(input: ConnectAccountPayload) {
    return {
      provider: "mock",
      label: input.label?.trim() || "Demo Inbox",
      connectionSummary: "Mock 데이터셋 기반 데모 연결",
    };
  },
  async syncInbox(account) {
    const state = createSeedState();
    const sourceThreads = state.threads.slice(0, 5);
    return sourceThreads.map((thread, index) => ({
      ...thread,
      id: `${account.id}-mock-${index + 1}`,
      accountId: account.id,
      userId: account.userId,
      summary: {
        ...thread.summary,
        model: "mock-driver",
      },
    }));
  },
};
