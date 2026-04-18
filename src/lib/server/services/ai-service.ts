import { formatBriefingDate } from "@/lib/shared/time";
import type {
  Briefing,
  Category,
  ReplyVariant,
  Thread,
  ThreadSummary,
} from "@/lib/shared/types";

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
  const language = detectLanguage(thread);
  const hasAttachment = thread.attachments.length > 0;

  if (language === "en") {
    const attachmentLine = hasAttachment ? " I reviewed the attachment as well." : "";
    return [
      {
        label: "Concise",
        body: `Thanks for the note.${attachmentLine} I will get back to you shortly.`,
      },
      {
        label: "Helpful",
        body: `Thanks for sharing this.${attachmentLine} We are reviewing it now and I will send a more concrete update by the end of the day.`,
      },
      {
        label: "Formal",
        body: `Hello,\n\nThank you for the detailed context.${attachmentLine} We are reviewing the request internally and will respond with a consolidated update as soon as possible.\n\nBest regards,`,
      },
    ];
  }

  const attachmentLine = hasAttachment ? " 첨부도 함께 확인했습니다." : "";
  return [
    {
      label: "간결",
      body: `확인했습니다.${attachmentLine} 빠르게 정리해서 다시 말씀드리겠습니다.`,
    },
    {
      label: "협조적",
      body: `공유 감사합니다.${attachmentLine} 내부 검토 후 오늘 안으로 다음 액션을 정리해서 회신드리겠습니다.`,
    },
    {
      label: "정중·길게",
      body: `안녕하세요.\n\n자료 공유 감사드립니다.${attachmentLine} 요청 주신 내용을 기준으로 내부 검토를 진행한 뒤, 필요한 판단과 후속 일정까지 정리해서 다시 회신드리겠습니다.\n\n감사합니다.`,
    },
  ];
}

export function createBriefing(threads: Thread[]): Briefing {
  const activeThreads = threads.filter((thread) => !thread.archived);
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
