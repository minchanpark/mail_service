"use client";

import {
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import type { ComposerIntent } from "@/controllers/inbox/types";
import {
  useAccounts,
  useGenerateMailDraft,
  useSendMail,
  useThread,
} from "@/services/client/mail-hooks";
import { formatThreadDate, formatThreadTime } from "@/other/utils/time";
import type {
  ComposeMode,
  SendMailResult,
} from "@/models";

import {
  Field,
  ghostButtonStyle,
  inputStyle,
  primaryButtonStyle,
} from "@/views/inbox/view-primitives";

function splitAddresses(input: string) {
  return input
    .split(/[\n,;]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function joinAddresses(values: string[] | undefined) {
  return (values ?? []).join(", ");
}

function ensureSubjectPrefix(subject: string, prefix: string) {
  const normalized = subject.trim();
  if (!normalized) {
    return prefix === "Re:" ? "Re: 제목 없음" : "Fwd: 제목 없음";
  }

  return normalized.toLowerCase().startsWith(prefix.toLowerCase()) ? normalized : `${prefix} ${normalized}`;
}

function buildForwardTemplate(input: {
  from: string;
  fromEmail: string;
  subject: string;
  bodyText?: string;
  preview: string;
  attachments: Array<{ name: string }>;
}) {
  const attachmentLine =
    input.attachments.length > 0
      ? `첨부: ${input.attachments.map((attachment) => attachment.name).join(", ")}\n`
      : "";

  return [
    "안녕하세요.",
    "",
    "아래 메일 전달드립니다.",
    "",
    "---------- 전달된 메일 ----------",
    `보낸 사람: ${input.from} <${input.fromEmail}>`,
    `제목: ${input.subject}`,
    attachmentLine.trimEnd(),
    "",
    input.bodyText?.trim() || input.preview,
  ]
    .filter(Boolean)
    .join("\n");
}

function modeLabel(mode: ComposeMode) {
  if (mode === "reply") {
    return "답장";
  }

  if (mode === "forward") {
    return "전달";
  }

  return "새 메일";
}

export function MailComposeSheet({
  intent,
  onClose,
  onSent,
}: {
  intent: ComposerIntent;
  onClose: () => void;
  onSent: (result: SendMailResult) => void;
}) {
  const { data: accounts } = useAccounts();
  const { data: thread, loading: threadLoading } = useThread(intent.threadId ?? null);
  const draft = useGenerateMailDraft();
  const sendMail = useSendMail();

  const [accountId, setAccountId] = useState(intent.accountId ?? "");
  const [toInput, setToInput] = useState("");
  const [ccInput, setCcInput] = useState("");
  const [bccInput, setBccInput] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [autoDrafted, setAutoDrafted] = useState(false);

  useEffect(() => {
    if (accountId || !accounts || accounts.length === 0) {
      return;
    }

    setAccountId(intent.accountId ?? thread?.accountId ?? accounts[0]?.id ?? "");
  }, [accountId, accounts, intent.accountId, thread?.accountId]);

  useEffect(() => {
    if (initialized) {
      return;
    }

    if (intent.mode !== "compose" && threadLoading) {
      return;
    }

    const resolvedAccountId = intent.accountId ?? thread?.accountId ?? accounts?.[0]?.id ?? "";
    if (resolvedAccountId) {
      setAccountId(resolvedAccountId);
    }

    if (intent.mode === "reply" && thread) {
      setToInput(thread.fromEmail);
      setSubject(ensureSubjectPrefix(thread.subject, "Re:"));
      setBody("");
    }

    if (intent.mode === "forward" && thread) {
      setSubject(ensureSubjectPrefix(thread.subject, "Fwd:"));
      setBody(buildForwardTemplate(thread));
    }

    setInitialized(true);
  }, [accounts, initialized, intent.accountId, intent.mode, thread, threadLoading]);

  useEffect(() => {
    if (intent.mode === "compose" || autoDrafted || !initialized) {
      return;
    }

    if (intent.threadId && !thread) {
      return;
    }

    setAutoDrafted(true);
    void draft.run({
      mode: intent.mode,
      threadId: intent.threadId ?? undefined,
      accountId: accountId || undefined,
      subject: subject || undefined,
      body: body || undefined,
    });
  }, [accountId, autoDrafted, body, draft, initialized, intent.mode, intent.threadId, subject, thread]);

  const currentAccount = accounts?.find((account) => account.id === accountId);

  async function handleSend() {
    setError(null);

    if (!accountId) {
      setError("보낼 계정을 선택해 주세요.");
      return;
    }

    if (splitAddresses(toInput).length === 0) {
      setError("받는 사람 이메일을 입력해 주세요.");
      return;
    }

    if (!subject.trim()) {
      setError("제목을 입력해 주세요.");
      return;
    }

    if (!body.trim()) {
      setError("본문을 입력해 주세요.");
      return;
    }

    try {
      const result = await sendMail.run({
        mode: intent.mode,
        accountId,
        threadId: intent.threadId ?? undefined,
        to: splitAddresses(toInput),
        cc: splitAddresses(ccInput),
        bcc: splitAddresses(bccInput),
        subject,
        body,
      });
      onSent(result);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "메일 전송에 실패했습니다.");
    }
  }

  async function handleGenerateDraft() {
    setError(null);

    try {
      await draft.run({
        mode: intent.mode,
        threadId: intent.threadId ?? undefined,
        accountId: accountId || undefined,
        prompt: prompt.trim() || undefined,
        subject: subject.trim() || undefined,
        body: body.trim() || undefined,
      });
    } catch (draftError) {
      setError(draftError instanceof Error ? draftError.message : "메일 초안을 생성하지 못했습니다.");
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.48)",
        display: "grid",
        placeItems: "center",
        padding: 20,
        zIndex: 60,
      }}
    >
      <div
        className="panel"
        style={{
          width: "min(1180px, 100%)",
          maxHeight: "calc(100vh - 40px)",
          overflow: "hidden",
          display: "grid",
          gridTemplateColumns: "340px minmax(0, 1fr)",
        }}
      >
        <aside
          className="scrollbar"
          style={{
            padding: 24,
            borderRight: "1px solid var(--border)",
            overflow: "auto",
            background: "linear-gradient(180deg, var(--bg-0) 0%, var(--bg-1) 100%)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.04em" }}>{modeLabel(intent.mode)}</div>
              <div style={{ marginTop: 8, fontSize: 13, color: "var(--fg-2)", lineHeight: 1.6 }}>
                답장, 전달, 새 메일 작성 모두 같은 composer에서 처리하고 AI 초안 변형을 바로 적용할 수 있습니다.
              </div>
            </div>
            <button onClick={onClose} style={ghostButtonStyle()} aria-label="닫기">
              <X size={16} />
            </button>
          </div>

          {thread ? (
            <div
              style={{
                marginTop: 18,
                borderRadius: 16,
                border: "1px solid var(--border)",
                background: "var(--bg-0)",
                padding: 16,
                display: "grid",
                gap: 10,
              }}
            >
              <div style={{ fontSize: 12, color: "var(--fg-2)" }}>원본 메일 컨텍스트</div>
              <div style={{ fontWeight: 700, lineHeight: 1.4 }}>{thread.subject}</div>
              <div style={{ fontSize: 12, color: "var(--fg-2)" }}>
                {thread.from} · {thread.fromEmail}
              </div>
              <div style={{ fontSize: 12, color: "var(--fg-2)" }}>
                {formatThreadDate(thread.receivedAt)} {formatThreadTime(thread.receivedAt)}
              </div>
              <div
                style={{
                  padding: 12,
                  borderRadius: 12,
                  background: "var(--accent-soft)",
                  color: "var(--accent-soft-fg)",
                  fontSize: 13,
                  lineHeight: 1.7,
                }}
              >
                {thread.summary.oneLine}
              </div>
            </div>
          ) : null}

          <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
            <Field
              label="AI 요청"
              helpText={
                intent.mode === "compose"
                  ? "예: 미팅 일정 제안, 투자사 후속 공유, 계약 검토 요청"
                  : "예: 조금 더 단호하게, 일정 제안 포함, 다음 단계 명확히"
              }
            >
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="AI에게 반영할 지시를 적어 주세요."
                style={inputStyle(true)}
              />
            </Field>

            <button onClick={() => void handleGenerateDraft()} style={primaryButtonStyle()}>
              {draft.loading ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
              AI 초안 생성
            </button>
          </div>

          <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>AI 변형</div>
            {draft.loading ? (
              <div
                style={{
                  borderRadius: 14,
                  border: "1px solid var(--border)",
                  background: "var(--bg-0)",
                  padding: 16,
                  color: "var(--fg-2)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Loader2 size={16} className="spin" />
                메일 초안을 생성하는 중입니다.
              </div>
            ) : draft.variants && draft.variants.length > 0 ? (
              draft.variants.map((variant) => (
                <div
                  key={`${variant.tone}-${variant.label}`}
                  style={{
                    borderRadius: 14,
                    border: "1px solid var(--border)",
                    background: "var(--bg-0)",
                    padding: 14,
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <strong>{variant.label}</strong>
                    <button
                      onClick={() => {
                        setSubject(variant.subject);
                        setBody(variant.body);
                        if (variant.to.length > 0) {
                          setToInput(joinAddresses(variant.to));
                        }
                        if (variant.cc.length > 0) {
                          setCcInput(joinAddresses(variant.cc));
                        }
                        if (variant.bcc.length > 0) {
                          setBccInput(joinAddresses(variant.bcc));
                        }
                      }}
                      style={ghostButtonStyle()}
                    >
                      적용
                    </button>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--fg-2)" }}>{variant.subject}</div>
                  <div
                    style={{
                      whiteSpace: "pre-wrap",
                      lineHeight: 1.7,
                      color: "var(--fg-1)",
                      fontSize: 13,
                    }}
                  >
                    {variant.body}
                  </div>
                </div>
              ))
            ) : (
              <div
                style={{
                  borderRadius: 14,
                  border: "1px dashed var(--border)",
                  padding: 16,
                  color: "var(--fg-2)",
                  lineHeight: 1.7,
                  background: "var(--bg-0)",
                }}
              >
                {intent.mode === "compose"
                  ? "AI 요청이나 제목/본문 초안을 바탕으로 3가지 톤 변형을 생성합니다."
                  : "답장/전달은 열자마자 3가지 초안 변형을 자동으로 준비합니다."}
              </div>
            )}
          </div>
        </aside>

        <section className="scrollbar" style={{ padding: 24, overflow: "auto", background: "var(--bg-1)" }}>
          <div style={{ display: "grid", gap: 14 }}>
            <Field label="보내는 계정">
              {intent.mode === "compose" ? (
                <select value={accountId} onChange={(event) => setAccountId(event.target.value)} style={inputStyle()}>
                  <option value="">계정을 선택하세요.</option>
                  {(accounts ?? []).map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.label} · {account.email}
                    </option>
                  ))}
                </select>
              ) : (
                <div
                  style={{
                    ...inputStyle(),
                    display: "flex",
                    alignItems: "center",
                    minHeight: 48,
                  }}
                >
                  {currentAccount ? `${currentAccount.label} · ${currentAccount.email}` : "계정 로딩 중"}
                </div>
              )}
            </Field>

            <Field label="받는 사람" helpText="여러 주소는 쉼표 또는 줄바꿈으로 구분하세요.">
              <textarea value={toInput} onChange={(event) => setToInput(event.target.value)} style={inputStyle()} rows={2} />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 }}>
              <Field label="참조(CC)">
                <textarea value={ccInput} onChange={(event) => setCcInput(event.target.value)} style={inputStyle()} rows={2} />
              </Field>
              <Field label="숨은참조(BCC)">
                <textarea value={bccInput} onChange={(event) => setBccInput(event.target.value)} style={inputStyle()} rows={2} />
              </Field>
            </div>

            <Field label="제목">
              <input value={subject} onChange={(event) => setSubject(event.target.value)} style={inputStyle()} />
            </Field>

            <Field label="본문">
              <textarea value={body} onChange={(event) => setBody(event.target.value)} style={inputStyle(true)} />
            </Field>

            {error ? (
              <div
                style={{
                  borderRadius: 14,
                  background: "rgba(220, 38, 38, 0.08)",
                  color: "var(--danger)",
                  padding: "12px 14px",
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            ) : null}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={onClose} style={ghostButtonStyle()}>
                취소
              </button>
              <button onClick={() => void handleSend()} style={{ ...primaryButtonStyle(), width: "auto" }}>
                {sendMail.loading ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
                메일 보내기
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
