"use client";

import {
  AlertCircle,
  Archive,
  Bell,
  CalendarDays,
  ChevronRight,
  Clock,
  Inbox,
  ListTodo,
  Loader2,
  Moon,
  Newspaper,
  Paperclip,
  Plus,
  Receipt,
  Search,
  Sparkles,
  Star,
  Sun,
  Tag,
  Trash2,
} from "lucide-react";
import {
  startTransition,
  type ReactNode,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";

import { BackendProvider, useBackend } from "@/lib/client/backend-context";
import { createHttpBackend } from "@/lib/client/http-backend";
import {
  useAccounts,
  useBriefing,
  useCurrentUser,
  useGenerateReply,
  useLabels,
  useProviderCatalog,
  useSummarizeThread,
  useThread,
  useThreads,
  useUpdateThread,
} from "@/lib/client/hooks";
import { formatThreadDate, formatThreadTime } from "@/lib/shared/time";
import type {
  Account,
  Category,
  ConnectAccountPayload,
  Label,
  ProviderDescriptor,
  Thread,
  ThreadFilter,
  ThreadView,
} from "@/lib/shared/types";

const backend = createHttpBackend();

const CATEGORY_META: Array<{
  value: Category;
  label: string;
  icon: ReactNode;
}> = [
  { value: "important", label: "중요", icon: <Star size={14} /> },
  { value: "newsletter", label: "뉴스레터", icon: <Newspaper size={14} /> },
  { value: "transaction", label: "거래·영수증", icon: <Receipt size={14} /> },
  { value: "automation", label: "자동화·알림", icon: <Bell size={14} /> },
];

const FILTER_TABS: Array<{ value: ThreadView; label: string }> = [
  { value: "all", label: "전체" },
  { value: "unread", label: "읽지 않음" },
  { value: "needsReply", label: "답장 필요" },
  { value: "starred", label: "별표" },
];

export function InboxApp() {
  return (
    <BackendProvider adapter={backend}>
      <InboxShell />
    </BackendProvider>
  );
}

function InboxShell() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [selectedFilter, setSelectedFilter] = useState<ThreadFilter>({ kind: "all" });
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [showConnectSheet, setShowConnectSheet] = useState(false);

  const deferredSearch = useDeferredValue(searchInput);
  const queryFilter = useMemo(
    () => ({
      ...selectedFilter,
      query: deferredSearch.trim() || undefined,
    }),
    [deferredSearch, selectedFilter],
  );

  const { data: user } = useCurrentUser();
  const { data: threads, loading: threadsLoading } = useThreads(queryFilter);
  const { data: allThreads } = useThreads({ kind: "all" });

  useEffect(() => {
    if (!threads || threads.length === 0) {
      setSelectedThreadId(null);
      return;
    }

    if (!selectedThreadId || !threads.some((thread) => thread.id === selectedThreadId)) {
      setSelectedThreadId(threads[0]?.id ?? null);
    }
  }, [selectedThreadId, threads]);

  return (
    <div className="app-shell" data-theme={theme}>
      <div className="panel" style={{ minHeight: "calc(100vh - 40px)", overflow: "hidden" }}>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "18px 20px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              display: "grid",
              placeItems: "center",
              background: "linear-gradient(135deg, #1d4ed8, #60a5fa)",
              color: "#fff",
            }}
          >
            <Inbox size={18} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.03em" }}>Inbox One</div>
            <div style={{ fontSize: 12, color: "var(--fg-2)" }}>
              확장형 메일 provider 백엔드가 연결된 통합 인박스
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              borderRadius: 999,
              background: "var(--bg-2)",
              color: "var(--fg-2)",
              maxWidth: 340,
              width: "100%",
            }}
          >
            <Search size={14} />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="발신자, 제목, 본문 검색"
              style={{
                flex: 1,
                minWidth: 0,
                border: "none",
                outline: "none",
                background: "transparent",
                color: "var(--fg-0)",
              }}
            />
          </div>
          <button
            onClick={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
            style={ghostButtonStyle()}
          >
            {theme === "light" ? <Moon size={14} /> : <Sun size={14} />}
            {theme === "light" ? "다크" : "라이트"}
          </button>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "260px 400px minmax(0, 1fr)", minHeight: "calc(100vh - 116px)" }}>
          <Sidebar
            userName={user?.displayName ?? "사용자"}
            allThreads={allThreads ?? []}
            selectedFilter={selectedFilter}
            onSelectFilter={setSelectedFilter}
            onOpenConnect={() => setShowConnectSheet(true)}
          />
          <ThreadPane
            filter={selectedFilter}
            onChangeFilter={setSelectedFilter}
            threads={threads ?? []}
            loading={threadsLoading}
            selectedThreadId={selectedThreadId}
            onSelectThread={setSelectedThreadId}
          />
          <DetailPane threadId={selectedThreadId} />
        </div>
      </div>

      {showConnectSheet ? <ConnectAccountSheet onClose={() => setShowConnectSheet(false)} /> : null}
    </div>
  );
}

function Sidebar({
  userName,
  allThreads,
  selectedFilter,
  onSelectFilter,
  onOpenConnect,
}: {
  userName: string;
  allThreads: Thread[];
  selectedFilter: ThreadFilter;
  onSelectFilter: (filter: ThreadFilter) => void;
  onOpenConnect: () => void;
}) {
  const { data: accounts } = useAccounts();
  const { data: labels } = useLabels();
  const { data: briefing } = useBriefing();

  const counts = useMemo(() => {
    const byCategory = new Map<Category, number>();
    for (const thread of allThreads) {
      byCategory.set(thread.category, (byCategory.get(thread.category) ?? 0) + 1);
    }

    return {
      inbox: allThreads.length,
      starred: allThreads.filter((thread) => thread.starred).length,
      needsReply: allThreads.filter((thread) => thread.hasAction).length,
      categories: byCategory,
    };
  }, [allThreads]);

  return (
    <aside
      className="scrollbar"
      style={{
        borderRight: "1px solid var(--border)",
        background: "linear-gradient(180deg, var(--bg-0) 0%, var(--bg-1) 100%)",
        padding: 18,
        overflow: "auto",
      }}
    >
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 12, color: "var(--fg-2)" }}>오늘의 오너</div>
        <div style={{ marginTop: 4, fontSize: 18, fontWeight: 700 }}>{userName}</div>
      </div>

      <button onClick={onOpenConnect} style={primaryButtonStyle()}>
        <Plus size={14} />
        메일 서버 연결
      </button>

      <div
        style={{
          marginTop: 18,
          padding: 16,
          borderRadius: 16,
          background: "linear-gradient(135deg, var(--accent-soft) 0%, transparent 100%)",
          border: "1px solid var(--border)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--accent-soft-fg)" }}>
          <Sparkles size={14} />
          오늘의 AI 브리핑
        </div>
        <div style={{ marginTop: 10, fontSize: 28, fontWeight: 800, letterSpacing: "-0.04em" }}>
          {briefing?.timeSavedLabel ?? "계산 중"}
        </div>
        <div style={{ marginTop: 4, fontSize: 13, color: "var(--fg-2)" }}>
          오늘 절약 가능한 예상 메일 처리 시간
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 10,
            marginTop: 14,
          }}
        >
          <StatCard label="수신" value={briefing?.received ?? 0} />
          <StatCard label="답장 필요" value={briefing?.needsReply ?? 0} />
          <StatCard label="중요" value={briefing?.important ?? 0} />
          <StatCard label="자동 분류" value={briefing?.autoFiled ?? 0} />
        </div>
      </div>

      <SectionTitle>기본 뷰</SectionTitle>
      <SidebarItem
        active={selectedFilter.kind === "all" && !selectedFilter.accountId && !selectedFilter.category && !selectedFilter.labelId}
        label="통합 인박스"
        count={counts.inbox}
        onClick={() => onSelectFilter({ kind: "all" })}
      />
      <SidebarItem
        active={selectedFilter.kind === "needsReply"}
        label="답장 필요"
        count={counts.needsReply}
        onClick={() => onSelectFilter({ kind: "needsReply" })}
      />
      <SidebarItem
        active={selectedFilter.kind === "starred"}
        label="별표"
        count={counts.starred}
        onClick={() => onSelectFilter({ kind: "starred" })}
      />

      <SectionTitle>연결 계정</SectionTitle>
      {(accounts ?? []).map((account) => (
        <SidebarItem
          key={account.id}
          active={selectedFilter.accountId === account.id}
          label={account.label}
          meta={account.email}
          count={account.unreadCount}
          leading={<ProviderDot provider={account.provider} />}
          onClick={() => onSelectFilter({ kind: "all", accountId: account.id })}
        />
      ))}

      <SectionTitle>AI 카테고리</SectionTitle>
      {CATEGORY_META.map((category) => (
        <SidebarItem
          key={category.value}
          active={selectedFilter.category === category.value}
          label={category.label}
          count={counts.categories.get(category.value) ?? 0}
          leading={category.icon}
          onClick={() => onSelectFilter({ kind: "all", category: category.value })}
        />
      ))}

      <SectionTitle>라벨</SectionTitle>
      {(labels ?? []).map((label) => (
        <SidebarItem
          key={label.id}
          active={selectedFilter.labelId === label.id}
          label={label.name}
          leading={<span style={{ width: 10, height: 10, borderRadius: 999, background: label.color }} />}
          onClick={() => onSelectFilter({ kind: "all", labelId: label.id })}
        />
      ))}
    </aside>
  );
}

function ThreadPane({
  filter,
  onChangeFilter,
  threads,
  loading,
  selectedThreadId,
  onSelectThread,
}: {
  filter: ThreadFilter;
  onChangeFilter: (filter: ThreadFilter) => void;
  threads: Thread[];
  loading: boolean;
  selectedThreadId: string | null;
  onSelectThread: (threadId: string | null) => void;
}) {
  const { data: accounts } = useAccounts();
  const { data: labels } = useLabels();

  return (
    <section style={{ borderRight: "1px solid var(--border)", minWidth: 0, background: "var(--bg-0)" }}>
      <div style={{ padding: 20, borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => startTransition(() => onChangeFilter({ kind: tab.value }))}
              style={{
                padding: "8px 12px",
                borderRadius: 999,
                border: tab.value === filter.kind ? "1px solid transparent" : "1px solid var(--border)",
                background: tab.value === filter.kind ? "var(--accent)" : "transparent",
                color: tab.value === filter.kind ? "#fff" : "var(--fg-1)",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="scrollbar" style={{ maxHeight: "calc(100vh - 197px)", overflow: "auto" }}>
        {loading ? (
          <EmptyState icon={<Loader2 className="spin" size={18} />} title="메일 목록을 불러오는 중입니다." />
        ) : threads.length === 0 ? (
          <EmptyState icon={<Inbox size={18} />} title="조건에 맞는 메일이 없습니다." />
        ) : (
          threads.map((thread) => (
            <ThreadRow
              key={thread.id}
              thread={thread}
              account={accounts?.find((account) => account.id === thread.accountId)}
              labels={labels ?? []}
              selected={thread.id === selectedThreadId}
              onClick={() => startTransition(() => onSelectThread(thread.id))}
            />
          ))
        )}
      </div>
    </section>
  );
}

function DetailPane({ threadId }: { threadId: string | null }) {
  const { data: accounts } = useAccounts();
  const { data: labels } = useLabels();
  const { data: thread, loading, error } = useThread(threadId);
  const updateThread = useUpdateThread();
  const summarizeThread = useSummarizeThread();
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [showReplyPanel, setShowReplyPanel] = useState(false);

  useEffect(() => {
    setShowReplyPanel(false);
  }, [threadId]);

  if (!threadId) {
    return <EmptyState icon={<ChevronRight size={18} />} title="왼쪽에서 메일을 선택하세요." />;
  }

  if (loading) {
    return <EmptyState icon={<Loader2 className="spin" size={18} />} title="메일을 불러오는 중입니다." />;
  }

  if (error || !thread) {
    return <EmptyState icon={<AlertCircle size={18} />} title={error ?? "메일을 찾지 못했습니다."} />;
  }

  const account = accounts?.find((candidate) => candidate.id === thread.accountId);
  const threadLabels = (labels ?? []).filter((label) => thread.labelIds.includes(label.id));

  return (
    <section className="scrollbar" style={{ overflow: "auto", background: "var(--bg-1)" }}>
      <div className="fade-up" style={{ padding: 28, maxWidth: 920 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {threadLabels.map((label) => (
            <LabelPill key={label.id} label={label} />
          ))}
          {account ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 10px",
                borderRadius: 999,
                background: "var(--bg-2)",
                fontSize: 12,
                color: "var(--fg-2)",
              }}
            >
              <ProviderDot provider={account.provider} />
              {account.label}
            </span>
          ) : null}
        </div>

        <h1 style={{ marginTop: 16, marginBottom: 10, fontSize: 30, lineHeight: 1.15, letterSpacing: "-0.04em" }}>
          {thread.subject}
        </h1>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            paddingBottom: 18,
            borderBottom: "1px solid var(--border)",
            marginBottom: 18,
          }}
        >
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{thread.from}</div>
            <div style={{ marginTop: 4, fontSize: 12, color: "var(--fg-2)" }}>
              {thread.fromEmail} · {formatThreadDate(thread.receivedAt)} {formatThreadTime(thread.receivedAt)}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <ActionButton onClick={() => updateThread(thread.id, { archived: true })} icon={<Archive size={14} />} label="보관" />
            <ActionButton
              onClick={() => updateThread(thread.id, { starred: !thread.starred })}
              icon={<Star size={14} fill={thread.starred ? "currentColor" : "none"} />}
              label={thread.starred ? "별표 해제" : "별표"}
            />
            <ActionButton onClick={() => updateThread(thread.id, { unread: !thread.unread })} icon={<Tag size={14} />} label={thread.unread ? "읽음" : "읽지 않음"} />
          </div>
        </div>

        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: 18,
            padding: 18,
            background: "linear-gradient(135deg, var(--accent-soft) 0%, transparent 100%)",
            marginBottom: 18,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
            <Sparkles size={14} />
            <strong style={{ fontSize: 13 }}>AI 3줄 요약</strong>
            <div style={{ flex: 1 }} />
            <button
              onClick={async () => {
                setIsSummarizing(true);
                try {
                  await summarizeThread(thread.id);
                } finally {
                  setIsSummarizing(false);
                }
              }}
              style={ghostButtonStyle()}
            >
              {isSummarizing ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
              재요약
            </button>
          </div>
          <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8, color: "var(--fg-1)" }}>
            {thread.summary.threeLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22 }}>
          <ActionButton onClick={() => setShowReplyPanel((current) => !current)} icon={<Sparkles size={14} />} label="답장 초안 생성" primary />
          <ActionButton onClick={() => updateThread(thread.id, { snoozedUntil: new Date(Date.now() + 86400000).toISOString() })} icon={<Clock size={14} />} label="내일 아침까지 스누즈" />
          <ActionButton icon={<CalendarDays size={14} />} label="일정 등록 예정" />
          <ActionButton icon={<ListTodo size={14} />} label="할일 추가 예정" />
          <ActionButton icon={<Trash2 size={14} />} label="삭제 예정" />
        </div>

        <article
          style={{
            border: "1px solid var(--border)",
            borderRadius: 18,
            background: "var(--bg-0)",
            padding: 22,
            lineHeight: 1.8,
            color: "var(--fg-1)",
            whiteSpace: "pre-wrap",
          }}
        >
          {thread.bodyText || thread.preview}
        </article>

        {thread.attachments.length > 0 ? (
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 12, color: "var(--fg-2)", marginBottom: 10 }}>첨부 파일</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {thread.attachments.map((attachment) => (
                <div
                  key={`${attachment.name}-${attachment.size}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 14px",
                    borderRadius: 14,
                    border: "1px solid var(--border)",
                    background: "var(--bg-0)",
                  }}
                >
                  <Paperclip size={16} />
                  <div>
                    <div style={{ fontWeight: 600 }}>{attachment.name}</div>
                    <div style={{ fontSize: 12, color: "var(--fg-2)" }}>{attachment.size}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {showReplyPanel ? <ReplyDraftPanel threadId={thread.id} /> : null}
      </div>
    </section>
  );
}

function ReplyDraftPanel({ threadId }: { threadId: string }) {
  const reply = useGenerateReply();

  useEffect(() => {
    void reply.run(threadId);
  }, [threadId]);

  return (
    <div
      style={{
        marginTop: 20,
        border: "1px solid var(--border)",
        borderRadius: 18,
        background: "var(--bg-0)",
        padding: 18,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
        <Sparkles size={14} />
        <strong style={{ fontSize: 14 }}>AI 답장 초안</strong>
      </div>

      {reply.loading ? (
        <EmptyState icon={<Loader2 className="spin" size={16} />} title="초안을 생성하는 중입니다." compact />
      ) : reply.error ? (
        <EmptyState icon={<AlertCircle size={16} />} title={reply.error} compact />
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {(reply.variants ?? []).map((variant) => (
            <div
              key={variant.label}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: 14,
                background: "var(--bg-1)",
              }}
            >
              <div style={{ fontSize: 12, color: "var(--fg-2)", marginBottom: 8 }}>{variant.label}</div>
              <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{variant.body}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConnectAccountSheet({ onClose }: { onClose: () => void }) {
  const backend = useBackend();
  const { data: providers, loading } = useProviderCatalog();
  const [selectedProviderId, setSelectedProviderId] = useState<string>("mock");
  const [email, setEmail] = useState("");
  const [label, setLabel] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedProvider = providers?.find((provider) => provider.id === selectedProviderId) ?? providers?.[0];

  useEffect(() => {
    if (!selectedProvider) {
      return;
    }
    setFieldValues(
      Object.fromEntries(
        selectedProvider.fields.map((field) => [field.name, field.defaultValue ?? ""]),
      ),
    );
  }, [selectedProvider?.id]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.42)",
        display: "grid",
        placeItems: "center",
        padding: 20,
        zIndex: 50,
      }}
    >
      <div className="panel" style={{ width: "min(920px, 100%)", display: "grid", gridTemplateColumns: "280px minmax(0, 1fr)" }}>
        <div style={{ padding: 22, borderRight: "1px solid var(--border)" }}>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.04em" }}>메일 서버 연결</div>
          <div style={{ marginTop: 8, fontSize: 13, color: "var(--fg-2)", lineHeight: 1.6 }}>
            Gmail, Outlook, Naver, 그리고 임의의 IMAP 서버까지 같은 provider 인터페이스로 연결합니다.
          </div>

          <div style={{ marginTop: 18, display: "grid", gap: 10 }}>
            {loading ? (
              <EmptyState icon={<Loader2 className="spin" size={16} />} title="provider 목록을 불러오는 중입니다." compact />
            ) : (
              (providers ?? []).map((provider) => (
                <button
                  key={provider.id}
                  onClick={() => setSelectedProviderId(provider.id)}
                  style={{
                    textAlign: "left",
                    padding: 14,
                    borderRadius: 16,
                    border: provider.id === selectedProviderId ? "1px solid transparent" : "1px solid var(--border)",
                    background: provider.id === selectedProviderId ? "var(--accent-soft)" : "var(--bg-0)",
                    color: "var(--fg-0)",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <ProviderDot provider={provider.provider} />
                    <strong>{provider.label}</strong>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, color: "var(--fg-2)", lineHeight: 1.6 }}>
                    {provider.description}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div style={{ padding: 22 }}>
          {selectedProvider ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <ProviderDot provider={selectedProvider.provider} />
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{selectedProvider.label}</div>
                  <div style={{ fontSize: 12, color: "var(--fg-2)" }}>{selectedProvider.description}</div>
                </div>
              </div>

              <div style={{ marginTop: 20, display: "grid", gap: 14 }}>
                <Field label="이메일 주소">
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="user@example.com"
                    style={inputStyle()}
                  />
                </Field>
                <Field label="표시 이름">
                  <input
                    value={label}
                    onChange={(event) => setLabel(event.target.value)}
                    placeholder={`${selectedProvider.label} 계정`}
                    style={inputStyle()}
                  />
                </Field>
                {selectedProvider.fields.map((field) => (
                  <Field key={field.name} label={field.label} helpText={field.helpText}>
                    <input
                      value={fieldValues[field.name] ?? ""}
                      type={field.type === "password" ? "password" : field.type === "number" ? "number" : "text"}
                      onChange={(event) =>
                        setFieldValues((current) => ({
                          ...current,
                          [field.name]: event.target.value,
                        }))
                      }
                      placeholder={field.placeholder}
                      style={inputStyle()}
                    />
                  </Field>
                ))}
              </div>

              {error ? (
                <div
                  style={{
                    marginTop: 14,
                    padding: "12px 14px",
                    borderRadius: 14,
                    background: "rgba(220, 38, 38, 0.08)",
                    color: "var(--danger)",
                    fontSize: 13,
                  }}
                >
                  {error}
                </div>
              ) : null}

              <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button onClick={onClose} style={ghostButtonStyle()}>
                  취소
                </button>
                <button
                  onClick={async () => {
                    if (!selectedProvider) {
                      return;
                    }

                    setSubmitting(true);
                    setError(null);

                    try {
                      const payload: ConnectAccountPayload = {
                        driverId: selectedProvider.id,
                        email,
                        label,
                        secrets: {},
                        settings: {},
                      };

                      for (const field of selectedProvider.fields) {
                        const value = fieldValues[field.name] ?? "";
                        if (field.name === "password") {
                          payload.secrets = {
                            ...payload.secrets,
                            password: value,
                          };
                        } else {
                          payload.settings = {
                            ...payload.settings,
                            [field.name]: value,
                          };
                        }
                      }

                      await backend.accounts.connect(payload);
                      onClose();
                    } catch (submitError) {
                      setError(submitError instanceof Error ? submitError.message : "계정 연결에 실패했습니다.");
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                  style={primaryButtonStyle()}
                >
                  {submitting ? <Loader2 size={14} className="spin" /> : <Plus size={14} />}
                  연결 시작
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ThreadRow({
  thread,
  account,
  labels,
  selected,
  onClick,
}: {
  thread: Thread;
  account?: Account;
  labels: Label[];
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        padding: 18,
        border: "none",
        borderBottom: "1px solid var(--border)",
        background: selected ? "var(--accent-soft)" : "transparent",
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <ProviderDot provider={account?.provider ?? "mock"} />
        <div style={{ fontWeight: thread.unread ? 800 : 700, flex: 1, minWidth: 0 }}>{thread.from}</div>
        <div style={{ fontSize: 12, color: "var(--fg-2)" }}>{formatThreadTime(thread.receivedAt)}</div>
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 15,
          fontWeight: thread.unread ? 700 : 600,
          color: "var(--fg-0)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {thread.subject}
      </div>
      <div style={{ marginTop: 8, fontSize: 13, color: "var(--fg-2)", lineHeight: 1.6 }}>{thread.summary.oneLine}</div>
      <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {thread.hasAction ? <MiniBadge tone="accent" label="답장 필요" /> : null}
        <MiniBadge tone="neutral" label={CATEGORY_META.find((item) => item.value === thread.category)?.label ?? thread.category} />
        {labels
          .filter((label) => thread.labelIds.includes(label.id))
          .slice(0, 2)
          .map((label) => (
            <span
              key={label.id}
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: label.color,
              }}
            />
          ))}
      </div>
    </button>
  );
}

function ProviderDot({ provider }: { provider: string }) {
  return (
    <span
      style={{
        width: 10,
        height: 10,
        borderRadius: 999,
        background: `var(--${provider})`,
        display: "inline-block",
      }}
    />
  );
}

function LabelPill({ label }: { label: Label }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 10px",
        borderRadius: 999,
        background: `${label.color}18`,
        color: label.color,
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: 999, background: label.color }} />
      {label.name}
    </span>
  );
}

function EmptyState({
  icon,
  title,
  compact = false,
}: {
  icon: ReactNode;
  title: string;
  compact?: boolean;
}) {
  return (
    <div
      style={{
        minHeight: compact ? 120 : "100%",
        display: "grid",
        placeItems: "center",
        padding: compact ? 12 : 32,
        textAlign: "center",
        color: "var(--fg-2)",
      }}
    >
      <div>
        <div style={{ display: "grid", placeItems: "center", marginBottom: 10 }}>{icon}</div>
        <div style={{ fontSize: 14 }}>{title}</div>
      </div>
    </div>
  );
}

function SidebarItem({
  active,
  label,
  count,
  meta,
  leading,
  onClick,
}: {
  active: boolean;
  label: string;
  count?: number;
  meta?: string;
  leading?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 14,
        border: "none",
        background: active ? "var(--accent-soft)" : "transparent",
        cursor: "pointer",
        color: active ? "var(--accent-soft-fg)" : "var(--fg-1)",
        marginBottom: 6,
      }}
    >
      {leading ?? <span style={{ width: 10, height: 10 }} />}
      <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
        <div style={{ fontWeight: 600 }}>{label}</div>
        {meta ? <div style={{ fontSize: 11, color: "var(--fg-3)" }}>{meta}</div> : null}
      </div>
      {count !== undefined ? <span style={{ fontSize: 12, color: "var(--fg-2)" }}>{count}</span> : null}
    </button>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div style={{ marginTop: 20, marginBottom: 10, fontSize: 11, color: "var(--fg-3)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
      {children}
    </div>
  );
}

function MiniBadge({ tone, label }: { tone: "accent" | "neutral"; label: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 8px",
        borderRadius: 999,
        background: tone === "accent" ? "var(--accent-soft)" : "var(--bg-2)",
        color: tone === "accent" ? "var(--accent-soft-fg)" : "var(--fg-2)",
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      {label}
    </span>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ padding: 10, borderRadius: 14, background: "rgba(255,255,255,0.4)", border: "1px solid var(--border)" }}>
      <div style={{ fontSize: 11, color: "var(--fg-2)" }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 20, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

function ActionButton({
  icon,
  label,
  primary = false,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  primary?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 12px",
        borderRadius: 12,
        border: primary ? "1px solid transparent" : "1px solid var(--border)",
        background: primary ? "var(--accent)" : "var(--bg-0)",
        color: primary ? "#fff" : "var(--fg-1)",
        cursor: "pointer",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function Field({
  label,
  helpText,
  children,
}: {
  label: string;
  helpText?: string;
  children: ReactNode;
}) {
  return (
    <label style={{ display: "grid", gap: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 600 }}>
        {label}
        {helpText ? <div style={{ marginTop: 4, fontSize: 12, color: "var(--fg-2)", fontWeight: 400 }}>{helpText}</div> : null}
      </div>
      {children}
    </label>
  );
}

function inputStyle() {
  return {
    width: "100%",
    border: "1px solid var(--border)",
    borderRadius: 12,
    background: "var(--bg-0)",
    color: "var(--fg-0)",
    padding: "12px 14px",
    outline: "none",
  } as const;
}

function primaryButtonStyle() {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    padding: "12px 16px",
    borderRadius: 14,
    border: "1px solid transparent",
    background: "var(--accent)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 700,
  } as const;
}

function ghostButtonStyle() {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--bg-0)",
    color: "var(--fg-1)",
    cursor: "pointer",
  } as const;
}
