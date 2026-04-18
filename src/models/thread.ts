import type { ComposeMode } from "./mail";

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

export type SummaryStatus = "pending" | "ready" | "failed";
export type ThreadDirection = "received" | "sent";

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

export interface ThreadListResponse {
  items: Thread[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}
