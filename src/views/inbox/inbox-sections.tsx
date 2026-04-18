"use client";

import {
  AlertCircle,
  Archive,
  Bell,
  CalendarDays,
  ChevronRight,
  Clock,
  Forward,
  Inbox,
  ListTodo,
  Loader2,
  Newspaper,
  Paperclip,
  Plus,
  Receipt,
  Reply,
  Sparkles,
  Star,
  Tag,
  Trash2,
} from "lucide-react";
import {
  startTransition,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useInboxController } from "@/controllers/inbox/inbox-controller";
import { useThread, useUpdateThread, useSummarizeThread, useProviderCatalog } from "@/lib/client/hooks";
import { formatThreadDate, formatThreadTime } from "@/lib/shared/time";
import type {
  Category,
  ComposeMode,
  ConnectAccountPayload,
  ProviderDescriptor,
  Thread,
  ThreadView,
} from "@/lib/shared/types";
import { useMailService } from "@/services/api/mail-service-context";

import {
  ActionButton,
  EmptyState,
  Field,
  LabelPill,
  MiniBadge,
  ProviderDot,
  SectionTitle,
  SidebarItem,
  StatCard,
  formatAddressSummary,
  ghostButtonStyle,
  inputStyle,
  primaryButtonStyle,
} from "@/views/inbox/view-primitives";

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
  { value: "sent", label: "보낸 메일" },
];

export function Sidebar() {
  const controller = useInboxController();

  const counts = useMemo(() => {
    const byCategory = new Map<Category, number>();
    for (const thread of controller.allThreads) {
      byCategory.set(thread.category, (byCategory.get(thread.category) ?? 0) + 1);
    }

    return {
      inbox: controller.allThreads.length,
      starred: controller.allThreads.filter((thread) => thread.starred).length,
      needsReply: controller.allThreads.filter((thread) => thread.hasAction).length,
      categories: byCategory,
    };
  }, [controller.allThreads]);

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
        <div style={{ marginTop: 4, fontSize: 18, fontWeight: 700 }}>{controller.user?.displayName ?? "사용자"}</div>
      </div>

      <button onClick={controller.openConnectSheet} style={primaryButtonStyle()}>
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
          {controller.briefing?.timeSavedLabel ?? "계산 중"}
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
          <StatCard label="수신" value={controller.briefing?.received ?? 0} />
          <StatCard label="답장 필요" value={controller.briefing?.needsReply ?? 0} />
          <StatCard label="중요" value={controller.briefing?.important ?? 0} />
          <StatCard label="자동 분류" value={controller.briefing?.autoFiled ?? 0} />
        </div>
      </div>

      <SectionTitle>기본 뷰</SectionTitle>
      <SidebarItem
        active={
          controller.selectedFilter.kind === "all" &&
          !controller.selectedFilter.accountId &&
          !controller.selectedFilter.category &&
          !controller.selectedFilter.labelId
        }
        label="통합 인박스"
        count={counts.inbox}
        onClick={() => controller.selectFilter({ kind: "all" })}
      />
      <SidebarItem
        active={controller.selectedFilter.kind === "needsReply"}
        label="답장 필요"
        count={counts.needsReply}
        onClick={() => controller.selectFilter({ kind: "needsReply" })}
      />
      <SidebarItem
        active={controller.selectedFilter.kind === "starred"}
        label="별표"
        count={counts.starred}
        onClick={() => controller.selectFilter({ kind: "starred" })}
      />

      <SectionTitle>연결 계정</SectionTitle>
      {controller.accounts.map((account) => (
        <SidebarItem
          key={account.id}
          active={controller.selectedFilter.accountId === account.id}
          label={account.label}
          meta={account.email}
          count={account.unreadCount}
          leading={<ProviderDot provider={account.provider} />}
          onClick={() => controller.selectFilter({ kind: "all", accountId: account.id })}
        />
      ))}

      <SectionTitle>AI 카테고리</SectionTitle>
      {CATEGORY_META.map((category) => (
        <SidebarItem
          key={category.value}
          active={controller.selectedFilter.category === category.value}
          label={category.label}
          count={counts.categories.get(category.value) ?? 0}
          leading={category.icon}
          onClick={() => controller.selectFilter({ kind: "all", category: category.value })}
        />
      ))}

      <SectionTitle>라벨</SectionTitle>
      {controller.labels.map((label) => (
        <SidebarItem
          key={label.id}
          active={controller.selectedFilter.labelId === label.id}
          label={label.name}
          leading={<span style={{ width: 10, height: 10, borderRadius: 999, background: label.color }} />}
          onClick={() => controller.selectFilter({ kind: "all", labelId: label.id })}
        />
      ))}
    </aside>
  );
}

export function ThreadPane() {
  const controller = useInboxController();
  const startIndex = controller.threads.length === 0 ? 0 : 1;
  const endIndex = controller.threads.length;

  return (
    <section
      style={{
        minWidth: 0,
        background: "var(--bg-0)",
        borderRight: controller.selectedThreadId ? "1px solid var(--border)" : "none",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ padding: "16px 18px 14px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.03em" }}>받은편지함</div>
          <div style={{ fontSize: 12, color: "var(--fg-2)" }}>
            {startIndex}-{endIndex} / {controller.threadsTotal}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => controller.selectFilter({ kind: tab.value })}
              style={{
                padding: "7px 12px",
                borderRadius: 999,
                border: tab.value === controller.selectedFilter.kind ? "1px solid transparent" : "1px solid var(--border)",
                background: tab.value === controller.selectedFilter.kind ? "var(--accent)" : "transparent",
                color: tab.value === controller.selectedFilter.kind ? "#fff" : "var(--fg-1)",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div
        className="scrollbar"
        style={{ flex: 1, overflow: "auto" }}
        onScroll={(event) => {
          const element = event.currentTarget;
          const remaining = element.scrollHeight - element.scrollTop - element.clientHeight;
          if (remaining < 140) {
            controller.loadMoreThreads();
          }
        }}
      >
        {controller.threadsLoading ? (
          <EmptyState icon={<Loader2 className="spin" size={18} />} title="메일 목록을 불러오는 중입니다." />
        ) : controller.threadsError ? (
          <EmptyState icon={<AlertCircle size={18} />} title={controller.threadsError} />
        ) : controller.threads.length === 0 ? (
          <EmptyState icon={<Inbox size={18} />} title="조건에 맞는 메일이 없습니다." />
        ) : (
          <>
            {controller.threads.map((thread) => (
              <ThreadRow
                key={thread.id}
                thread={thread}
                selected={thread.id === controller.selectedThreadId}
                compact={Boolean(controller.selectedThreadId)}
                onClick={() => startTransition(() => controller.selectThread(thread.id))}
              />
            ))}

            {controller.threadsLoadingMore ? (
              <div style={{ padding: 18, display: "grid", placeItems: "center", color: "var(--fg-2)" }}>
                <Loader2 size={16} className="spin" />
              </div>
            ) : null}

            {!controller.threadsLoadingMore && controller.threadsHasMore ? (
              <div style={{ padding: 18, display: "grid", placeItems: "center" }}>
                <button onClick={controller.loadMoreThreads} style={ghostButtonStyle()}>
                  더 보기
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

export function DetailPane() {
  const controller = useInboxController();
  const { data: thread, loading, error } = useThread(controller.selectedThreadId);
  const updateThread = useUpdateThread();
  const summarizeThread = useSummarizeThread();
  const [isSummarizing, setIsSummarizing] = useState(false);

  if (!controller.selectedThreadId) {
    return <EmptyState icon={<ChevronRight size={18} />} title="왼쪽에서 메일을 선택하세요." />;
  }

  if (loading) {
    return <EmptyState icon={<Loader2 className="spin" size={18} />} title="메일을 불러오는 중입니다." />;
  }

  if (error || !thread) {
    return <EmptyState icon={<AlertCircle size={18} />} title={error ?? "메일을 찾지 못했습니다."} />;
  }

  const account = controller.accounts.find((candidate) => candidate.id === thread.accountId);
  const threadLabels = controller.labels.filter((label) => thread.labelIds.includes(label.id));
  const isSent = thread.direction === "sent";

  return (
    <section className="scrollbar" style={{ overflow: "auto", background: "var(--bg-1)", minWidth: 0 }}>
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
          <div style={{ flex: 1 }} />
          <button onClick={controller.closeSelectedThread} style={ghostButtonStyle()}>
            목록으로
          </button>
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
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              {isSent ? formatAddressSummary(thread.to, "받는 사람 없음") : thread.from}
            </div>
            <div style={{ marginTop: 4, fontSize: 12, color: "var(--fg-2)" }}>
              {isSent ? `보낸 계정 ${thread.fromEmail}` : thread.fromEmail} · {formatThreadDate(thread.receivedAt)} {formatThreadTime(thread.receivedAt)}
            </div>
            {isSent && (thread.cc?.length || thread.bcc?.length) ? (
              <div style={{ marginTop: 4, fontSize: 12, color: "var(--fg-2)", lineHeight: 1.6 }}>
                {thread.cc?.length ? `참조 ${formatAddressSummary(thread.cc)} ` : ""}
                {thread.bcc?.length ? `숨은참조 ${formatAddressSummary(thread.bcc)}` : ""}
              </div>
            ) : null}
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
          {!isSent ? (
            <>
              <ActionButton onClick={() => controller.openThreadComposer("reply", thread)} icon={<Reply size={14} />} label="답장" primary />
              <ActionButton onClick={() => controller.openThreadComposer("forward", thread)} icon={<Forward size={14} />} label="전달" />
            </>
          ) : null}
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
      </div>
    </section>
  );
}

export function ConnectAccountSheet({ onClose }: { onClose: () => void }) {
  const mailService = useMailService();
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
            Gmail, Outlook, Naver, 그리고 임의의 IMAP/SMTP 서버까지 같은 provider 인터페이스로 연결합니다.
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

                {selectedProvider.id === "naver" ? (
                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "flex-start",
                      padding: "12px 14px",
                      borderRadius: 14,
                      border: "1px solid var(--border)",
                      background: "rgba(31, 140, 67, 0.08)",
                      color: "var(--fg-1)",
                      fontSize: 13,
                      lineHeight: 1.6,
                    }}
                  >
                    <AlertCircle size={16} style={{ marginTop: 2, flexShrink: 0 }} />
                    <div>
                      네이버 메일은 PC의 메일 환경설정에서 IMAP/SMTP를 먼저 <strong>'사용함'</strong>으로 바꾸고,
                      네이버 로그인 <strong>2단계 인증</strong> 후 발급한 <strong>애플리케이션 비밀번호</strong>로 연결해야 합니다.
                    </div>
                  </div>
                ) : null}
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

                      await mailService.accounts.connect(payload);
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
  selected,
  compact,
  onClick,
}: {
  thread: Thread;
  selected: boolean;
  compact: boolean;
  onClick: () => void;
}) {
  const controller = useInboxController();
  const account = controller.accounts.find((candidate) => candidate.id === thread.accountId);
  const rowLabels = controller.labels.filter((label) => thread.labelIds.includes(label.id)).slice(0, compact ? 1 : 2);
  const primaryActor = thread.direction === "sent" ? formatAddressSummary(thread.to, "받는 사람 없음") : thread.from;
  const accentColor = selected ? "var(--accent)" : thread.unread ? "var(--fg-0)" : "var(--fg-1)";
  const previewText = [thread.subject, thread.summary.oneLine].filter(Boolean).join(" - ");

  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        padding: compact ? "14px 16px" : "16px 18px",
        border: "none",
        borderBottom: "1px solid var(--border)",
        background: selected ? "var(--accent-soft)" : "transparent",
        cursor: "pointer",
        transition: "background 120ms ease",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: compact ? "minmax(0, 1fr) auto" : "minmax(140px, 0.9fr) minmax(0, 2.4fr) auto",
          alignItems: "center",
          gap: compact ? 10 : 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <ProviderDot provider={account?.provider ?? "mock"} />
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontWeight: thread.unread ? 800 : 600,
                color: accentColor,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {primaryActor}
            </div>
            {compact ? (
              <div
                style={{
                  marginTop: 4,
                  fontSize: 12,
                  color: "var(--fg-2)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {account?.label ?? account?.email ?? ""}
              </div>
            ) : null}
          </div>
        </div>

        {!compact ? (
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontWeight: thread.unread ? 700 : 500,
                color: "var(--fg-0)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {previewText}
            </div>
            <div style={{ marginTop: 7, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {thread.hasAction ? <MiniBadge tone="accent" label="답장 필요" /> : null}
              {thread.direction === "sent" ? <MiniBadge tone="neutral" label="보낸 메일" /> : null}
              <MiniBadge tone="neutral" label={CATEGORY_META.find((item) => item.value === thread.category)?.label ?? thread.category} />
              {rowLabels.map((label) => (
                <span
                  key={label.id}
                  style={{
                    maxWidth: 92,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    padding: "3px 8px",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 600,
                    color: label.color,
                    background: `${label.color}16`,
                  }}
                >
                  {label.name}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            flexDirection: compact ? "column" : "row",
            alignItems: compact ? "flex-end" : "center",
            justifyContent: "flex-end",
            gap: 8,
            color: "var(--fg-2)",
            minWidth: 0,
          }}
        >
          <div style={{ fontSize: 12, whiteSpace: "nowrap" }}>{formatThreadTime(thread.receivedAt)}</div>
          {compact ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {thread.hasAction ? <MiniBadge tone="accent" label="답장 필요" /> : null}
              {thread.direction === "sent" ? <MiniBadge tone="neutral" label="보낸" /> : null}
            </div>
          ) : null}
        </div>
      </div>

      {compact ? (
        <div
          style={{
            marginTop: 10,
            fontSize: 13,
            color: "var(--fg-2)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {previewText}
        </div>
      ) : null}

      {!compact && thread.attachments.length > 0 ? (
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--fg-3)" }}>
          첨부 {thread.attachments.length}개
        </div>
      ) : null}
    </button>
  );
}
