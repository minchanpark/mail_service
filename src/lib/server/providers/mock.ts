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
  async syncInbox(account, options) {
    const state = createSeedState();
    const offset = Math.max(0, options?.offset ?? 0);
    const limit = Math.max(1, options?.limit ?? 5);
    const sourceThreads = state.threads.slice(offset, offset + limit);
    return sourceThreads.map((thread, index) => ({
      ...thread,
      id: `${account.id}-mock-${offset + index + 1}`,
      accountId: account.id,
      userId: account.userId,
      summary: {
        ...thread.summary,
        model: "mock-driver",
      },
    }));
  },
  async sendMail(input) {
    return {
      accepted: input.to,
      rejected: [],
      providerMessageId: `mock-${Date.now()}`,
      deliverySummary: "Mock SMTP 전송 시뮬레이션",
    };
  },
};
