import { randomUUID } from "node:crypto";

import { getProviderDriver, listProviderDescriptors } from "@/lib/server/providers/registry";
import { mutateState, readState } from "@/lib/server/store/file-store";
import {
  createBriefing,
  generateReplyVariants,
  generateSummary,
} from "@/lib/server/services/ai-service";
import type {
  Account,
  Briefing,
  ConnectAccountPayload,
  ProviderDescriptor,
  Thread,
  ThreadFilter,
  ThreadSummary,
} from "@/lib/shared/types";

function sanitizeAccount(account: {
  secrets?: Record<string, string>;
  settings?: Record<string, string>;
} & Account): Account {
  const { secrets: _secrets, settings: _settings, ...publicAccount } = account;
  return publicAccount;
}

function recalculateUnreadCounts(threads: Thread[], accountId: string) {
  return threads.filter((thread) => thread.accountId === accountId && thread.unread && !thread.archived).length;
}

function applyThreadFilter(items: Thread[], filter: ThreadFilter) {
  let next = [...items];

  if (filter.kind === "unread") {
    next = next.filter((item) => item.unread);
  }

  if (filter.kind === "needsReply") {
    next = next.filter((item) => item.hasAction);
  }

  if (filter.kind === "starred") {
    next = next.filter((item) => item.starred);
  }

  if (filter.kind === "snoozed") {
    next = next.filter((item) => Boolean(item.snoozedUntil));
  }

  if (filter.accountId) {
    next = next.filter((item) => item.accountId === filter.accountId);
  }

  if (filter.category) {
    next = next.filter((item) => item.category === filter.category);
  }

  if (filter.labelId) {
    const labelId = filter.labelId;
    next = next.filter((item) => item.labelIds.includes(labelId));
  }

  if (filter.query) {
    const keyword = filter.query.toLowerCase();
    next = next.filter((item) =>
      [
        item.from,
        item.fromEmail,
        item.subject,
        item.preview,
        item.bodyText ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }

  return next
    .filter((item) => !item.archived || filter.kind === "snoozed")
    .sort((a, b) => +new Date(b.receivedAt) - +new Date(a.receivedAt));
}

function mergeThreads(current: Thread[], incoming: Thread[]) {
  const map = new Map(current.map((thread) => [thread.id, thread]));
  for (const thread of incoming) {
    map.set(thread.id, thread);
  }
  return [...map.values()];
}

export async function getCurrentUser() {
  const state = await readState();
  return state.user;
}

export async function listAccounts() {
  const state = await readState();
  return state.accounts.map((account) =>
    sanitizeAccount({
      ...account,
      unreadCount: recalculateUnreadCounts(state.threads, account.id),
    }),
  );
}

export async function listLabels() {
  const state = await readState();
  return state.labels;
}

export async function createLabel(input: { name: string; color: string }) {
  return mutateState((draft) => {
    const label = {
      id: randomUUID(),
      userId: draft.user.id,
      name: input.name,
      color: input.color,
    };
    draft.labels.push(label);
    return label;
  });
}

export async function updateLabel(labelId: string, patch: { name?: string; color?: string }) {
  return mutateState((draft) => {
    const label = draft.labels.find((candidate) => candidate.id === labelId);
    if (!label) {
      throw new Error("라벨을 찾을 수 없습니다.");
    }

    Object.assign(label, patch);
    return label;
  });
}

export async function removeLabel(labelId: string) {
  return mutateState((draft) => {
    draft.labels = draft.labels.filter((label) => label.id !== labelId);
    draft.threads = draft.threads.map((thread) => ({
      ...thread,
      labelIds: thread.labelIds.filter((id) => id !== labelId),
    }));
  });
}

export async function listAvailableProviders(): Promise<ProviderDescriptor[]> {
  return listProviderDescriptors();
}

export async function connectAccount(payload: ConnectAccountPayload) {
  const state = await readState();
  const driver = getProviderDriver(payload.driverId);
  const prepared = await driver.prepareAccount(payload);

  const account = {
    id: randomUUID(),
    userId: state.user.id,
    driverId: payload.driverId,
    provider: prepared.provider,
    email: payload.email,
    label: prepared.label,
    unreadCount: 0,
    status: "active" as const,
    connectedAt: new Date().toISOString(),
    lastSyncedAt: new Date().toISOString(),
    connectionSummary: prepared.connectionSummary,
    secrets: prepared.secrets,
    settings: prepared.settings,
  };

  const syncedThreads = await driver.syncInbox(account);

  return mutateState((draft) => {
    draft.accounts.push({
      ...account,
      unreadCount: recalculateUnreadCounts(syncedThreads, account.id),
    });
    draft.threads = mergeThreads(draft.threads, syncedThreads);

    return sanitizeAccount({
      ...account,
      unreadCount: recalculateUnreadCounts(draft.threads, account.id),
    });
  });
}

export async function listThreads(filter: ThreadFilter) {
  const state = await readState();
  return {
    items: applyThreadFilter(state.threads, filter),
  };
}

export async function getThread(threadId: string) {
  const state = await readState();
  return state.threads.find((thread) => thread.id === threadId) ?? null;
}

export async function updateThread(threadId: string, patch: Partial<Thread>) {
  return mutateState((draft) => {
    const index = draft.threads.findIndex((thread) => thread.id === threadId);
    if (index < 0) {
      throw new Error("메일을 찾을 수 없습니다.");
    }

    const updated = {
      ...draft.threads[index],
      ...patch,
    };

    draft.threads[index] = updated;

    const account = draft.accounts.find((candidate) => candidate.id === updated.accountId);
    if (account) {
      account.unreadCount = recalculateUnreadCounts(draft.threads, account.id);
      account.lastSyncedAt = new Date().toISOString();
    }

    return updated;
  });
}

export async function summarizeThread(threadId: string): Promise<ThreadSummary> {
  return mutateState((draft) => {
    const thread = draft.threads.find((candidate) => candidate.id === threadId);
    if (!thread) {
      throw new Error("메일을 찾을 수 없습니다.");
    }

    const summary = generateSummary(thread);
    thread.summary = summary;
    return summary;
  });
}

export async function generateReply(threadId: string) {
  const thread = await getThread(threadId);
  if (!thread) {
    throw new Error("메일을 찾을 수 없습니다.");
  }

  return {
    variants: generateReplyVariants(thread),
  };
}

export async function getBriefing(): Promise<Briefing> {
  const state = await readState();
  return createBriefing(state.threads);
}
