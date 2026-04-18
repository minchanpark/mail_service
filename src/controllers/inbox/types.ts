import type { ComposeMode } from "@/models";

export type ComposerIntent = {
  mode: ComposeMode;
  accountId?: string | null;
  threadId?: string | null;
};
