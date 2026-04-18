const KOREAN_DATE = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

const KOREAN_TIME = new Intl.DateTimeFormat("ko-KR", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export function formatThreadDate(iso: string) {
  const date = new Date(iso);
  return KOREAN_DATE.format(date);
}

export function formatThreadTime(iso: string) {
  const date = new Date(iso);
  return KOREAN_TIME.format(date);
}

export function formatBriefingDate(input = new Date()) {
  return `${input.getMonth() + 1}월 ${input.getDate()}일`;
}
