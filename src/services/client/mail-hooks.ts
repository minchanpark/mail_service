"use client";

import {
  startTransition,
  useEffect,
  useState,
} from "react";

import type {
  Account,
  Briefing,
  GenerateMailDraftPayload,
  Label,
  MailDraftVariant,
  ProviderDescriptor,
  SendMailPayload,
  SendMailResult,
  Thread,
  ThreadFilter,
  ThreadListResponse,
  ThreadSummary,
  User,
} from "@/models";
import type { ResourceKey } from "@/services/api/mail-api-service";
import { useMailService } from "@/services/client/mail-service-context";

type AsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

function useResourceQuery<T>(resource: ResourceKey, fetcher: () => Promise<T>, deps: unknown[] = []) {
  const backend = useMailService();
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const data = await fetcher();
        if (!active) {
          return;
        }

        startTransition(() => {
          setState({
            data,
            loading: false,
            error: null,
          });
        });
      } catch (error) {
        if (!active) {
          return;
        }

        startTransition(() => {
          setState({
            data: null,
            loading: false,
            error: error instanceof Error ? error.message : "데이터를 불러오지 못했습니다.",
          });
        });
      }
    };

    setState((current) => ({
      ...current,
      loading: true,
      error: null,
    }));

    void load();
    const unsubscribe = backend.subscribeResource(resource, () => {
      if (active) {
        void load();
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [backend, resource, ...deps]);

  return state;
}

export function useCurrentUser() {
  const backend = useMailService();
  return useResourceQuery<User | null>("auth", () => backend.auth.getCurrentUser());
}

export function useAccounts() {
  const backend = useMailService();
  return useResourceQuery<Account[]>("accounts", () => backend.accounts.list());
}

export function useLabels() {
  const backend = useMailService();
  return useResourceQuery<Label[]>("labels", () => backend.labels.list());
}

export function useBriefing() {
  const backend = useMailService();
  return useResourceQuery<Briefing>("briefing", () => backend.briefing.getDaily());
}

export function useProviderCatalog() {
  const backend = useMailService();
  return useResourceQuery<ProviderDescriptor[]>("providers", () => backend.catalog.listProviders());
}

export function useThread(threadId: string | null) {
  const backend = useMailService();
  return useResourceQuery<Thread | null>(
    "threads",
    () => (threadId ? backend.threads.get(threadId) : Promise.resolve(null)),
    [threadId],
  );
}

export function useThreads(
  filter: ThreadFilter,
  options?: {
    paginated?: boolean;
    pageSize?: number;
  },
) {
  const backend = useMailService();
  const paginated = options?.paginated ?? false;
  const pageSize = options?.pageSize ?? 10;
  const filterKey = JSON.stringify({
    kind: filter.kind,
    accountId: filter.accountId ?? null,
    category: filter.category ?? null,
    labelId: filter.labelId ?? null,
    query: filter.query ?? null,
    pageSize: paginated ? pageSize : filter.pageSize ?? null,
  });
  const [pagination, setPagination] = useState({
    filterKey,
    page: 1,
  });
  const [reloadTick, setReloadTick] = useState(0);
  const [state, setState] = useState<
    AsyncState<Thread[]> & {
      loadingMore: boolean;
      total: number;
      hasMore: boolean;
    }
  >({
    data: null,
    loading: true,
    loadingMore: false,
    error: null,
    total: 0,
    hasMore: false,
  });
  const currentPage = pagination.filterKey === filterKey ? pagination.page : 1;

  useEffect(() => {
    setPagination({
      filterKey,
      page: 1,
    });
    setState({
      data: null,
      loading: true,
      loadingMore: false,
      error: null,
      total: 0,
      hasMore: false,
    });
  }, [filterKey]);

  useEffect(() => {
    return backend.subscribeResource("threads", () => {
      setReloadTick((current) => current + 1);
    });
  }, [backend]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const requests = Array.from({ length: paginated ? currentPage : 1 }, (_, index) =>
          backend.threads.list({
            ...filter,
            page: paginated ? index + 1 : filter.page,
            pageSize: paginated ? pageSize : filter.pageSize,
          }),
        );

        const results = await Promise.all(requests);
        if (!active) {
          return;
        }

        const latestResult =
          results.at(-1) ??
          ({
            items: [],
            page: 1,
            pageSize,
            total: 0,
            hasMore: false,
          } satisfies ThreadListResponse);

        startTransition(() => {
          setState({
            data: results.flatMap((result) => result.items),
            loading: false,
            loadingMore: false,
            error: null,
            total: latestResult.total,
            hasMore: latestResult.hasMore,
          });
        });
      } catch (error) {
        if (!active) {
          return;
        }

        startTransition(() => {
          setState((current) => ({
            ...current,
            loading: false,
            loadingMore: false,
            error: error instanceof Error ? error.message : "메일 목록을 불러오지 못했습니다.",
          }));
        });
      }
    };

    setState((current) => ({
      ...current,
      loading: currentPage === 1 || current.data === null,
      loadingMore: currentPage > 1 && current.data !== null,
      error: null,
    }));

    void load();

    return () => {
      active = false;
    };
  }, [
    backend,
    currentPage,
    pageSize,
    paginated,
    filter.accountId,
    filter.category,
    filter.kind,
    filter.labelId,
    filter.page,
    filter.pageSize,
    filter.query,
    reloadTick,
  ]);

  return {
    ...state,
    loadMore: () => {
      if (!paginated || state.loading || state.loadingMore || !state.hasMore) {
        return;
      }

      setState((current) => ({
        ...current,
        loadingMore: true,
        error: null,
      }));
      setPagination((current) => ({
        filterKey,
        page: current.filterKey === filterKey ? current.page + 1 : 2,
      }));
    },
  };
}

export function useUpdateThread() {
  const backend = useMailService();
  return (threadId: string, patch: Partial<Thread>) => backend.threads.update(threadId, patch);
}

export function useCreateLabel() {
  const backend = useMailService();
  return (payload: Pick<Label, "name" | "color">) => backend.labels.create(payload);
}

export function useGenerateReply() {
  const backend = useMailService();
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

export function useGenerateMailDraft() {
  const backend = useMailService();
  const [state, setState] = useState<{
    loading: boolean;
    variants: MailDraftVariant[] | null;
    error: string | null;
  }>({
    loading: false,
    variants: null,
    error: null,
  });

  return {
    ...state,
    run: async (payload: GenerateMailDraftPayload) => {
      setState({
        loading: true,
        variants: null,
        error: null,
      });

      try {
        const result = await backend.ai.generateDraft(payload);
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
          error: error instanceof Error ? error.message : "메일 초안을 생성하지 못했습니다.",
        });
        throw error;
      }
    },
    reset: () =>
      setState({
        loading: false,
        variants: null,
        error: null,
      }),
  };
}

export function useSendMail() {
  const backend = useMailService();
  const [state, setState] = useState<{
    loading: boolean;
    result: SendMailResult | null;
    error: string | null;
  }>({
    loading: false,
    result: null,
    error: null,
  });

  return {
    ...state,
    run: async (payload: SendMailPayload) => {
      setState({
        loading: true,
        result: null,
        error: null,
      });

      try {
        const result = await backend.mail.send(payload);
        setState({
          loading: false,
          result,
          error: null,
        });
        return result;
      } catch (error) {
        setState({
          loading: false,
          result: null,
          error: error instanceof Error ? error.message : "메일 전송에 실패했습니다.",
        });
        throw error;
      }
    },
  };
}

export function useSummarizeThread() {
  const backend = useMailService();
  return (threadId: string): Promise<ThreadSummary> => backend.ai.summarize(threadId);
}
