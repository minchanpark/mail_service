"use client";

import type {
  Account,
  Briefing,
  ConnectAccountPayload,
  GenerateMailDraftPayload,
  Label,
  MailDraftVariant,
  ProviderDescriptor,
  ReplyVariant,
  SendMailPayload,
  SendMailResult,
  Thread,
  ThreadFilter,
  ThreadListResponse,
  ThreadSummary,
  User,
} from "@/models";

export type ResourceKey = "auth" | "accounts" | "threads" | "labels" | "briefing" | "providers";

type Unsubscribe = () => void;

export type MailApiService = {
  name: string;
  subscribeResource: (resource: ResourceKey, callback: () => void) => Unsubscribe;
  auth: {
    getCurrentUser: () => Promise<User | null>;
    onAuthChange: (callback: (user: User | null) => void) => Unsubscribe;
    signIn: () => Promise<User>;
    signOut: () => Promise<void>;
  };
  accounts: {
    list: () => Promise<Account[]>;
    connect: (payload: ConnectAccountPayload) => Promise<Account>;
    disconnect: (accountId: string) => Promise<void>;
  };
  threads: {
    list: (filter: ThreadFilter) => Promise<ThreadListResponse>;
    get: (id: string) => Promise<Thread | null>;
    update: (id: string, patch: Partial<Thread>) => Promise<Thread>;
    subscribe: (filter: ThreadFilter, callback: (result: ThreadListResponse) => void) => Unsubscribe;
  };
  ai: {
    summarize: (threadId: string) => Promise<ThreadSummary>;
    generateReply: (threadId: string) => Promise<{ variants: ReplyVariant[] }>;
    generateDraft: (payload: GenerateMailDraftPayload) => Promise<{ variants: MailDraftVariant[] }>;
  };
  mail: {
    send: (payload: SendMailPayload) => Promise<SendMailResult>;
  };
  labels: {
    list: () => Promise<Label[]>;
    create: (payload: Pick<Label, "name" | "color">) => Promise<Label>;
    update: (id: string, payload: Partial<Pick<Label, "name" | "color">>) => Promise<Label>;
    remove: (id: string) => Promise<void>;
  };
  briefing: {
    getDaily: () => Promise<Briefing>;
  };
  catalog: {
    listProviders: () => Promise<ProviderDescriptor[]>;
  };
};

function createEmitter() {
  const listeners = new Map<ResourceKey, Set<() => void>>();

  return {
    subscribe(resource: ResourceKey, callback: () => void) {
      const set = listeners.get(resource) ?? new Set<() => void>();
      set.add(callback);
      listeners.set(resource, set);

      return () => {
        set.delete(callback);
      };
    },
    emit(...resources: ResourceKey[]) {
      for (const resource of resources) {
        for (const callback of listeners.get(resource) ?? []) {
          callback();
        }
      }
    },
  };
}

async function request<T>(input: string, init?: RequestInit) {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const data = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(data.error ?? "요청 처리에 실패했습니다.");
  }

  return data as T;
}

function buildThreadListUrl(filter: ThreadFilter) {
  const searchParams = new URLSearchParams();
  searchParams.set("kind", filter.kind);
  if (filter.accountId) {
    searchParams.set("accountId", filter.accountId);
  }
  if (filter.category) {
    searchParams.set("category", filter.category);
  }
  if (filter.labelId) {
    searchParams.set("labelId", filter.labelId);
  }
  if (filter.query) {
    searchParams.set("query", filter.query);
  }
  if (filter.page) {
    searchParams.set("page", String(filter.page));
  }
  if (filter.pageSize) {
    searchParams.set("pageSize", String(filter.pageSize));
  }
  return `/api/threads?${searchParams.toString()}`;
}

export function createMailApiService(): MailApiService {
  const emitter = createEmitter();

  return {
    name: "next-route-handler",
    subscribeResource(resource, callback) {
      return emitter.subscribe(resource, callback);
    },
    auth: {
      getCurrentUser: () => request<User>("/api/auth/me"),
      onAuthChange(callback) {
        let active = true;
        request<User>("/api/auth/me")
          .then((user) => {
            if (active) {
              callback(user);
            }
          })
          .catch(() => {
            if (active) {
              callback(null);
            }
          });

        return () => {
          active = false;
        };
      },
      signIn: async () => {
        throw new Error("현재 데모 앱에서는 별도 로그인 플로우를 구현하지 않았습니다.");
      },
      signOut: async () => undefined,
    },
    accounts: {
      list: () => request<Account[]>("/api/accounts"),
      connect: async (payload) => {
        const account = await request<Account>("/api/accounts/connect", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        emitter.emit("accounts", "threads", "briefing");
        return account;
      },
      disconnect: async () => {
        throw new Error("계정 해제는 아직 구현하지 않았습니다.");
      },
    },
    threads: {
      list: (filter) => request<ThreadListResponse>(buildThreadListUrl(filter)),
      get: async (id) => request<Thread>(`/api/threads/${id}`),
      update: async (id, patch) => {
        const thread = await request<Thread>(`/api/threads/${id}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        });
        emitter.emit("threads", "accounts", "briefing");
        return thread;
      },
      subscribe(filter, callback) {
        let active = true;

        const load = async () => {
          const result = await request<ThreadListResponse>(buildThreadListUrl(filter));

          if (active) {
            callback(result);
          }
        };

        void load();
        const unsubscribe = emitter.subscribe("threads", () => {
          void load();
        });

        return () => {
          active = false;
          unsubscribe();
        };
      },
    },
    ai: {
      summarize: async (threadId) => {
        const summary = await request<ThreadSummary>("/api/ai/summarize", {
          method: "POST",
          body: JSON.stringify({ threadId }),
        });
        emitter.emit("threads", "briefing");
        return summary;
      },
      generateReply: (threadId) =>
        request<{ variants: ReplyVariant[] }>("/api/ai/reply", {
          method: "POST",
          body: JSON.stringify({ threadId }),
        }),
      generateDraft: (payload) =>
        request<{ variants: MailDraftVariant[] }>("/api/ai/draft", {
          method: "POST",
          body: JSON.stringify(payload),
        }),
    },
    mail: {
      send: async (payload) => {
        const result = await request<SendMailResult>("/api/mail/send", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        emitter.emit("threads", "accounts", "briefing");
        return result;
      },
    },
    labels: {
      list: () => request<Label[]>("/api/labels"),
      create: async (payload) => {
        const label = await request<Label>("/api/labels", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        emitter.emit("labels", "threads");
        return label;
      },
      update: async (id, payload) => {
        const label = await request<Label>(`/api/labels/${id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        emitter.emit("labels", "threads");
        return label;
      },
      remove: async (id) => {
        await request<void>(`/api/labels/${id}`, {
          method: "DELETE",
        });
        emitter.emit("labels", "threads");
      },
    },
    briefing: {
      getDaily: () => request<Briefing>("/api/briefing"),
    },
    catalog: {
      listProviders: () => request<ProviderDescriptor[]>("/api/accounts/providers"),
    },
  };
}

export const createHttpBackend = createMailApiService;
export type BackendAdapter = MailApiService;
