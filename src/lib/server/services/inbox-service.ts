import { randomUUID } from "node:crypto";

import { getProviderDriver, listProviderDescriptors } from "@/lib/server/providers/registry";
import { mutateState, readState } from "@/lib/server/store/file-store";
import {
  classifyThread,
  createBriefing,
  generateMailDraftVariants,
  generateReplyVariants,
  generateSummary,
} from "@/lib/server/services/ai-service";
import { compactThreadForStorage, sortThreadsByReceivedAt } from "@/lib/shared/thread-persistence";
import type {
  Account,
  Briefing,
  ConnectAccountPayload,
  GenerateMailDraftPayload,
  MailDraftVariant,
  ProviderDescriptor,
  SendMailPayload,
  SendMailResult,
  Thread,
  ThreadFilter,
  ThreadListResponse,
  ThreadSummary,
} from "@/lib/shared/types";

const accountBackfillTasks = new Map<string, Promise<boolean>>();
const INITIAL_REMOTE_SYNC_BATCH = 25;
const REMOTE_BACKFILL_BATCH = 25;

function sanitizeAccount(account: {
  secrets?: Record<string, string>;
  settings?: Record<string, string>;
} & Account): Account {
  const { secrets: _secrets, settings: _settings, ...publicAccount } = account;
  return publicAccount;
}

function isSentThread(thread: Thread) {
  return thread.direction === "sent";
}

function recalculateUnreadCounts(threads: Thread[], accountId: string) {
  return threads.filter((thread) => thread.accountId === accountId && thread.unread && !thread.archived && !isSentThread(thread)).length;
}

function applyThreadFilter(items: Thread[], filter: ThreadFilter) {
  let next = [...items];

  if (filter.kind === "sent") {
    next = next.filter((item) => isSentThread(item));
  } else {
    next = next.filter((item) => !isSentThread(item));
  }

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
        ...(item.to ?? []),
        ...(item.cc ?? []),
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }

  return next.filter((item) => !item.archived || filter.kind === "snoozed");
}

function paginateThreads(items: Thread[], filter: ThreadFilter): ThreadListResponse {
  const total = items.length;

  if (!filter.pageSize) {
    return {
      items,
      page: 1,
      pageSize: total,
      total,
      hasMore: false,
    };
  }

  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.max(1, filter.pageSize);
  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  return {
    items: items.slice(start, end),
    page,
    pageSize,
    total,
    hasMore: end < total,
  };
}

function mergeThreads(current: Thread[], incoming: Thread[]) {
  const map = new Map(current.map((thread) => [thread.id, thread]));
  for (const thread of incoming) {
    map.set(thread.id, thread);
  }
  return sortThreadsByReceivedAt([...map.values()]);
}

function hasCompletedInitialSync(account: {
  driverId: Account["driverId"];
  settings?: Record<string, string>;
}) {
  return account.driverId === "mock" || account.settings?.initialSyncComplete === "true";
}

function buildSyncedSettings(
  settings: Record<string, string> | undefined,
  syncedCount: number,
  hasMoreRemoteMessages: boolean,
) {
  return {
    ...(settings ?? {}),
    initialSyncComplete: String(!hasMoreRemoteMessages),
    hasMoreRemoteMessages: String(hasMoreRemoteMessages),
    syncedMessageCount: String(syncedCount),
  };
}

function getReceivedThreadCount(threads: Thread[], accountId: string) {
  return threads.filter((thread) => thread.accountId === accountId && !isSentThread(thread)).length;
}

function normalizeAddresses(addresses: string[] | undefined) {
  const normalized = (addresses ?? [])
    .map((address) => address.trim())
    .filter(Boolean);

  return [...new Set(normalized)];
}

function ensureOriginalThread(payload: SendMailPayload, thread: Thread | null) {
  if (payload.mode !== "compose" && !thread) {
    throw new Error("원본 메일을 찾을 수 없습니다.");
  }
}

function createSentThread(input: {
  account: Account & {
    secrets?: Record<string, string>;
    settings?: Record<string, string>;
  };
  originalThread: Thread | null;
  payload: SendMailPayload;
  accepted: string[];
  providerMessageId?: string;
  userName: string;
}) {
  const sentAt = new Date().toISOString();
  const to = normalizeAddresses(input.payload.to);
  const cc = normalizeAddresses(input.payload.cc);
  const bcc = normalizeAddresses(input.payload.bcc);
  const preview = input.payload.body.trim().replace(/\s+/g, " ").slice(0, 160) || input.payload.subject;
  const category = input.originalThread?.category ?? classifyThread({
    fromEmail: to[0] ?? input.account.email,
    subject: input.payload.subject,
    preview,
  });

  const baseThread: Thread = {
    id: `sent-${randomUUID()}`,
    userId: input.account.userId,
    accountId: input.account.id,
    from: input.userName,
    fromEmail: input.account.email,
    to,
    cc,
    bcc,
    subject: input.payload.subject.trim(),
    preview,
    receivedAt: sentAt,
    unread: false,
    starred: false,
    archived: false,
    snoozedUntil: null,
    direction: "sent",
    sentMode: input.payload.mode,
    sourceThreadId: input.originalThread?.id ?? null,
    providerMessageId: input.providerMessageId,
    category,
    labelIds: input.originalThread?.labelIds ?? [],
    attachments: [],
    hasAction: false,
    bodyText: input.payload.body.trim(),
    summary: {
      oneLine: "",
      threeLines: [],
      status: "pending",
      model: "local-compose",
      updatedAt: sentAt,
    },
  };

  return compactThreadForStorage({
    ...baseThread,
    summary: generateSummary(baseThread),
  });
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

  const syncedThreads = await driver.syncInbox(account, {
    offset: 0,
    limit: INITIAL_REMOTE_SYNC_BATCH,
  });
  const syncedSettings = buildSyncedSettings(
    account.settings,
    syncedThreads.length,
    syncedThreads.length === INITIAL_REMOTE_SYNC_BATCH,
  );

  return mutateState((draft) => {
    draft.accounts.push({
      ...account,
      settings: syncedSettings,
      unreadCount: recalculateUnreadCounts(syncedThreads, account.id),
    });
    draft.threads = mergeThreads(draft.threads, syncedThreads);

    return sanitizeAccount({
      ...account,
      settings: syncedSettings,
      unreadCount: recalculateUnreadCounts(draft.threads, account.id),
    });
  });
}

async function backfillAccountThreads(accountId: string, limit: number) {
  const currentTask = accountBackfillTasks.get(accountId);
  if (currentTask) {
    return currentTask;
  }

  const task = (async () => {
    const state = await readState();
    const account = state.accounts.find((candidate) => candidate.id === accountId);

    if (!account || account.driverId === "mock" || account.settings?.hasMoreRemoteMessages === "false") {
      return false;
    }

    try {
      const driver = getProviderDriver(account.driverId);
      const offset = getReceivedThreadCount(state.threads, accountId);
      const syncedThreads = await driver.syncInbox(account, {
        offset,
        limit,
      });

      await mutateState((draft) => {
        const accountDraft = draft.accounts.find((candidate) => candidate.id === accountId);
        if (!accountDraft) {
          return;
        }

        draft.threads = mergeThreads(draft.threads, syncedThreads);
        accountDraft.lastSyncedAt = new Date().toISOString();
        accountDraft.settings = buildSyncedSettings(
          accountDraft.settings,
          getReceivedThreadCount(draft.threads, accountDraft.id),
          syncedThreads.length === limit,
        );
        accountDraft.unreadCount = recalculateUnreadCounts(draft.threads, accountDraft.id);
      });
      return syncedThreads.length > 0;
    } catch (error) {
      console.error(`[mail-service] remote backfill failed for account ${accountId}`, error);
      return false;
    }
  })().finally(() => {
    accountBackfillTasks.delete(accountId);
  });

  accountBackfillTasks.set(accountId, task);
  return task;
}

async function ensureRelevantAccountsBackfilled(filter: ThreadFilter) {
  if (filter.kind === "sent" || !filter.pageSize || !filter.page) {
    return;
  }

  // Search and narrow facet views should stay responsive instead of
  // draining the remote mailbox to fill one sparse page.
  if (filter.query || filter.labelId || filter.category) {
    return;
  }

  const targetCount = filter.page * filter.pageSize;

  while (true) {
    const state = await readState();
    const currentCount = applyThreadFilter(state.threads, filter).length;
    if (currentCount >= targetCount) {
      return;
    }

    const relevantAccountIds = (filter.accountId
      ? state.accounts.filter((account) => account.id === filter.accountId)
      : state.accounts
    )
      .filter((account) => account.driverId !== "mock" && account.settings?.hasMoreRemoteMessages !== "false")
      .map((account) => account.id);

    if (relevantAccountIds.length === 0) {
      return;
    }

    let progressed = false;

    for (const accountId of relevantAccountIds) {
      const didBackfill = await backfillAccountThreads(accountId, REMOTE_BACKFILL_BATCH);
      if (didBackfill) {
        progressed = true;
      }

      const refreshedState = await readState();
      const refreshedCount = applyThreadFilter(refreshedState.threads, filter).length;
      if (refreshedCount >= targetCount) {
        return;
      }
    }

    if (!progressed) {
      return;
    }
  }
}

export async function listThreads(filter: ThreadFilter) {
  await ensureRelevantAccountsBackfilled(filter);
  const state = await readState();
  return paginateThreads(applyThreadFilter(state.threads, filter), filter);
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

export async function generateMailDrafts(payload: GenerateMailDraftPayload): Promise<{ variants: MailDraftVariant[] }> {
  const state = await readState();
  const thread = payload.threadId
    ? state.threads.find((candidate) => candidate.id === payload.threadId) ?? null
    : null;

  if (payload.mode !== "compose" && !thread) {
    throw new Error("원본 메일을 찾을 수 없습니다.");
  }

  return {
    variants: generateMailDraftVariants({
      mode: payload.mode,
      thread,
      prompt: payload.prompt,
      subject: payload.subject,
      body: payload.body,
    }),
  };
}

export async function sendMail(payload: SendMailPayload): Promise<SendMailResult> {
  const state = await readState();
  const account = state.accounts.find((candidate) => candidate.id === payload.accountId);

  if (!account) {
    throw new Error("메일 계정을 찾을 수 없습니다.");
  }

  const originalThread = payload.threadId
    ? state.threads.find((candidate) => candidate.id === payload.threadId) ?? null
    : null;

  ensureOriginalThread(payload, originalThread);

  const to = normalizeAddresses(payload.to);
  const cc = normalizeAddresses(payload.cc);
  const bcc = normalizeAddresses(payload.bcc);
  const subject = payload.subject.trim();
  const body = payload.body.trim();

  if (to.length === 0) {
    throw new Error("받는 사람 이메일이 필요합니다.");
  }

  if (!subject) {
    throw new Error("제목을 입력해 주세요.");
  }

  if (!body) {
    throw new Error("본문을 입력해 주세요.");
  }

  const driver = getProviderDriver(account.driverId);
  const receipt = await driver.sendMail({
    account,
    mode: payload.mode,
    originalThread,
    to,
    cc,
    bcc,
    subject,
    body,
  });

  const sentThread = createSentThread({
    account,
    originalThread,
    payload: {
      ...payload,
      to,
      cc,
      bcc,
      subject,
      body,
    },
    accepted: receipt.accepted,
    providerMessageId: receipt.providerMessageId,
    userName: state.user.displayName,
  });

  return mutateState((draft) => {
    draft.threads = mergeThreads(draft.threads, [sentThread]);

    const accountDraft = draft.accounts.find((candidate) => candidate.id === account.id);
    if (accountDraft) {
      accountDraft.lastSyncedAt = new Date().toISOString();
      accountDraft.unreadCount = recalculateUnreadCounts(draft.threads, account.id);
    }

    if (originalThread && payload.mode === "reply") {
      const sourceThread = draft.threads.find((candidate) => candidate.id === originalThread.id);
      if (sourceThread) {
        sourceThread.unread = false;
        sourceThread.hasAction = false;
        sourceThread.summary = generateSummary(sourceThread);
      }
    }

    return {
      thread: sentThread,
      accepted: receipt.accepted,
      rejected: receipt.rejected,
      provider: account.provider,
      deliverySummary: receipt.deliverySummary,
    };
  });
}

export async function getBriefing(): Promise<Briefing> {
  const state = await readState();
  return createBriefing(state.threads);
}
