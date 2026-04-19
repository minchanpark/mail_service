import type { AppState } from "@/models";

const LOCAL_USER_ID = "u_local";

export function createSeedState(): AppState {
  return {
    user: {
      id: LOCAL_USER_ID,
      email: "local@inbox.one",
      displayName: "로컬 사용자",
    },
    accounts: [],
    labels: [],
    threads: [],
  };
}
