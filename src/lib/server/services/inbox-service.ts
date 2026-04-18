import { randomUUID } from "node:crypto";

import { getProviderDriver, listProviderDescriptors } from "@/lib/server/providers/registry";
import { mutateState, readState } from "@/lib/server/store/file-store";
import { loadAccountSecrets, storeAccountSecrets } from "@/lib/server/store/secret-store";
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
  Label,
  MailDraftVariant,
  ProviderDescriptor,
  SendMailPayload,
  SendMailResult,
  StoredAccount,
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
  secretRef?: string;
  settings?: Record<string, string>;
} & Account): Account {
  const { secrets: _secrets, secretRef: _secretRef, settings: _settings, ...publicAccount } = account;
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

function normalizeLabelName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

function normalizeLabelIds(labelIds: string[] | undefined, labels: Label[]) {
  const allowedIds = new Set(labels.map((label) => label.id));
  return [...new Set((labelIds ?? []).filter((labelId) => allowedIds.has(labelId)))];
}

function ensureViewerMatchesStateUser(viewerUserId: string, state: { user: { id: string } }) {
  if (state.user.id !== viewerUserId) {
    throw new Error("사용자를 찾을 수 없습니다.");
  }
}

function getUserAccounts(accounts: StoredAccount[], viewerUserId: string) {
  return accounts.filter((account) => account.userId === viewerUserId);
}

function getUserThreads(threads: Thread[], viewerUserId: string) {
  return threads.filter((thread) => thread.userId === viewerUserId);
}

function getUserLabels(labels: Label[], viewerUserId: string) {
  return labels.filter((label) => label.userId === viewerUserId);
}

function requireOwnedAccount(accounts: StoredAccount[], viewerUserId: string, accountId: string) {
  const account = accounts.find((candidate) => candidate.id === accountId && candidate.userId === viewerUserId);
  if (!account) {
    throw new Error("메일 계정을 찾을 수 없습니다.");
  }

  return account;
}

function requireOwnedThread(threads: Thread[], viewerUserId: string, threadId: string, message = "메일을 찾을 수 없습니다.") {
  const thread = threads.find((candidate) => candidate.id === threadId && candidate.userId === viewerUserId);
  if (!thread) {
    throw new Error(message);
  }

  return thread;
}

function requireOwnedLabel(labels: Label[], viewerUserId: string, labelId: string) {
  const label = labels.find((candidate) => candidate.id === labelId && candidate.userId === viewerUserId);
  if (!label) {
    throw new Error("라벨을 찾을 수 없습니다.");
  }

  return label;
}

async function hydrateAccountSecrets<T extends StoredAccount>(account: T) {
  const secrets = await loadAccountSecrets(account);
  return {
    ...account,
    secrets,
  };
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

export async function listAccounts(viewerUserId: string) {
  const state = await readState();
  ensureViewerMatchesStateUser(viewerUserId, state);
  return getUserAccounts(state.accounts, viewerUserId).map((account) =>
    sanitizeAccount({
      ...account,
      unreadCount: recalculateUnreadCounts(state.threads, account.id),
    }),
  );
}

export async function listLabels(viewerUserId: string) {
  const state = await readState();
  ensureViewerMatchesStateUser(viewerUserId, state);
  return getUserLabels(state.labels, viewerUserId);
}

export async function createLabel(viewerUserId: string, input: { name: string; color: string }) {
  return mutateState((draft) => {
    ensureViewerMatchesStateUser(viewerUserId, draft);
    const name = normalizeLabelName(input.name);
    if (!name) {
      throw new Error("라벨 이름을 입력해 주세요.");
    }

    const duplicate = draft.labels.find((label) => label.userId === viewerUserId && label.name.toLowerCase() === name.toLowerCase());
    if (duplicate) {
      throw new Error("같은 이름의 라벨이 이미 있습니다.");
    }

    const label = {
      id: randomUUID(),
      userId: draft.user.id,
      name,
      color: input.color,
    };
    draft.labels.push(label);
    return label;
  });
}

export async function updateLabel(viewerUserId: string, labelId: string, patch: { name?: string; color?: string }) {
  return mutateState((draft) => {
    ensureViewerMatchesStateUser(viewerUserId, draft);
    const label = requireOwnedLabel(draft.labels, viewerUserId, labelId);

    const nextName = patch.name === undefined ? label.name : normalizeLabelName(patch.name);
    if (!nextName) {
      throw new Error("라벨 이름을 입력해 주세요.");
    }

    const duplicate = draft.labels.find(
      (candidate) => candidate.userId === viewerUserId && candidate.id !== labelId && candidate.name.toLowerCase() === nextName.toLowerCase(),
    );
    if (duplicate) {
      throw new Error("같은 이름의 라벨이 이미 있습니다.");
    }

    Object.assign(label, {
      ...patch,
      name: nextName,
    });
    return label;
  });
}

export async function removeLabel(viewerUserId: string, labelId: string) {
  return mutateState((draft) => {
    ensureViewerMatchesStateUser(viewerUserId, draft);
    requireOwnedLabel(draft.labels, viewerUserId, labelId);
    draft.labels = draft.labels.filter((label) => label.id !== labelId || label.userId !== viewerUserId);
    draft.threads = draft.threads.map((thread) =>
      thread.userId !== viewerUserId
        ? thread
        : {
            ...thread,
            labelIds: thread.labelIds.filter((id) => id !== labelId),
          },
    );
  });
}

export async function listAvailableProviders(): Promise<ProviderDescriptor[]> {
  return listProviderDescriptors();
}

export async function connectAccount(viewerUserId: string, payload: ConnectAccountPayload) {
  const state = await readState();
  ensureViewerMatchesStateUser(viewerUserId, state);
  const driver = getProviderDriver(payload.driverId);
  const prepared = await driver.prepareAccount(payload);
  const accountId = randomUUID();
  const secretRef = await storeAccountSecrets(accountId, prepared.secrets);

  const account = {
    id: accountId,
    userId: viewerUserId,
    driverId: payload.driverId,
    provider: prepared.provider,
    email: payload.email,
    label: prepared.label,
    unreadCount: 0,
    status: "active" as const,
    connectedAt: new Date().toISOString(),
    lastSyncedAt: new Date().toISOString(),
    connectionSummary: prepared.connectionSummary,
    secretRef,
    settings: prepared.settings,
  };

  const syncedThreads = await driver.syncInbox(
    {
      ...account,
      secrets: prepared.secrets,
    },
    {
      offset: 0,
      limit: INITIAL_REMOTE_SYNC_BATCH,
    },
  );
  const syncedSettings = buildSyncedSettings(
    account.settings,
    syncedThreads.length,
    syncedThreads.length === INITIAL_REMOTE_SYNC_BATCH,
  );

  return mutateState((draft) => {
    ensureViewerMatchesStateUser(viewerUserId, draft);
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

async function backfillAccountThreads(viewerUserId: string, accountId: string, limit: number) {
  const currentTask = accountBackfillTasks.get(accountId);
  if (currentTask) {
    return currentTask;
  }

  const task = (async () => {
    const state = await readState();
    ensureViewerMatchesStateUser(viewerUserId, state);
    const account = state.accounts.find((candidate) => candidate.id === accountId && candidate.userId === viewerUserId);

    if (!account || account.driverId === "mock" || account.settings?.hasMoreRemoteMessages === "false") {
      return false;
    }

    try {
      const driver = getProviderDriver(account.driverId);
      const offset = getReceivedThreadCount(state.threads, accountId);
      const syncedThreads = await driver.syncInbox(await hydrateAccountSecrets(account), {
        offset,
        limit,
      });

      await mutateState((draft) => {
        ensureViewerMatchesStateUser(viewerUserId, draft);
        const accountDraft = draft.accounts.find((candidate) => candidate.id === accountId && candidate.userId === viewerUserId);
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

async function ensureRelevantAccountsBackfilled(viewerUserId: string, filter: ThreadFilter) {
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
    ensureViewerMatchesStateUser(viewerUserId, state);
    const currentCount = applyThreadFilter(getUserThreads(state.threads, viewerUserId), filter).length;
    if (currentCount >= targetCount) {
      return;
    }

    const relevantAccountIds = (filter.accountId
      ? getUserAccounts(state.accounts, viewerUserId).filter((account) => account.id === filter.accountId)
      : getUserAccounts(state.accounts, viewerUserId)
    )
      .filter((account) => account.driverId !== "mock" && account.settings?.hasMoreRemoteMessages !== "false")
      .map((account) => account.id);

    if (relevantAccountIds.length === 0) {
      return;
    }

    let progressed = false;

    for (const accountId of relevantAccountIds) {
      const didBackfill = await backfillAccountThreads(viewerUserId, accountId, REMOTE_BACKFILL_BATCH);
      if (didBackfill) {
        progressed = true;
      }

      const refreshedState = await readState();
      ensureViewerMatchesStateUser(viewerUserId, refreshedState);
      const refreshedCount = applyThreadFilter(getUserThreads(refreshedState.threads, viewerUserId), filter).length;
      if (refreshedCount >= targetCount) {
        return;
      }
    }

    if (!progressed) {
      return;
    }
  }
}

export async function listThreads(viewerUserId: string, filter: ThreadFilter) {
  await ensureRelevantAccountsBackfilled(viewerUserId, filter);
  const state = await readState();
  ensureViewerMatchesStateUser(viewerUserId, state);
  return paginateThreads(applyThreadFilter(getUserThreads(state.threads, viewerUserId), filter), filter);
}

export async function getThread(viewerUserId: string, threadId: string) {
  const state = await readState();
  ensureViewerMatchesStateUser(viewerUserId, state);
  return state.threads.find((thread) => thread.id === threadId && thread.userId === viewerUserId) ?? null;
}

export async function updateThread(viewerUserId: string, threadId: string, patch: Partial<Thread>) {
  return mutateState((draft) => {
    ensureViewerMatchesStateUser(viewerUserId, draft);
    const index = draft.threads.findIndex((thread) => thread.id === threadId && thread.userId === viewerUserId);
    if (index < 0) {
      throw new Error("메일을 찾을 수 없습니다.");
    }

    const userLabels = getUserLabels(draft.labels, viewerUserId);
    const updated = {
      ...draft.threads[index],
      ...patch,
      labelIds: patch.labelIds ? normalizeLabelIds(patch.labelIds, userLabels) : draft.threads[index].labelIds,
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

export async function summarizeThread(viewerUserId: string, threadId: string): Promise<ThreadSummary> {
  return mutateState((draft) => {
    ensureViewerMatchesStateUser(viewerUserId, draft);
    const thread = requireOwnedThread(draft.threads, viewerUserId, threadId);

    const summary = generateSummary(thread);
    thread.summary = summary;
    return summary;
  });
}

export async function generateReply(viewerUserId: string, threadId: string) {
  const thread = await getThread(viewerUserId, threadId);
  if (!thread) {
    throw new Error("메일을 찾을 수 없습니다.");
  }

  return {
    variants: generateReplyVariants(thread),
  };
}

export async function generateMailDrafts(viewerUserId: string, payload: GenerateMailDraftPayload): Promise<{ variants: MailDraftVariant[] }> {
  const state = await readState();
  ensureViewerMatchesStateUser(viewerUserId, state);
  if (payload.accountId) {
    requireOwnedAccount(state.accounts, viewerUserId, payload.accountId);
  }
  const thread = payload.threadId
    ? state.threads.find((candidate) => candidate.id === payload.threadId && candidate.userId === viewerUserId) ?? null
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

export async function sendMail(viewerUserId: string, payload: SendMailPayload): Promise<SendMailResult> {
  const state = await readState();
  ensureViewerMatchesStateUser(viewerUserId, state);
  const account = requireOwnedAccount(state.accounts, viewerUserId, payload.accountId);
  const hydratedAccount = await hydrateAccountSecrets(account);

  const originalThread = payload.threadId
    ? state.threads.find((candidate) => candidate.id === payload.threadId && candidate.userId === viewerUserId) ?? null
    : null;

  ensureOriginalThread(payload, originalThread);
  if (originalThread && payload.mode !== "compose" && originalThread.accountId !== account.id) {
    throw new Error("원본 메일과 같은 계정으로만 답장 또는 전달할 수 있습니다.");
  }

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
    account: hydratedAccount,
    mode: payload.mode,
    originalThread,
    to,
    cc,
    bcc,
    subject,
    body,
  });

  const sentThread = createSentThread({
    account: hydratedAccount,
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
    ensureViewerMatchesStateUser(viewerUserId, draft);
    draft.threads = mergeThreads(draft.threads, [sentThread]);

    const accountDraft = draft.accounts.find((candidate) => candidate.id === account.id && candidate.userId === viewerUserId);
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

export async function getBriefing(viewerUserId: string): Promise<Briefing> {
  const state = await readState();
  ensureViewerMatchesStateUser(viewerUserId, state);
  return createBriefing(getUserThreads(state.threads, viewerUserId));
}
