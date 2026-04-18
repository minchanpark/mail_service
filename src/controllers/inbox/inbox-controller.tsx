"use client";

import {
  startTransition,
  useContext,
  createContext,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  useAccounts,
  useBriefing,
  useCreateLabel,
  useCurrentUser,
  useLabels,
  useThreads,
  useUpdateThread,
} from "@/lib/client/hooks";
import type {
  Account,
  Briefing,
  ComposeMode,
  Label,
  SendMailResult,
  Thread,
  ThreadFilter,
  User,
} from "@/lib/shared/types";
import { createMailApiService } from "@/services/api/mail-api-service";
import { MailServiceProvider } from "@/services/api/mail-service-context";

import type { ComposerIntent } from "@/controllers/inbox/types";

type InboxTheme = "light" | "dark";

type InboxControllerValue = {
  theme: InboxTheme;
  toggleTheme: () => void;
  searchInput: string;
  setSearchInput: (value: string) => void;
  selectedFilter: ThreadFilter;
  selectFilter: (filter: ThreadFilter) => void;
  selectedThreadId: string | null;
  selectThread: (threadId: string | null) => void;
  closeSelectedThread: () => void;
  connectSheetOpen: boolean;
  openConnectSheet: () => void;
  closeConnectSheet: () => void;
  composerIntent: ComposerIntent | null;
  openComposer: (intent: ComposerIntent) => void;
  openThreadComposer: (mode: ComposeMode, thread: Thread) => void;
  closeComposer: () => void;
  handleMailSent: (result: SendMailResult) => void;
  user: User | null;
  accounts: Account[];
  labels: Label[];
  briefing: Briefing | null;
  allThreads: Thread[];
  threads: Thread[];
  threadsLoading: boolean;
  threadsLoadingMore: boolean;
  threadsHasMore: boolean;
  threadsTotal: number;
  threadsError: string | null;
  loadMoreThreads: () => void;
  createLabel: (input: Pick<Label, "name" | "color">) => Promise<Label>;
  saveThreadLabels: (threadId: string, labelIds: string[]) => Promise<Thread>;
};

const mailApiService = createMailApiService();
const InboxControllerContext = createContext<InboxControllerValue | null>(null);

export function InboxControllerProvider({ children }: { children: ReactNode }) {
  return (
    <MailServiceProvider service={mailApiService}>
      <InboxControllerStateProvider>{children}</InboxControllerStateProvider>
    </MailServiceProvider>
  );
}

function InboxControllerStateProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<InboxTheme>("light");
  const [selectedFilter, setSelectedFilter] = useState<ThreadFilter>({ kind: "all" });
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [searchInput, setSearchInputState] = useState("");
  const [connectSheetOpen, setConnectSheetOpen] = useState(false);
  const [composerIntent, setComposerIntent] = useState<ComposerIntent | null>(null);

  const deferredSearch = useDeferredValue(searchInput);
  const queryFilter = useMemo(
    () => ({
      ...selectedFilter,
      query: deferredSearch.trim() || undefined,
    }),
    [deferredSearch, selectedFilter],
  );

  const { data: user } = useCurrentUser();
  const { data: accounts } = useAccounts();
  const { data: labels } = useLabels();
  const { data: briefing } = useBriefing();
  const createLabel = useCreateLabel();
  const updateThread = useUpdateThread();
  const {
    data: threads,
    loading: threadsLoading,
    loadingMore: threadsLoadingMore,
    hasMore: threadsHasMore,
    total: threadsTotal,
    error: threadsError,
    loadMore: loadMoreThreads,
  } = useThreads(queryFilter, { paginated: true, pageSize: 10 });
  const { data: allThreads } = useThreads({ kind: "all" });

  useEffect(() => {
    if (selectedThreadId && !threads?.some((thread) => thread.id === selectedThreadId)) {
      setSelectedThreadId(null);
    }
  }, [selectedThreadId, threads]);

  const value: InboxControllerValue = {
    theme,
    toggleTheme() {
      setTheme((current) => (current === "light" ? "dark" : "light"));
    },
    searchInput,
    setSearchInput(value) {
      setSearchInputState(value);
    },
    selectedFilter,
    selectFilter(filter) {
      startTransition(() => {
        setSelectedFilter(filter);
        setSelectedThreadId(null);
      });
    },
    selectedThreadId,
    selectThread(threadId) {
      setSelectedThreadId(threadId);
    },
    closeSelectedThread() {
      setSelectedThreadId(null);
    },
    connectSheetOpen,
    openConnectSheet() {
      setConnectSheetOpen(true);
    },
    closeConnectSheet() {
      setConnectSheetOpen(false);
    },
    composerIntent,
    openComposer(intent) {
      setComposerIntent(intent);
    },
    openThreadComposer(mode, thread) {
      setComposerIntent({
        mode,
        accountId: thread.accountId,
        threadId: thread.id,
      });
    },
    closeComposer() {
      setComposerIntent(null);
    },
    handleMailSent(result) {
      startTransition(() => {
        setSelectedFilter({ kind: "sent" });
        setSelectedThreadId(result.thread.id);
        setComposerIntent(null);
      });
    },
    user: user ?? null,
    accounts: accounts ?? [],
    labels: labels ?? [],
    briefing: briefing ?? null,
    allThreads: allThreads ?? [],
    threads: threads ?? [],
    threadsLoading,
    threadsLoadingMore,
    threadsHasMore,
    threadsTotal,
    threadsError,
    loadMoreThreads,
    createLabel,
    saveThreadLabels(threadId, labelIds) {
      return updateThread(threadId, { labelIds });
    },
  };

  return <InboxControllerContext.Provider value={value}>{children}</InboxControllerContext.Provider>;
}

export function useInboxController() {
  const controller = useContext(InboxControllerContext);
  if (!controller) {
    throw new Error("useInboxController must be used within InboxControllerProvider");
  }

  return controller;
}
