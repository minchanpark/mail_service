# Inbox One

`dev/PRD.md`, `dev/TDD.md`, `inbox_one.jsx` 프로토타입을 바탕으로 실제 실행 가능한 Next.js + API 백엔드 버전으로 확장한 저장소입니다.

## 실행

```bash
npm install
npm run dev
```

기본 주소: `http://localhost:3000`

## 구현된 범위

- 통합 인박스 UI
- Next.js App Router 기반 API 백엔드
- 파일 기반 로컬 저장소 (`data/mail-service-db.json`)
- AI 요약 / 답장 초안 / 브리핑 서버 레이어
- 확장 가능한 메일 provider 레지스트리
- 지원 provider
  - `mock`
  - `gmail` (IMAP 앱 비밀번호)
  - `outlook` (IMAP)
  - `naver` (IMAP 앱 비밀번호)
  - `custom-imap` (임의 IMAP 서버)

## 구조

- `src/app` : 화면과 API route
- `src/components/inbox` : 메인 인박스 UI
- `src/lib/client` : HTTP backend adapter, hooks, context
- `src/lib/server/services` : 비즈니스 로직
- `src/lib/server/providers` : 메일 provider 드라이버
- `src/lib/server/store` : 파일 저장소와 시드 데이터

## provider 확장 방법

1. `src/lib/server/providers/types.ts`의 `MailProviderDriver` 인터페이스를 구현합니다.
2. 새 driver를 `src/lib/server/providers/registry.ts`에 등록합니다.
3. 필요하면 연결 폼 필드를 `descriptor.fields`에 정의합니다.
4. `syncInbox()`에서 공통 `Thread` 모델로 정규화해서 반환합니다.

## 참고

- 현재 AI는 규칙 기반 mock 레이어입니다. 추후 Anthropic/OpenAI 호출은 `src/lib/server/services/ai-service.ts` 뒤에 교체하면 됩니다.
- 로컬 저장소는 데모/개발용입니다. 운영 전환 시 Supabase/Postgres 저장소를 같은 서비스 계층 뒤에 붙이면 됩니다.
