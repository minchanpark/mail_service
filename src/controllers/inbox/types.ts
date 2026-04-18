import type { ComposeMode } from "@/lib/shared/types";

export type ComposerIntent = {
  mode: ComposeMode;
  accountId?: string | null;
  threadId?: string | null;
};
