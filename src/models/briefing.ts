export interface Briefing {
  received: number;
  important: number;
  needsReply: number;
  autoFiled: number;
  timeSavedLabel: string;
  dateLabel: string;
  topUrgent: Array<{ threadId: string; title: string }>;
}
