export type ThreadView =
  | "all"
  | "unread"
  | "needsReply"
  | "starred"
  | "sent"
  | "snoozed";

export type Category =
  | "important"
  | "newsletter"
  | "transaction"
  | "automation"
  | "other";

export type ProviderId = "mock" | "gmail" | "outlook" | "naver" | "custom-imap";
export type AccountProvider = "gmail" | "outlook" | "naver" | "custom-imap" | "mock";
export type AccountStatus = "active" | "reauth_needed" | "disconnected";
export type SummaryStatus = "pending" | "ready" | "failed";
export type ThreadDirection = "received" | "sent";
export type ComposeMode = "compose" | "reply" | "forward";
export type DraftTone = "concise" | "helpful" | "formal";

export interface User {
  id: string;
  email: string;
  displayName: string;
}

export interface Account {
  id: string;
  userId: string;
  driverId: ProviderId;
  provider: AccountProvider;
  email: string;
  label: string;
  unreadCount: number;
  status: AccountStatus;
  connectedAt: string;
  lastSyncedAt?: string;
  connectionSummary?: string;
}

export interface StoredAccount extends Account {
  secrets?: Record<string, string>;
  settings?: Record<string, string>;
}

export interface Label {
  id: string;
  userId: string;
  name: string;
  color: string;
}

export interface Attachment {
  name: string;
  size: string;
}

export interface ThreadSummary {
  oneLine: string;
  threeLines: string[];
  status: SummaryStatus;
  model: string;
  updatedAt: string;
}

export interface Thread {
  id: string;
  userId: string;
  accountId: string;
  from: string;
  fromEmail: string;
  to?: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  preview: string;
  receivedAt: string;
  unread: boolean;
  starred: boolean;
  archived: boolean;
  snoozedUntil?: string | null;
  direction?: ThreadDirection;
  sentMode?: ComposeMode | null;
  sourceThreadId?: string | null;
  providerMessageId?: string;
  category: Category;
  labelIds: string[];
  attachments: Attachment[];
  hasAction: boolean;
  summary: ThreadSummary;
  bodyHtml?: string;
  bodyText?: string;
}

export interface ThreadFilter {
  kind: ThreadView;
  accountId?: string;
  category?: Category;
  labelId?: string;
  query?: string;
  page?: number;
  pageSize?: number;
}

export interface Briefing {
  received: number;
  important: number;
  needsReply: number;
  autoFiled: number;
  timeSavedLabel: string;
  dateLabel: string;
  topUrgent: Array<{ threadId: string; title: string }>;
}

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

export interface ProviderField {
  name: string;
  label: string;
  type: "text" | "email" | "password" | "number";
  placeholder?: string;
  helpText?: string;
  required?: boolean;
  defaultValue?: string;
}

export interface ProviderDescriptor {
  id: ProviderId;
  label: string;
  description: string;
  authType: "demo" | "app-password" | "basic";
  provider: AccountProvider;
  fields: ProviderField[];
}

export interface ConnectAccountPayload {
  driverId: ProviderId;
  email: string;
  label?: string;
  secrets?: Record<string, string>;
  settings?: Record<string, string>;
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

export interface AppState {
  user: User;
  accounts: StoredAccount[];
  labels: Label[];
  threads: Thread[];
}

export interface ThreadListResponse {
  items: Thread[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}
