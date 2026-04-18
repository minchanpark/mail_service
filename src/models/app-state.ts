import type { Label, StoredAccount, User } from "./account";
import type { Thread } from "./thread";

export interface AppState {
  user: User;
  accounts: StoredAccount[];
  labels: Label[];
  threads: Thread[];
}
