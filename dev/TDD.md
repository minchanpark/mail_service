# Inbox One — 기술 설계 문서 (TDD)

| 항목 | 내용 |
|---|---|
| 문서 버전 | v0.1 (MVP 설계) |
| 작성일 | 2026-04-18 |
| 작성자 | Park (NewDawn) |
| 상태 | Draft — 백엔드 선택(Firebase vs Supabase) 의사결정 대기 |
| 관련 문서 | `PRD.md`, `inbox_one.jsx` |

---

## 1. 설계 원칙

이 시스템은 다음 원칙 위에 설계됩니다.

1. **백엔드 독립성** — 모든 데이터 액세스는 어댑터 인터페이스 뒤에. 6개월 후 Firebase → Supabase, 또는 자체 호스팅으로 옮기더라도 UI/비즈니스 로직은 그대로.
2. **메일 본문은 자산이자 책임** — 본문 데이터 흐름은 항상 명시적·감사 가능해야 하며, 외부 노출은 최소·암호화.
3. **LLM 호출은 idempotent + 캐시 우선** — 같은 메일에 대한 요약은 한 번만 생성, 사용자 피드백 시에만 재생성.
4. **읽기는 빠르게, 쓰기는 안전하게** — 인박스 첫 화면은 실시간 구독 대신 캐시 우선, 상태 변경은 optimistic + 서버 검증.
5. **점진적 향상** — AI 기능이 실패해도 메일 클라이언트는 동작.

---

## 2. 시스템 아키텍처

### 2.1 High-level 다이어그램

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (Web · React)                       │
│   ┌──────────────────────────────────────────────────────┐     │
│   │  UI Components (Sidebar / ThreadList / Detail)       │     │
│   └────────────┬─────────────────────────────────────────┘     │
│                │ uses hooks (useThreads, useThread, ...)        │
│   ┌────────────▼─────────────────────────────────────────┐     │
│   │  Backend Adapter (interface)                         │     │
│   │  - createMockAdapter()                               │     │
│   │  - createFirebaseAdapter() | createSupabaseAdapter() │     │
│   └────────────┬─────────────────────────────────────────┘     │
└────────────────┼────────────────────────────────────────────────┘
                 │ HTTPS (TLS 1.3)
        ┌────────┴────────┐
        │                 │
┌───────▼─────┐  ┌────────▼────────────────────────┐
│   Auth      │  │  Database (Firestore | Postgres)│
│  (Firebase  │  │  - users / accounts             │
│   Auth |    │  │  - threads / messages           │
│  Supabase   │  │  - thread_summaries             │
│   Auth)     │  │  - labels / category_feedback   │
└─────────────┘  │  - oauth_tokens (encrypted)     │
                 └─────────────┬───────────────────┘
                               │
                 ┌─────────────▼───────────────────┐
                 │  Serverless Functions           │
                 │  (Cloud Functions | Edge Fn)    │
                 │  ─────────────────────────────  │
                 │  · oauth/initiate   · oauth/callback                
                 │  · sync/gmail       · sync/outlook  · sync/naver
                 │  · webhook/gmail-pubsub                           
                 │  · ai/summarize     · ai/generate-reply           
                 │  · ai/reclassify    · briefing/daily              
                 └─────────────┬───────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
┌────────────────┐   ┌────────────────┐   ┌─────────────────────┐
│ Gmail API      │   │ Microsoft      │   │ Naver Mail API       │
│ (REST + Push)  │   │ Graph API      │   │ (or IMAP fallback)   │
└────────────────┘   └────────────────┘   └─────────────────────┘

                               │
                               ▼
                    ┌─────────────────────┐
                    │ Anthropic Claude API │
                    │ (요약, 답장, 분류)    │
                    └─────────────────────┘
```

### 2.2 핵심 데이터 흐름

```
[메일 도착] (외부 메일 서버)
  → Gmail Push 알림 (Pub/Sub) / Outlook webhook / Naver poll
  → Function: sync/{provider}        ← 메일 메타·본문 fetch
  → DB: threads / messages 저장
  → Function: ai/summarize 비동기 트리거    ← Claude API 호출
  → DB: thread_summaries 저장
  → Realtime: 클라이언트로 push        ← onSnapshot / postgres_changes
  → UI: 스레드 행에 1줄 요약 자동 반영
```

---

## 3. 백엔드 비교 및 추천

### 3.1 옵션 비교

| 영역 | Firebase | Supabase | Inbox One 적합도 |
|---|---|---|---|
| **데이터베이스** | Firestore (NoSQL, 문서) | Postgres (관계형 + JSONB) | **Supabase 우위** — 메일은 관계형(account-thread-message) 모델이 더 자연스럽고, 풀텍스트 검색(F-204)에 Postgres `tsvector`가 강력함 |
| **인증** | Firebase Auth — Google/MS OAuth 내장 | Supabase Auth — OAuth + 직접 토큰 관리 가능 | 비슷 |
| **서버 함수** | Cloud Functions (asia-northeast3 서울) | Edge Functions (Deno, region 선택 제한적) | **Firebase 약간 우위** — 한국 리전 명확, cold start 적음 |
| **실시간** | onSnapshot — 안정적, 비싸짐 | postgres_changes — 비용 효율적이나 row-level 트리거 설정 필요 | 비슷 |
| **풀텍스트 검색** | 별도 색인 필요 (Algolia/Typesense) | Postgres FTS 내장 | **Supabase 강한 우위** |
| **파일 저장** | Cloud Storage | Supabase Storage (S3 호환) | 비슷 |
| **OAuth 토큰 암호화** | Secret Manager + custom code | Vault (pgsodium) 내장 | **Supabase 약간 우위** |
| **Row-Level Security** | Firestore Rules (강력하지만 복잡) | Postgres RLS (선언적, 친숙) | **Supabase 우위** |
| **비용 (1,000 사용자 가정)** | Firestore 읽기 비용 빠르게 누적 | Postgres 정액 + storage | **Supabase 우위** (3.5절 참고) |
| **마이그레이션 용이성** | Firestore export → 변환 필요 | Postgres dump → 어디든 이전 | **Supabase 강한 우위** — 향후 자체 호스팅 전환 시 결정적 |

### 3.2 추천: **Supabase**

다음 네 가지 이유로 **Supabase를 1차 선택**합니다.

1. **메일 데이터의 관계형 본질** — `users → email_accounts → threads → messages → summaries`는 명백한 관계형 모델. JSONB로 유연성 확보 가능.
2. **검색 (F-204)** — 한국어 형태소 분석기(`mecab-ko`) + Postgres FTS로 별도 색인 인프라 없이 구현 가능.
3. **비용 예측성** — Firestore의 read/write 카운팅은 인박스 같은 high-read 워크로드에서 폭발적 증가. Postgres 정액 + connection pooler 조합이 안정적.
4. **Exit strategy** — Postgres는 어디든 옮길 수 있음. NewDawn이 향후 자체 호스팅이나 다른 클라우드로 가더라도 데이터 마이그레이션 비용 최소.

**단, 어댑터 패턴을 유지**해서 다음 상황에 대응합니다:
- Supabase Edge Function의 cold start이 한국 사용자에게 느릴 경우 → AI 함수만 Cloud Functions(서울 리전)로 이전 가능
- 대기업 보안 정책으로 Supabase 호스팅이 막힐 경우 → 자체 호스팅 Postgres로 즉시 전환

---

## 4. 데이터 모델

### 4.1 Postgres 스키마 (Supabase)

```sql
-- ============ users ============
-- Supabase Auth가 auth.users 테이블을 관리하므로,
-- 우리는 public.profiles를 만들어 1:1로 매핑합니다.
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  locale       text not null default 'ko',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ============ email_accounts ============
create type provider_t as enum ('gmail', 'outlook', 'naver');
create type account_status_t as enum ('active', 'reauth_needed', 'disconnected');

create table public.email_accounts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  provider      provider_t not null,
  email         text not null,
  display_label text,
  status        account_status_t not null default 'active',
  unread_count  int not null default 0,
  last_synced_at timestamptz,
  connected_at  timestamptz not null default now(),
  unique (user_id, provider, email)
);

-- OAuth 토큰은 별도 테이블에 + Vault로 암호화
create table private.oauth_tokens (   -- private 스키마, RLS로 클라 접근 차단
  account_id        uuid primary key references public.email_accounts(id) on delete cascade,
  access_token_enc  bytea not null,   -- pgsodium으로 암호화
  refresh_token_enc bytea,
  token_expires_at  timestamptz,
  scope             text,
  updated_at        timestamptz not null default now()
);

-- ============ labels ============
create table public.labels (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  name       text not null,
  color      text not null,             -- hex
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- ============ threads ============
create type category_t as enum ('important', 'newsletter', 'transaction', 'automation', 'other');

create table public.threads (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  account_id        uuid not null references public.email_accounts(id) on delete cascade,
  provider_thread_id text not null,    -- Gmail thread ID, Outlook conversation ID, etc.
  subject           text not null,
  from_name         text not null,
  from_email        text not null,
  preview           text,                -- 본문 첫 200자
  received_at       timestamptz not null,
  unread            boolean not null default true,
  starred           boolean not null default false,
  archived          boolean not null default false,
  category          category_t,
  label_ids         uuid[] not null default '{}',
  has_action        boolean not null default false,  -- AI 판정: 답장 필요한가
  has_attachments   boolean not null default false,
  search_tsv        tsvector,             -- 풀텍스트 검색용
  updated_at        timestamptz not null default now(),
  unique (account_id, provider_thread_id)
);

create index idx_threads_user_received on public.threads (user_id, received_at desc);
create index idx_threads_user_unread   on public.threads (user_id, received_at desc) where unread = true;
create index idx_threads_user_action   on public.threads (user_id, received_at desc) where has_action = true;
create index idx_threads_search        on public.threads using gin (search_tsv);

-- search_tsv 자동 갱신 트리거
create function threads_tsv_trigger() returns trigger as $$
begin
  new.search_tsv :=
    setweight(to_tsvector('simple', coalesce(new.subject, '')),    'A') ||
    setweight(to_tsvector('simple', coalesce(new.from_name, '')),  'B') ||
    setweight(to_tsvector('simple', coalesce(new.preview, '')),    'C');
  return new;
end $$ language plpgsql;

create trigger trg_threads_tsv before insert or update on public.threads
  for each row execute function threads_tsv_trigger();

-- ============ messages ============
-- 한 thread에 여러 메시지(왕복 대화)가 들어가는 경우용
create table public.messages (
  id                  uuid primary key default gen_random_uuid(),
  thread_id           uuid not null references public.threads(id) on delete cascade,
  provider_message_id text not null,
  from_name           text not null,
  from_email          text not null,
  to_emails           text[] not null,
  cc_emails           text[],
  body_html           text,                  -- 큰 본문은 Storage로 분리 가능
  body_text           text,
  sent_at             timestamptz not null,
  attachments         jsonb not null default '[]',  -- [{name, size, url}]
  unique (thread_id, provider_message_id)
);

-- ============ thread_summaries (AI 산출물) ============
create type summary_status_t as enum ('pending', 'ready', 'failed');

create table public.thread_summaries (
  thread_id    uuid primary key references public.threads(id) on delete cascade,
  one_line     text,
  three_lines  text[],                  -- 3줄, 각 원소 한 줄
  status       summary_status_t not null default 'pending',
  model        text,
  prompt_version text,                  -- A/B 테스트용
  cost_usd     numeric(10, 6),
  generated_at timestamptz,
  user_feedback int                     -- -1, 0, 1 (사용자가 보낸 피드백)
);

-- ============ category_feedback (분류 학습용) ============
create table public.category_feedback (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  thread_id      uuid not null references public.threads(id) on delete cascade,
  predicted      category_t,
  corrected      category_t not null,
  created_at     timestamptz not null default now()
);

-- ============ Row-Level Security ============
alter table public.email_accounts   enable row level security;
alter table public.threads          enable row level security;
alter table public.messages         enable row level security;
alter table public.thread_summaries enable row level security;
alter table public.labels           enable row level security;

-- 모든 테이블에 동일 패턴 적용
create policy "own_rows" on public.threads
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
-- (다른 테이블에도 user_id 기준으로 동일한 정책)
```

### 4.2 Firestore 스키마 (대안)

Firebase 선택 시:

```
/users/{userId}
  - displayName, locale, createdAt

/users/{userId}/accounts/{accountId}
  - provider, email, status, unreadCount, lastSyncedAt
  (oauth_tokens는 별도 컬렉션 + Cloud Function으로만 접근)

/threads/{threadId}                  ← top-level (쿼리 최적화)
  - userId, accountId, providerThreadId
  - subject, fromName, fromEmail, preview
  - receivedAt, unread, starred, archived
  - category, labelIds (array), hasAction
  - summary: { oneLine, threeLines, status, model, generatedAt }   ← embedded

/threads/{threadId}/messages/{messageId}
  - bodyHtml, bodyText, attachments (subcollection)

/users/{userId}/labels/{labelId}
  - name, color, sortOrder

복합 인덱스:
  - threads: (userId asc, receivedAt desc)
  - threads: (userId asc, unread asc, receivedAt desc)
  - threads: (userId asc, hasAction asc, receivedAt desc)
  - threads: (userId asc, accountId asc, receivedAt desc)
  - threads: (userId asc, category asc, receivedAt desc)
```

검색은 **Algolia 또는 Typesense** 별도 연동 필요. 비용 추가 ~$50/월.

---

## 5. 백엔드 어댑터 인터페이스

`inbox_one.jsx`에 정의된 어댑터 인터페이스 — 모든 백엔드 구현체가 따라야 합니다.

```typescript
interface BackendAdapter {
  name: string;

  auth: {
    getCurrentUser: () => Promise<User | null>;
    onAuthChange:   (cb: (u: User | null) => void) => () => void;
    signIn:         () => Promise<User>;
    signOut:        () => Promise<void>;
  };

  accounts: {
    list:       () => Promise<Account[]>;
    connect:    (provider: Provider) => Promise<Account>;   // OAuth 시작
    disconnect: (accountId: string) => Promise<void>;
  };

  threads: {
    list:      (filter: ThreadFilter, opts?: { limit?: number; cursor?: string })
               => Promise<{ items: Thread[]; nextCursor?: string }>;
    get:       (id: string) => Promise<Thread | null>;
    update:    (id: string, patch: Partial<Thread>) => Promise<Thread>;
    subscribe: (filter: ThreadFilter, cb: (items: Thread[]) => void) => () => void;
  };

  ai: {
    summarize:     (threadId: string)
                   => Promise<ThreadSummary>;
    generateReply: (threadId: string, opts?: { tone?: string; length?: string })
                   => Promise<{ variants: Array<{ label: string; body: string }> }>;
    reclassify:    (threadId: string)
                   => Promise<{ category: Category; suggestedLabelIds: string[] }>;
  };

  labels: {
    list:   () => Promise<Label[]>;
    create: (label: Omit<Label, 'id' | 'userId'>) => Promise<Label>;
    update: (id: string, patch: Partial<Label>) => Promise<Label>;
    remove: (id: string) => Promise<void>;
  };

  briefing: {
    getDaily: () => Promise<Briefing>;
  };
}
```

**디자인 결정**: AI 호출은 클라이언트가 직접 LLM API를 부르지 않고, 항상 서버 함수를 거칩니다. 이유:
1. API 키 보호
2. 사용량 제한·과금 제어
3. Prompt 버전 관리 중앙화
4. 사용자 데이터를 클라이언트에 노출하지 않고 서버 측에서 컨텍스트 조립 가능

---

## 6. 외부 API 통합

### 6.1 Gmail (Google)

- **API**: Gmail REST API v1 (`googleapis` 패키지)
- **인증**: OAuth 2.0, scope = `gmail.modify` (읽기/쓰기/별표/라벨), `gmail.send`
- **동기화 전략**: **Push (Pub/Sub) + 초기 backfill**
  - 신규 계정 연결 시 최근 30일 메일 backfill (페이지네이션)
  - `users.watch` 등록 → Cloud Pub/Sub topic으로 변경 알림 수신
  - Webhook function이 `historyId` 기반 delta sync
- **속도 제한**: 250 quota units/사용자/초 — backfill은 토큰 버킷으로 throttle
- **만료 갱신**: refresh token 사용, 만료 7일 전 자동 갱신

### 6.2 Outlook (Microsoft 365 / Outlook.com)

- **API**: Microsoft Graph API v1.0 (`@microsoft/microsoft-graph-client`)
- **인증**: Microsoft Identity Platform (OAuth 2.0)
  - scope = `Mail.ReadWrite`, `Mail.Send`, `offline_access`
  - 회사 정책상 admin consent가 필요한 경우가 흔함 — 명시적 안내 UI 필요
- **동기화**: **Webhook (subscriptions API)**
  - `/subscriptions` 생성, expirationDateTime 최대 3일 → 매 24시간 갱신
  - Delta query (`/me/mailFolders/Inbox/messages/delta`)로 효율적 sync
- **알려진 이슈**: 한국 Azure AD 일부 테넌트는 third-party 앱 차단 — 베타 단계에서 케이스 수집

### 6.3 Naver Mail

- **API 1순위**: Naver Mail OpenAPI (Naver Cloud Platform 검토 필요)
- **API 2순위 (fallback)**: **IMAP/SMTP**
  - IMAP: `imap.naver.com:993` (SSL)
  - SMTP: `smtp.naver.com:587` (TLS)
  - **앱 비밀번호** 사용 (사용자가 Naver 계정 설정에서 별도 발급)
  - IDLE 명령으로 새 메일 푸시 받음 (long-lived connection 필요)
- **동기화 전략**: IMAP IDLE을 long-running 함수에서 유지하기 어려우므로, **5분 polling**을 1차 구현. 추후 자체 worker(예: Cloud Run with min-instance=1)로 IDLE 전환.
- **알려진 제약**: Naver는 IMAP 연결 수 제한이 엄격 — 사용자별 IDLE 연결을 풀링/공유 필요

### 6.4 메일 본문 정규화

Provider마다 응답 포맷이 다르므로, sync 함수에서 즉시 공통 모델로 정규화합니다.

```typescript
function normalizeGmailMessage(raw: gmail_v1.Schema$Message): Message {
  return {
    providerMessageId: raw.id,
    fromName:  parseFromHeader(raw).name,
    fromEmail: parseFromHeader(raw).email,
    toEmails:  parseToHeaders(raw),
    subject:   getHeader(raw, 'Subject'),
    sentAt:    new Date(parseInt(raw.internalDate)),
    bodyHtml:  decodeHtmlPart(raw.payload),
    bodyText:  decodeTextPart(raw.payload),
    attachments: extractAttachments(raw.payload),
  };
}
// outlook, naver도 동일한 시그니처
```

---

## 7. AI 파이프라인

### 7.1 모델 선택

| 작업 | 모델 | 이유 |
|---|---|---|
| 1줄/3줄 요약 | Claude Haiku 4.5 | 빠르고 저렴, 한국어 품질 충분 |
| 답장 초안 생성 | Claude Sonnet 4.6 | 톤 조절·맥락 이해 필요 |
| 분류 (4 카테고리) | Claude Haiku 4.5 (또는 자체 fine-tuned 소형 모델) | 단순 분류, 비용 최소화 |

### 7.2 요약 프롬프트 설계

```typescript
const SUMMARIZE_SYSTEM = `당신은 한국 비즈니스 환경에 익숙한 메일 어시스턴트입니다.
사용자(메일 수신자)의 관점에서, 받은 메일을 요약합니다.

다음 규칙을 엄격히 따르세요:
1. 한 줄 요약은 80자 이내. 핵심 사실 + 사용자가 취해야 할 행동 위주.
2. 세 줄 요약은 각 줄 60–120자. 1줄=핵심, 2줄=세부 컨텍스트, 3줄=시급성/마감.
3. 메일 톤이 정중하면 그대로, 캐주얼하면 그대로. 의역하지 마세요.
4. 첨부파일 종류는 요약에 포함 (예: "텀시트 PDF + 캡테이블 엑셀 첨부").
5. 추측은 금지. 명시되지 않은 정보는 적지 마세요.

출력은 JSON:
{
  "oneLine": "...",
  "threeLines": ["...", "...", "..."]
}`;

const summarizeUser = (thread: Thread, messages: Message[]) => `
발신자: ${thread.fromName} <${thread.fromEmail}>
제목: ${thread.subject}
수신일시: ${thread.receivedAt}
${messages.map(m => `\n--- 메시지 ---\n${m.bodyText}`).join('\n')}
${thread.attachments.length > 0 ? `\n첨부: ${thread.attachments.map(a => a.name).join(', ')}` : ''}
`;
```

### 7.3 답장 초안 프롬프트

```typescript
const REPLY_SYSTEM = `당신은 사용자의 메일 답장을 대신 초안 작성하는 어시스턴트입니다.

다음 3가지 톤으로 각각 답장 초안을 생성하세요:
1. 간결: 1–2문장, 핵심만
2. 협조적: 3–4문장, 일정·조건 명시
3. 정중·길게: 5–7문장, 비즈니스 격식

언어 규칙:
- 받은 메일이 한국어면 한국어, 영어면 영어로 답장
- 받은 메일이 존댓말이면 존댓말, 반말이면 반말
- 사용자 이름 서명은 추가하지 마세요 (사용자가 직접)

추측 금지:
- 일정을 모르면 "일정 확인 후" 라고 표현
- 답변이 불확실한 부분은 사용자가 채울 [...] placeholder로 표시

출력 JSON:
{ "variants": [
  { "label": "간결",      "body": "..." },
  { "label": "협조적",    "body": "..." },
  { "label": "정중·길게", "body": "..." }
]}`;
```

### 7.4 분류 프롬프트

```typescript
const CLASSIFY_SYSTEM = `메일을 다음 4개 카테고리 중 하나로 분류:

- important:    사람으로부터 온 메일 중 답장이 필요하거나 행동을 요구하는 것
- newsletter:   구독 기반 정기 발송 (Substack, 회사 블로그, 산업 동향)
- transaction:  영수증, 결제 알림, 주문 확인, 정산
- automation:   서비스 알림 (CI 빌드 결과, 모니터링 알림, GitHub 활동)

판단 근거:
- From 도메인이 "no-reply", "noreply", "notifications", "alert"를 포함 → automation 또는 newsletter
- 본문에 "결제", "주문", "영수증", "payment", "receipt" 키워드 → transaction
- 본문에 "구독 해지", "unsubscribe", "이번 주 다이제스트" → newsletter
- 그 외, 사람에게서 온 메일 → important

출력: { "category": "important" | "newsletter" | "transaction" | "automation",
        "confidence": 0.0–1.0,
        "suggestedLabelIds": [] }`;
```

### 7.5 비용 최적화 전략

1. **요약 캐싱**: `thread_summaries.thread_id` PK로 1회만 생성. 사용자가 "재요약" 클릭 시에만 재생성.
2. **본문 토큰 절감**: 인용된 이전 메일 (`>` 또는 `--- Original Message ---` 이후) 제거 후 요약
3. **배치 처리**: 신규 계정 backfill 시 요약은 배치로 처리, rate limit 적용
4. **소형 모델 fallback**: Haiku도 비싸질 경우, 자체 fine-tuned 모델 (예: KoBART-summarization)로 무료 등급 처리

### 7.6 PII 처리

- 메일 본문을 LLM에 보낼 때 `user_id`, 사용자 이메일 주소는 시스템 프롬프트에 포함하지 않음
- Anthropic API의 `metadata.user_id`는 익명 해시(`sha256(user_id + salt)`) 사용
- LLM 응답을 DB에 저장할 때 원본 본문 일부가 포함될 수 있으므로, 동일한 RLS 적용

---

## 8. 인증 & OAuth

### 8.1 사용자 로그인

- **Supabase Auth** (1차 선택)
  - Provider: Google (모든 사용자에게 권장 — Gmail 연결과 통합 가능)
  - 추가: Apple Sign In (iOS 출시 시 필수)
- 클라이언트는 `sb.auth.signInWithOAuth({ provider: 'google' })` 호출
- 콜백 후 `/auth/callback` 라우트에서 세션 저장

### 8.2 메일 계정 OAuth 플로우

사용자 로그인과 메일 계정 연결은 **별도 플로우**입니다 (사용자가 Google 로그인 후 Outlook을 추가할 수 있어야 하므로).

```
[클라이언트] "Outlook 연결" 버튼 클릭
  → Edge Function: oauth/initiate (provider='outlook')
    - state 토큰 생성 (CSRF 방지) + DB 저장
    - Microsoft authorize URL 반환
  → 클라이언트 redirect to Microsoft
  → 사용자 동의 후 Microsoft → /oauth/callback?code=...&state=...
  → Edge Function: oauth/callback
    - state 검증
    - code → access_token + refresh_token 교환
    - pgsodium으로 암호화 후 private.oauth_tokens 저장
    - email_accounts 테이블에 row 생성
    - 초기 backfill 함수 trigger
  → 클라이언트로 redirect (성공 화면)
```

### 8.3 토큰 갱신

- 모든 API 호출 직전에 만료 확인 (`expires_at - now() < 5분`이면 갱신)
- 갱신은 `private.oauth_tokens`에 atomic update
- refresh_token이 만료되면 `email_accounts.status = 'reauth_needed'`로 표시 → 클라이언트가 재인증 배너 표시

---

## 9. 동기화 전략

### 9.1 메커니즘별 정리

| Provider | 메커니즘 | 지연 | 신뢰도 | 비용 |
|---|---|---|---|---|
| Gmail | Pub/Sub Push | < 5초 | 높음 | $$ |
| Outlook | Graph subscription webhook | < 5초 | 높음 | $$ |
| Naver | IMAP 5분 polling (v1), IDLE (v1.1) | 5분 / 즉시 | 중 | $ |

### 9.2 Sync 함수 의사코드

```typescript
// Edge Function: sync/gmail
async function syncGmail(accountId: string, historyId?: string) {
  const account = await getAccount(accountId);
  const tokens  = await getDecryptedTokens(accountId);
  const gmail   = google.gmail({ version: 'v1', auth: makeOAuth2(tokens) });

  if (historyId) {
    // Delta sync
    const { data } = await gmail.users.history.list({
      userId: 'me', startHistoryId: historyId, historyTypes: ['messageAdded']
    });
    for (const h of data.history ?? []) {
      for (const m of h.messagesAdded ?? []) {
        await ingestMessage(account, m.message.id);
      }
    }
  } else {
    // Initial backfill (last 30 days)
    const q = `after:${dateFmt(daysAgo(30))}`;
    let pageToken: string | undefined;
    do {
      const { data } = await gmail.users.messages.list({ userId: 'me', q, pageToken, maxResults: 100 });
      for (const msg of data.messages ?? []) {
        await ingestMessage(account, msg.id);
      }
      pageToken = data.nextPageToken;
    } while (pageToken);
  }

  // 마지막 historyId 기록 + watch 갱신
  const profile = await gmail.users.getProfile({ userId: 'me' });
  await updateAccount(accountId, { lastHistoryId: profile.data.historyId });
}

async function ingestMessage(account: Account, providerMessageId: string) {
  const raw = await fetchMessage(account, providerMessageId);
  const msg = normalizeGmailMessage(raw);

  // upsert thread
  const thread = await upsertThread(account, msg);
  await upsertMessage(thread.id, msg);

  // AI 작업을 비동기 큐에 enqueue (요약 + 분류)
  await enqueue('ai:summarize-and-classify', { threadId: thread.id });
}
```

### 9.3 백프레셔 / 재시도

- 모든 sync/AI 작업은 **idempotent** (provider_message_id를 unique key로)
- 실패 시 exponential backoff (1s, 4s, 16s, 64s, 5m, dead-letter)
- Dead-letter queue는 Slack 알림 + 매일 운영 대시보드 노출

---

## 10. 보안 & 프라이버시

### 10.1 데이터 격리

- 모든 테이블 RLS 활성화, `user_id = auth.uid()` 정책
- 서버 함수는 `service_role` 키 사용 → DB는 함수 신뢰, 함수 내부에서 user 확인 책임
- `private.*` 스키마 (`oauth_tokens`)는 클라이언트가 절대 접근 불가

### 10.2 OAuth 토큰

- Postgres Vault (`pgsodium`)로 암호화된 채로 저장
- 복호화는 Edge Function 내부에서만, 메모리 외 노출 금지
- 로그에 토큰 출력 금지 (CI lint rule로 검사)

### 10.3 LLM 호출

- Anthropic API: zero-retention 옵션 활성화 (`X-Anthropic-Beta: prompt-caching-2024-07-31, no-retention-2024-12`)
- 메일 본문에서 PII 자동 redaction은 v1.1 (전화번호, 주민번호, 카드번호)
- 시스템 프롬프트에 사용자 식별 정보 미포함

### 10.4 감사 로그

- 별도 `audit_logs` 테이블에 기록:
  - 누가, 언제, 어떤 메일에 어떤 작업을 했는지
  - OAuth 토큰 갱신/실패
  - 데이터 export/삭제 요청
- 90일 보존, 그 후 익명화

### 10.5 데이터 삭제

- 사용자가 계정 끊으면:
  - 즉시: 클라이언트에서 사라짐 (`status = 'disconnected'`)
  - 7일 후: 정기 cron이 영구 삭제 (`messages`, `threads`, `summaries`, `tokens`)
- 사용자가 회원 탈퇴: 즉시 `auth.users` 삭제 → cascade로 모든 데이터 삭제

### 10.6 한국 PIPA 준수

- 개인정보처리방침 한국어 명시
- 개인정보 국외 이전 동의 (Anthropic API 사용 명시)
- 개인정보 보호책임자 지정
- 다크 패턴 없는 동의 흐름

---

## 11. 배포 & DevOps

### 11.1 환경 구성

| 환경 | URL | 용도 |
|---|---|---|
| local | `http://localhost:3000` | 개발자 mock 어댑터 |
| dev | `dev.inboxone.app` | Supabase staging 프로젝트 |
| prod | `app.inboxone.app` | Supabase prod 프로젝트 |

### 11.2 CI/CD

- **저장소**: GitHub
- **CI**: GitHub Actions
  - PR 시: lint, type check, unit test
  - main merge 시: dev에 자동 배포
  - manual approval로 prod 배포
- **Frontend 호스팅**: Vercel (한국 edge 노드)
- **Edge Functions**: Supabase CLI로 배포 (`supabase functions deploy`)
- **DB 마이그레이션**: `supabase db push` (rollback 스크립트 필수 페어링)

### 11.3 모니터링

- **에러**: Sentry (frontend + functions)
- **로그**: Supabase Logs (구조화 JSON)
- **메트릭**: Grafana Cloud 또는 Posthog
  - 핵심 지표: AI 요청/sec, 평균 latency, sync queue length, OAuth 토큰 갱신 실패율
- **알림**: PagerDuty 또는 Slack — error rate spike, sync queue 적체

### 11.4 Feature Flag

- PostHog feature flags 사용
- AI 답장 초안, 새 분류 모델 등은 점진적 출시

---

## 12. 비용 추정 (사용자 1,000명, MAU 기준)

가정: 사용자 1명당 일평균 100통 수신, 그중 50% AI 요약 생성, 5% 답장 초안 생성

| 항목 | 단위 비용 | 월 사용량 (1,000명) | 월 비용 |
|---|---|---|---|
| Supabase Pro | 정액 | — | $25 |
| Supabase 추가 컴퓨팅 (Postgres `medium`) | $60/월 | — | $60 |
| Edge Functions 호출 | $2/M | ~30M (sync + AI orchestration) | $60 |
| Vercel Pro | 정액 | — | $20 |
| Anthropic Claude Haiku (요약) | $0.80 / M input, $4 / M output | ~150M in, ~5M out | $140 |
| Anthropic Claude Sonnet (답장) | $3 / M input, $15 / M output | ~5M in, ~1M out | $30 |
| Cloud Pub/Sub (Gmail Push) | $40/TB | ~1GB | $5 |
| 합계 (월) | | | **~$340** |
| **사용자당** | | | **~$0.34** |

가격 ₩19,000(약 $14)/월의 Pro 등급에서 GP 매우 양호. 무료 등급의 한도 설정이 핵심 (50% 무료 사용자라도 ARPU $7 → 여전히 흑자).

**비용 폭증 위험**: Anthropic 가격이 핵심 변수. Haiku 가격이 2배 되면 단위 경제 위협. → 자체 모델 또는 OpenAI 다중 provider 옵션 항상 유지.

---

## 13. 마이그레이션 경로

### 13.1 Mock → Supabase (MVP 출시)

- 어댑터 스왑만으로 가능
- Seed data를 `supabase db seed`로 이전

### 13.2 Supabase → 자체 호스팅 (Phase 3)

- Postgres dump → 자체 클러스터 restore
- Edge Functions → Cloud Run / AWS Lambda로 포팅 (Deno → Node.js)
- Auth는 자체 구현 또는 Auth0/Keycloak

### 13.3 Anthropic → 다중 LLM Provider

- AI 함수 내부에서 provider 추상화 (이미 패턴 적용)
- 사용자별로 모델 선택 (보안 요구 시 자체 호스팅 모델)

---

## 14. 성능 검증 계획

| 시나리오 | 도구 | 목표 |
|---|---|---|
| 인박스 첫 로드 50통 | Lighthouse + 자체 측정 | TTFB < 1.5s |
| 동시 100 사용자 sync | k6 부하 테스트 | sync queue 적체 없음 |
| AI 요약 100건/min 동시 | Anthropic 부하 + 자체 큐 | P95 < 8s |
| RLS 우회 시도 | 자체 보안 테스트 + Supabase advisor | 0건 |

---

## 15. 오픈 이슈 / 의사결정 필요

- [ ] **Naver Mail OpenAPI 가용성** — Naver Cloud Platform 영업 컨택 필요. 가능하면 IMAP보다 우선
- [ ] **Anthropic vs OpenAI** 비교 벤치마크 (한국어 메일 요약 품질) — 베타 시작 전 필수
- [ ] **Edge Function vs Cloud Functions** — 한국 사용자 latency 측정 후 결정
- [ ] **검색 엔진** — Postgres FTS만으로 충분한가, Typesense/Meilisearch 추가 필요한가 — 1만 통 데이터로 벤치마크
- [ ] **모바일 전략** — iOS native (Swift) vs Flutter — Park의 Flutter 강점 고려 시 Flutter 유력하나, 메일 앱 OS 통합 깊이가 중요 → 결정 필요

---

## 부록 A. 코드 스캐폴드

레포 구조 제안:

```
inbox-one/
├── apps/
│   ├── web/                    # Next.js 14 (App Router)
│   │   ├── app/
│   │   │   ├── (marketing)/    # 랜딩
│   │   │   ├── inbox/          # 메인 인박스
│   │   │   └── auth/callback/  # OAuth 콜백
│   │   ├── components/
│   │   │   └── inbox/          # Sidebar, ThreadList, Detail
│   │   └── hooks/
│   └── mobile/                 # Phase 2
├── packages/
│   ├── backend/                # 어댑터 인터페이스 + 구현체
│   │   ├── src/
│   │   │   ├── types.ts
│   │   │   ├── mock.ts
│   │   │   ├── supabase.ts
│   │   │   └── firebase.ts
│   │   └── package.json
│   ├── ui/                     # 공유 컴포넌트
│   └── ai/                     # 프롬프트 + LLM provider 추상화
├── supabase/
│   ├── migrations/             # SQL 마이그레이션
│   ├── functions/              # Edge Functions
│   │   ├── oauth-initiate/
│   │   ├── oauth-callback/
│   │   ├── sync-gmail/
│   │   ├── sync-outlook/
│   │   ├── sync-naver/
│   │   ├── ai-summarize/
│   │   ├── ai-generate-reply/
│   │   ├── ai-reclassify/
│   │   └── briefing-daily/
│   └── seed.sql
└── pnpm-workspace.yaml
```

---

*이 문서는 살아 있는 문서입니다. 베타 진행 중 발견된 기술 이슈와 의사결정 결과를 반영하여 지속 갱신됩니다.*
