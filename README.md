# Inbox One

`dev/PRD.md`, `dev/TDD.md`, `inbox_one.jsx` 프로토타입을 바탕으로 실제 실행 가능한 Next.js + API 백엔드 버전으로 확장한 저장소입니다.

## 실행

```bash
npm install
npm run dev
```

기본 주소: `http://localhost:3000`

## 진단 스킬과 툴링

- 보안 점검: `audit-ci`, `retire`, `.codex/skills/web-security-audit`
- 네트워크 성능 점검: `autocannon`, `.codex/skills/web-network-performance`
- 메모리 점검: `clinic`, `.codex/skills/web-memory-profile`

자주 쓰는 명령:

```bash
npm run security:scan
npm run perf:network
npm run perf:memory
```

## 구현된 범위

- 통합 인박스 UI
- Next.js App Router 기반 API 백엔드
- 파일 기반 로컬 저장소 (`data/mail-service-db.json`)
- AI 요약 / 답장 초안 / 브리핑 서버 레이어
- 확장 가능한 메일 provider 레지스트리
- 실제 메일 송신 지원 (`새 메일`, `답장`, `전달`, `CC/BCC`, `보낸 메일`)
- IMAP 계정의 원격 메일함 백필 페이지네이션
- 지원 provider
  - `mock`
  - `gmail` (IMAP/SMTP + 앱 비밀번호)
  - `outlook` (IMAP/SMTP)
  - `naver` (IMAP/SMTP + 앱 비밀번호)
  - `custom-imap` (임의의 IMAP/SMTP 서버)

## 구조

- `src/app` : 화면과 API route
- `src/views/inbox` : 메인 인박스 페이지 UI
- `src/controllers/inbox` : provider 스타일 페이지 상태관리
- `src/services/api` : 백엔드 API 매핑 서비스
- `src/components/inbox` : 이전 import를 위한 호환 래퍼
- `src/lib/client` : 재사용 가능한 저수준 browser hooks/helper
- `src/lib/server/services` : 비즈니스 로직
- `src/lib/server/providers` : 메일 provider 드라이버
- `src/lib/server/store` : 파일 저장소와 시드 데이터

## 송신 기능

- `새 메일 작성`, `답장`, `전달`, `참조(CC)`, `숨은참조(BCC)`를 지원합니다.
- 전송 성공 시 `보낸 메일` 뷰에 sent thread가 생성됩니다.
- AI composer는 `reply`, `forward`, `compose` 모드별로 3가지 톤 변형 초안을 생성합니다.
- `custom-imap` 계정은 연결 시 IMAP뿐 아니라 SMTP host/port/TLS 값도 함께 입력해야 전송이 가능합니다.
- `naver` 계정은 네이버 메일 PC 환경설정에서 `IMAP/SMTP`를 `사용함`으로 바꾼 뒤, 네이버 로그인 `2단계 인증`과 `애플리케이션 비밀번호`를 설정해야 연결됩니다.
- Gmail/Naver/Outlook/Custom IMAP은 최초 연결 시 최근 묶음을 먼저 가져오고, 이후 목록 페이지를 더 요청할 때 원격 IMAP에서도 다음 묶음을 계속 백필합니다.
- 파일 기반 개발 저장소는 메모리 폭증을 막기 위해 본문 HTML은 저장하지 않고, 긴 본문 텍스트는 일부만 compact해서 저장합니다.

## provider 확장 방법

1. `src/lib/server/providers/types.ts`의 `MailProviderDriver` 인터페이스를 구현합니다.
2. 새 driver를 `src/lib/server/providers/registry.ts`에 등록합니다.
3. 필요하면 연결 폼 필드를 `descriptor.fields`에 정의합니다.
4. `syncInbox()`에서 공통 `Thread` 모델로 정규화해서 반환합니다.
5. 송신이 필요한 provider는 `sendMail()`도 구현해 SMTP/API 전송을 처리합니다.

## 참고

- 현재 AI는 규칙 기반 mock 레이어입니다. 추후 Anthropic/OpenAI 호출은 `src/lib/server/services/ai-service.ts` 뒤에 교체하면 됩니다.
- 로컬 저장소는 데모/개발용입니다. 운영 전환 시 Supabase/Postgres 저장소를 같은 서비스 계층 뒤에 붙이면 됩니다.
- Outlook은 현재 SMTP/IMAP 비밀번호 기반 구현이라, Microsoft 계정 정책에 따라 Modern Auth/OAuth 전환이 추가로 필요할 수 있습니다.
