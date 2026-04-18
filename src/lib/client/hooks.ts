"use client";

import {
  startTransition,
  useEffect,
  useEffectEvent,
  useState,
} from "react";

import { useBackend } from "@/lib/client/backend-context";
import type { ResourceKey } from "@/lib/client/http-backend";
import type {
  Account,
  Briefing,
  Label,
  ProviderDescriptor,
  Thread,
  ThreadFilter,
  ThreadSummary,
  User,
} from "@/lib/shared/types";

type AsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

function useResourceQuery<T>(resource: ResourceKey, fetcher: () => Promise<T>, deps: unknown[] = []) {
  const backend = useBackend();
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const run = useEffectEvent(async () => {
    try {
      const data = await fetcher();
      startTransition(() => {
        setState({
          data,
          loading: false,
          error: null,
        });
      });
    } catch (error) {
      startTransition(() => {
        setState({
          data: null,
          loading: false,
          error: error instanceof Error ? error.message : "데이터를 불러오지 못했습니다.",
        });
      });
    }
  });

  useEffect(() => {
    let active = true;
    setState((current) => ({
      ...current,
      loading: true,
      error: null,
    }));

    void run();
    const unsubscribe = backend.subscribeResource(resource, () => {
      if (active) {
        void run();
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [backend, resource, run, ...deps]);

  return state;
}

export function useCurrentUser() {
  const backend = useBackend();
  return useResourceQuery<User | null>("auth", () => backend.auth.getCurrentUser());
}

export function useAccounts() {
  const backend = useBackend();
  return useResourceQuery<Account[]>("accounts", () => backend.accounts.list());
}

export function useLabels() {
  const backend = useBackend();
  return useResourceQuery<Label[]>("labels", () => backend.labels.list());
}

export function useBriefing() {
  const backend = useBackend();
  return useResourceQuery<Briefing>("briefing", () => backend.briefing.getDaily());
}

export function useProviderCatalog() {
  const backend = useBackend();
  return useResourceQuery<ProviderDescriptor[]>("providers", () => backend.catalog.listProviders());
}

export function useThread(threadId: string | null) {
  const backend = useBackend();
  return useResourceQuery<Thread | null>(
    "threads",
    () => (threadId ? backend.threads.get(threadId) : Promise.resolve(null)),
    [threadId],
  );
}

export function useThreads(filter: ThreadFilter) {
  const backend = useBackend();
  const [state, setState] = useState<AsyncState<Thread[]>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    setState((current) => ({
      ...current,
      loading: true,
      error: null,
    }));

    const unsubscribe = backend.threads.subscribe(filter, (items) => {
      startTransition(() => {
        setState({
          data: items,
          loading: false,
          error: null,
        });
      });
    });

    return unsubscribe;
  }, [backend, filter.accountId, filter.category, filter.kind, filter.labelId, filter.query]);

  return state;
}

export function useUpdateThread() {
  const backend = useBackend();
  return (threadId: string, patch: Partial<Thread>) => backend.threads.update(threadId, patch);
}

export function useGenerateReply() {
  const backend = useBackend();
  const [state, setState] = useState<{
    loading: boolean;
    variants: { label: string; body: string }[] | null;
    error: string | null;
  }>({
    loading: false,
    variants: null,
    error: null,
  });

  return {
    ...state,
    run: async (threadId: string) => {
      setState({
        loading: true,
        variants: null,
        error: null,
      });

      try {
        const result = await backend.ai.generateReply(threadId);
        setState({
          loading: false,
          variants: result.variants,
          error: null,
        });
        return result;
      } catch (error) {
        setState({
          loading: false,
          variants: null,
          error: error instanceof Error ? error.message : "답장 초안을 생성하지 못했습니다.",
        });
        throw error;
      }
    },
  };
}

export function useSummarizeThread() {
  const backend = useBackend();
  return (threadId: string): Promise<ThreadSummary> => backend.ai.summarize(threadId);
}
