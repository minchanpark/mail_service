import type { AccountProvider } from "./account";
import type { Thread } from "./thread";

export type ComposeMode = "compose" | "reply" | "forward";
export type DraftTone = "concise" | "helpful" | "formal";

export interface ReplyVariant {
  label: string;
  body: string;
}

export interface MailDraftVariant {
  label: string;
  tone: DraftTone;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
}

export interface GenerateMailDraftPayload {
  mode: ComposeMode;
  threadId?: string;
  accountId?: string;
  prompt?: string;
  subject?: string;
  body?: string;
}

export interface SendMailPayload {
  mode: ComposeMode;
  accountId: string;
  threadId?: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
}

export interface SendMailResult {
  thread: Thread;
  accepted: string[];
  rejected: string[];
  provider: AccountProvider;
  deliverySummary: string;
}
