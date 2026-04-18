import type { AppState, Thread } from "@/lib/shared/types";

const MAX_STORED_BODY_TEXT_LENGTH = 12000;
const BODY_TRUNCATION_NOTICE = "\n\n[메일 본문이 길어 일부 내용만 저장되었습니다.]";

function compactBodyText(bodyText: string | undefined) {
  if (!bodyText) {
    return undefined;
  }

  if (bodyText.length <= MAX_STORED_BODY_TEXT_LENGTH) {
    return bodyText;
  }

  const nextLength = Math.max(0, MAX_STORED_BODY_TEXT_LENGTH - BODY_TRUNCATION_NOTICE.length);
  return `${bodyText.slice(0, nextLength)}${BODY_TRUNCATION_NOTICE}`;
}

export function compactThreadForStorage(thread: Thread): Thread {
  return {
    ...thread,
    bodyHtml: undefined,
    bodyText: compactBodyText(thread.bodyText),
  };
}

export function compactAppStateForStorage(state: AppState): AppState {
  return {
    ...state,
    threads: state.threads.map(compactThreadForStorage),
  };
}
