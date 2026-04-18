import { formatBriefingDate } from "@/other/utils/time";
import type {
  Briefing,
  Category,
  ComposeMode,
  DraftTone,
  MailDraftVariant,
  ReplyVariant,
  Thread,
  ThreadSummary,
} from "@/models";

const ACTION_KEYWORDS = [
  "회신",
  "reply",
  "확인",
  "검토",
  "request",
  "please",
  "필요",
  "urgent",
  "proposal",
  "문의",
];

const NEWSLETTER_KEYWORDS = ["digest", "newsletter", "weekly", "주간"];
const TRANSACTION_KEYWORDS = ["invoice", "receipt", "payout", "거래", "정산", "결제"];
const AUTOMATION_KEYWORDS = ["no-reply", "noreply", "notification", "alert", "자동"];

function pickSentences(text: string, count: number) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, count);
}

function truncate(input: string, max = 92) {
  if (input.length <= max) {
    return input;
  }

  return `${input.slice(0, max - 1).trim()}…`;
}

function detectLanguage(thread: Thread) {
  const sample = `${thread.subject} ${thread.preview} ${thread.bodyText ?? ""}`;
  return /[ㄱ-ㅎ가-힣]/.test(sample) ? "ko" : "en";
}

function detectTextLanguage(input: string) {
  return /[ㄱ-ㅎ가-힣]/.test(input) ? "ko" : "en";
}

function ensureSubjectPrefix(subject: string, prefix: string) {
  const normalized = subject.trim();
  if (!normalized) {
    return prefix === "Re:" ? "Re: 제목 없음" : "Fwd: 제목 없음";
  }

  return normalized.toLowerCase().startsWith(prefix.toLowerCase()) ? normalized : `${prefix} ${normalized}`;
}

function normalizePrompt(prompt?: string) {
  return prompt?.trim() ? prompt.trim() : null;
}

function buildPromptLine(prompt: string | null, language: "ko" | "en") {
  if (!prompt) {
    return "";
  }

  return language === "ko"
    ? `추가 요청: ${prompt}\n`
    : `Additional guidance: ${prompt}\n`;
}

function buildForwardedBlock(thread: Thread, language: "ko" | "en") {
  const attachments =
    thread.attachments.length > 0
      ? language === "ko"
        ? `첨부: ${thread.attachments.map((attachment) => attachment.name).join(", ")}`
        : `Attachments: ${thread.attachments.map((attachment) => attachment.name).join(", ")}`
      : "";

  const headerLines =
    language === "ko"
      ? [
          "---------- 전달된 메일 ----------",
          `보낸 사람: ${thread.from} <${thread.fromEmail}>`,
          `제목: ${thread.subject}`,
        ]
      : [
          "---------- Forwarded message ----------",
          `From: ${thread.from} <${thread.fromEmail}>`,
          `Subject: ${thread.subject}`,
        ];

  if (attachments) {
    headerLines.push(attachments);
  }

  headerLines.push("", thread.bodyText?.trim() || thread.preview);
  return headerLines.join("\n");
}

function buildComposeSubject(baseSubject: string | undefined, prompt: string | null, language: "ko" | "en") {
  if (baseSubject?.trim()) {
    return baseSubject.trim();
  }

  if (prompt) {
    return prompt.length > 48 ? `${prompt.slice(0, 47).trim()}…` : prompt;
  }

  return language === "ko" ? "안녕하세요, 문의드립니다." : "Hello, following up.";
}

function createComposeBody(language: "ko" | "en", tone: DraftTone, prompt: string | null, subject: string, existingBody?: string) {
  const focus = prompt ?? existingBody?.trim() ?? subject;
  const briefFocus = truncate(focus || (language === "ko" ? "공유드릴 내용을 정리했습니다." : "I wanted to share a quick update."), 140);

  if (language === "en") {
    if (tone === "concise") {
      return `Hello,\n\nI’m reaching out regarding ${briefFocus}.\nPlease let me know if this works for you.\n\nBest regards,`;
    }

    if (tone === "helpful") {
      return `Hello,\n\nI’m reaching out regarding ${briefFocus}.\nI wanted to share the context clearly and check whether we can align on the next step.\nPlease let me know what timing works best for you.\n\nBest regards,`;
    }

    return `Hello,\n\nI hope you are doing well.\nI’m reaching out regarding ${briefFocus}.\nI wanted to share the relevant context in one place and confirm the most appropriate next step.\nIf helpful, I can also prepare a more detailed follow-up after your review.\n\nBest regards,`;
  }

  if (tone === "concise") {
    return `안녕하세요.\n\n${briefFocus} 관련해 연락드립니다.\n확인 가능하신 시점 말씀 부탁드립니다.\n\n감사합니다.`;
  }

  if (tone === "helpful") {
    return `안녕하세요.\n\n${briefFocus} 관련해 연락드립니다.\n상황을 한 번에 검토하실 수 있도록 핵심 맥락을 함께 정리드리고 싶었습니다.\n가능하신 일정이나 필요한 추가 정보가 있다면 편하게 말씀 부탁드립니다.\n\n감사합니다.`;
  }

  return `안녕하세요.\n\n항상 도움 주셔서 감사합니다.\n${briefFocus} 관련해 현재 내용을 정리해 공유드립니다.\n검토 후 가장 적절한 다음 단계나 필요한 보완 사항이 있다면 말씀 부탁드립니다.\n필요하시면 추가 자료도 바로 이어서 전달드리겠습니다.\n\n감사합니다.`;
}

function buildReplyBody(thread: Thread, tone: DraftTone, prompt: string | null, language: "ko" | "en") {
  const attachmentLine = thread.attachments.length > 0
    ? language === "ko"
      ? " 첨부도 함께 확인했습니다."
      : " I reviewed the attachment as well."
    : "";
  const promptLine = buildPromptLine(prompt, language);

  if (language === "en") {
    if (tone === "concise") {
      return `Hello,\n\nThanks for the note.${attachmentLine}\n${promptLine}I’m reviewing this now and will follow up shortly.\n\nBest regards,`;
    }

    if (tone === "helpful") {
      return `Hello,\n\nThank you for sharing this.${attachmentLine}\n${promptLine}I’m reviewing the request now and will send a concrete update with the next step by the end of the day.\n\nBest regards,`;
    }

    return `Hello,\n\nThank you for the detailed context.${attachmentLine}\n${promptLine}We are reviewing the request internally and I will come back with a consolidated response, including the recommended next action, as soon as possible.\n\nBest regards,`;
  }

  if (tone === "concise") {
    return `안녕하세요.\n\n확인했습니다.${attachmentLine}\n${promptLine}빠르게 정리해서 다시 말씀드리겠습니다.\n\n감사합니다.`;
  }

  if (tone === "helpful") {
    return `안녕하세요.\n\n공유 감사합니다.${attachmentLine}\n${promptLine}요청 주신 내용을 기준으로 내부 검토를 진행한 뒤, 오늘 안으로 다음 액션까지 정리해서 회신드리겠습니다.\n\n감사합니다.`;
  }

  return `안녕하세요.\n\n자료 공유 감사드립니다.${attachmentLine}\n${promptLine}전달 주신 내용을 기준으로 내부 검토를 진행하고, 필요한 판단과 후속 일정까지 한 번에 보실 수 있도록 정리해서 다시 회신드리겠습니다.\n\n감사합니다.`;
}

function buildForwardBody(thread: Thread, tone: DraftTone, prompt: string | null, language: "ko" | "en") {
  const forwardedBlock = buildForwardedBlock(thread, language);
  const promptLine = buildPromptLine(prompt, language);

  if (language === "en") {
    if (tone === "concise") {
      return `Hello,\n\nForwarding this for quick review.\n${promptLine}\n${forwardedBlock}`;
    }

    if (tone === "helpful") {
      return `Hello,\n\nForwarding this for review.\nThe key point is that ${truncate(thread.summary.oneLine, 120)}\n${promptLine}\n${forwardedBlock}`;
    }

    return `Hello,\n\nI’m forwarding the message below for review.\nThe important context is summarized as follows: ${truncate(thread.summary.oneLine, 120)}\n${promptLine}Please let me know if you would like me to prepare a follow-up after you review it.\n\n${forwardedBlock}`;
  }

  if (tone === "concise") {
    return `안녕하세요.\n\n아래 메일 전달드립니다.\n${promptLine}\n${forwardedBlock}`;
  }

  if (tone === "helpful") {
    return `안녕하세요.\n\n검토하실 수 있도록 아래 메일 전달드립니다.\n핵심은 ${truncate(thread.summary.oneLine, 120)}\n${promptLine}\n${forwardedBlock}`;
  }

  return `안녕하세요.\n\n참고 및 검토를 위해 아래 메일 전달드립니다.\n현재 중요하게 봐야 할 포인트는 ${truncate(thread.summary.oneLine, 120)} 입니다.\n${promptLine}검토 후 필요하시면 제가 후속 회신 초안까지 이어서 정리하겠습니다.\n\n${forwardedBlock}`;
}

export function classifyThread(thread: Pick<Thread, "fromEmail" | "subject" | "preview">): Category {
  const haystack = `${thread.fromEmail} ${thread.subject} ${thread.preview}`.toLowerCase();

  if (TRANSACTION_KEYWORDS.some((keyword) => haystack.includes(keyword))) {
    return "transaction";
  }

  if (NEWSLETTER_KEYWORDS.some((keyword) => haystack.includes(keyword))) {
    return "newsletter";
  }

  if (AUTOMATION_KEYWORDS.some((keyword) => haystack.includes(keyword))) {
    return "automation";
  }

  if (ACTION_KEYWORDS.some((keyword) => haystack.includes(keyword))) {
    return "important";
  }

  return "other";
}

export function shouldMarkAction(thread: Pick<Thread, "subject" | "preview" | "bodyText">) {
  const haystack = `${thread.subject} ${thread.preview} ${thread.bodyText ?? ""}`.toLowerCase();
  return ACTION_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

export function generateSummary(thread: Thread): ThreadSummary {
  const baseText = thread.bodyText ?? thread.preview ?? thread.subject;
  const lines = pickSentences(baseText, 3);
  const threeLines = [
    truncate(lines[0] ?? `${thread.from}가 "${thread.subject}" 메일을 보냈습니다.`),
    truncate(
      lines[1] ??
        (thread.hasAction
          ? "회신 또는 후속 액션이 필요한 메일로 분류되었습니다."
          : "핵심 내용은 본문 열람 없이도 확인 가능한 수준으로 정리되었습니다."),
    ),
    truncate(
      lines[2] ??
        (thread.attachments.length > 0
          ? `첨부 ${thread.attachments.length}개가 함께 도착했습니다.`
          : `분류 결과는 ${thread.category} 카테고리입니다.`),
    ),
  ];

  return {
    oneLine: truncate(lines[0] ?? thread.preview ?? thread.subject, 110),
    threeLines,
    status: "ready",
    model: "rule-based-local",
    updatedAt: new Date().toISOString(),
  };
}

export function generateReplyVariants(thread: Thread): ReplyVariant[] {
  return generateMailDraftVariants({
    mode: "reply",
    thread,
  }).map((variant) => ({
    label: variant.label,
    body: variant.body,
  }));
}

export function generateMailDraftVariants(input: {
  mode: ComposeMode;
  thread?: Thread | null;
  prompt?: string;
  subject?: string;
  body?: string;
}): MailDraftVariant[] {
  const prompt = normalizePrompt(input.prompt);
  const thread = input.thread ?? null;
  const language =
    thread
      ? detectLanguage(thread)
      : detectTextLanguage([input.subject, input.body, prompt].filter(Boolean).join(" "));
  const tones: Array<{ tone: DraftTone; label: string }> =
    language === "en"
      ? [
          { tone: "concise", label: "Concise" },
          { tone: "helpful", label: "Helpful" },
          { tone: "formal", label: "Formal" },
        ]
      : [
          { tone: "concise", label: "간결" },
          { tone: "helpful", label: "협조적" },
          { tone: "formal", label: "정중·길게" },
        ];

  return tones.map(({ tone, label }) => {
    if (input.mode === "reply" && thread) {
      return {
        label,
        tone,
        to: thread.fromEmail ? [thread.fromEmail] : [],
        cc: [],
        bcc: [],
        subject: ensureSubjectPrefix(thread.subject, "Re:"),
        body: buildReplyBody(thread, tone, prompt, language),
      };
    }

    if (input.mode === "forward" && thread) {
      return {
        label,
        tone,
        to: [],
        cc: [],
        bcc: [],
        subject: ensureSubjectPrefix(thread.subject, "Fwd:"),
        body: buildForwardBody(thread, tone, prompt, language),
      };
    }

    const subject = buildComposeSubject(input.subject, prompt, language);

    return {
      label,
      tone,
      to: [],
      cc: [],
      bcc: [],
      subject,
      body: createComposeBody(language, tone, prompt, subject, input.body),
    };
  });
}

export function createBriefing(threads: Thread[]): Briefing {
  const activeThreads = threads.filter((thread) => !thread.archived && thread.direction !== "sent");
  const important = activeThreads.filter((thread) => thread.category === "important").length;
  const needsReply = activeThreads.filter((thread) => thread.hasAction).length;
  const autoFiled = activeThreads.filter((thread) => thread.category !== "important").length;
  const topUrgent = activeThreads
    .filter((thread) => thread.hasAction)
    .sort((a, b) => +new Date(b.receivedAt) - +new Date(a.receivedAt))
    .slice(0, 3)
    .map((thread) => ({ threadId: thread.id, title: thread.subject }));

  const timeSavedMinutes = activeThreads.length * 2 + needsReply * 4;
  const hours = Math.floor(timeSavedMinutes / 60);
  const minutes = timeSavedMinutes % 60;

  return {
    received: activeThreads.length,
    important,
    needsReply,
    autoFiled,
    timeSavedLabel: hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`,
    dateLabel: formatBriefingDate(),
    topUrgent,
  };
}
