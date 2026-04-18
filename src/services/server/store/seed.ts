import type { AppState, Thread } from "@/models";

const USER_ID = "u_minji";

const ALTOS_BODY = `
  <p>안녕하세요 민지님,</p>
  <p>
    지난주 미팅 너무 잘 들어갔습니다. 저희 파트너 미팅에서도 <strong>Inbox One</strong>의 문제 정의와 실행 속도에 대해
    긍정적 피드백이 많았습니다. 논의드린 대로 <strong>Series A 텀시트 초안</strong>을 공유드리니 검토 부탁드립니다.
  </p>
  <p>주요 조건 요약:</p>
  <ul>
    <li>Pre-money Valuation: <strong>KRW 18,000,000,000</strong></li>
    <li>Investment amount: KRW 4,500,000,000 (20% dilution)</li>
    <li>Liquidation preference: 1x non-participating</li>
    <li>Board composition: 2 founders / 1 investor / 1 independent</li>
  </ul>
  <p>
    <strong>경업금지 기간</strong>과 <strong>anti-dilution 방식</strong> 두 조항은 저희 내부에서도 재협상 여지가 있다고 판단했습니다.
    금요일 오후 6시까지 법무 검토 마치시고 회신 주시면 다음 주 초 별도 논의 자리 잡도록 하겠습니다.
  </p>
  <p>감사합니다.<br/>박서연 드림</p>
`;

function thread(input: Omit<Thread, "archived">): Thread {
  return {
    archived: false,
    ...input,
  };
}

const THREADS: Thread[] = [
  thread({
    id: "t1",
    userId: USER_ID,
    accountId: "a_g",
    from: "박서연",
    fromEmail: "seoyeon.park@altosvc.com",
    subject: "[Altos Ventures] Series A 텀시트 초안 검토 요청",
    preview: "민지님 안녕하세요, 지난주 미팅 잘 들어갔습니다. 논의드린 대로 텀시트 초안을 공유드립니다...",
    receivedAt: "2026-04-18T00:42:00Z",
    unread: true,
    starred: true,
    category: "important",
    labelIds: ["l_vc", "l_contract"],
    attachments: [
      { name: "Altos_TermSheet_v2.pdf", size: "342 KB" },
      { name: "CapTable_Projected.xlsx", size: "88 KB" },
    ],
    hasAction: true,
    bodyHtml: ALTOS_BODY,
    bodyText:
      "안녕하세요 민지님. Series A 텀시트 초안을 공유드립니다. Pre-money valuation은 180억이며 금요일 오후 6시까지 법무 검토 후 회신 부탁드립니다. anti-dilution과 경업금지 조항은 재협상 여지가 있습니다.",
    summary: {
      oneLine: "Altos Ventures가 Series A 텀시트 초안을 공유했고, 금요일까지 피드백 요청. Pre-money 180억.",
      threeLines: [
        "Altos Ventures에서 Series A 텀시트 초안을 공유했습니다 (Pre-money 180억).",
        "금요일 오후 6시까지 법무 검토 후 회신이 필요합니다.",
        "핵심 조건 2가지를 재협상 여지가 있다고 박서연 파트너가 언급했습니다.",
      ],
      status: "ready",
      model: "seed",
      updatedAt: "2026-04-18T00:43:00Z",
    },
  }),
  thread({
    id: "t2",
    userId: USER_ID,
    accountId: "a_o",
    from: "Jane Rodriguez",
    fromEmail: "jane@mercadolatam.mx",
    subject: "Partnership proposal - LATAM distribution",
    preview: "Hi Minji, following up on our call last Thursday...",
    receivedAt: "2026-04-17T23:15:00Z",
    unread: true,
    starred: false,
    category: "important",
    labelIds: ["l_customer"],
    attachments: [],
    hasAction: true,
    bodyText: "Hi Minji,\nFollowing up on our call last Thursday. We would like to explore an exclusive distribution pilot across LATAM.\nCould you confirm interest by Monday?\nBest,\nJane",
    summary: {
      oneLine: "Mercado Latam이 LATAM 지역 독점 유통 파트너십을 제안. 초기 계약 $240k.",
      threeLines: [
        "Mercado Latam이 LATAM 독점 유통 제안 ($240k 초기 계약).",
        "6개월 파일럿 후 본계약으로 확대하는 구조를 제시했습니다.",
        "다음 주 월요일까지 원칙적 합의 여부 회신 요청.",
      ],
      status: "ready",
      model: "seed",
      updatedAt: "2026-04-17T23:20:00Z",
    },
  }),
  thread({
    id: "t3",
    userId: USER_ID,
    accountId: "a_g",
    from: "이준호",
    fromEmail: "junho@inboxone.team",
    subject: "Re: 이번주 제품 스프린트 - 온보딩 A/B 결과",
    preview: "민지님, A안이 B안 대비 전환율 +14%p로 우세합니다...",
    receivedAt: "2026-04-17T22:58:00Z",
    unread: true,
    starred: false,
    category: "important",
    labelIds: ["l_team"],
    attachments: [{ name: "AB_Results_0417.pdf", size: "1.2 MB" }],
    hasAction: true,
    bodyText: "민지님,\nA안이 B안 대비 전환율 +14%p로 우세합니다. 목요일 배포 승인 부탁드립니다.",
    summary: {
      oneLine: "온보딩 A/B 테스트에서 A안이 B안보다 전환율 14%p 높음. 금주 배포 승인 요청.",
      threeLines: [
        "온보딩 A/B 테스트 결과: A안이 전환율 +14%p, p-value 0.03.",
        "이번 주 목요일 배포 승인 요청입니다.",
        "장기 리텐션 영향은 2주 후 재측정 예정.",
      ],
      status: "ready",
      model: "seed",
      updatedAt: "2026-04-17T23:00:00Z",
    },
  }),
  thread({
    id: "t4",
    userId: USER_ID,
    accountId: "a_n",
    from: "김하늘",
    fromEmail: "haneul@customer.co.kr",
    subject: "결제 오류 관련 문의드립니다",
    preview: "어제 밤 11시경 결제를 시도했는데 카드 승인은 났는데 서비스에서는 결제 실패로...",
    receivedAt: "2026-04-17T22:22:00Z",
    unread: true,
    starred: false,
    category: "important",
    labelIds: ["l_customer"],
    attachments: [],
    hasAction: true,
    bodyText: "어제 밤 11시경 결제를 시도했는데 카드 승인은 났는데 서비스에서는 결제 실패로 표시됩니다. 환불 또는 계정 연장이 필요합니다.",
    summary: {
      oneLine: "고객 결제 이중 인증 오류. 카드는 승인됐으나 서비스 미반영. 환불 또는 연장 필요.",
      threeLines: [
        "고객 결제 이중 인증 오류 - 카드는 승인됐으나 서비스 미반영.",
        "오후 2시 이후 재시도 예정이라 그 전에 환불 처리 필요.",
        "유사 사례가 어제 3건 더 있었다는 고객 제보.",
      ],
      status: "ready",
      model: "seed",
      updatedAt: "2026-04-17T22:25:00Z",
    },
  }),
  thread({
    id: "t5",
    userId: USER_ID,
    accountId: "a_o",
    from: "최은비",
    fromEmail: "eunbi.choi@lawfirm.kr",
    subject: "주주간계약서 5조 수정안 확인 부탁드립니다",
    preview: "검토하신 내용 반영하여 5조 경업금지 조항 수정안 보내드립니다...",
    receivedAt: "2026-04-17T21:45:00Z",
    unread: false,
    starred: true,
    category: "important",
    labelIds: ["l_contract"],
    attachments: [{ name: "SHA_v3_redline.docx", size: "128 KB" }],
    hasAction: true,
    bodyText: "검토하신 내용 반영하여 5조 경업금지 조항 수정안 보내드립니다. 월요일 오전까지 회신 부탁드립니다.",
    summary: {
      oneLine: "법무법인이 주주간계약서 5조(경업금지) 수정안 전달. 변경 부분 3곳, 월요일까지 회신 요청.",
      threeLines: [
        "주주간계약서 5조 경업금지 조항 수정안 (3곳 변경).",
        "월요일 오전까지 컨펌 또는 추가 수정 요청 필요.",
        "핵심 변경: 경업금지 기간 2년 -> 1년으로 단축됨.",
      ],
      status: "ready",
      model: "seed",
      updatedAt: "2026-04-17T21:50:00Z",
    },
  }),
  thread({
    id: "t6",
    userId: USER_ID,
    accountId: "a_g",
    from: "Stripe",
    fromEmail: "no-reply@stripe.com",
    subject: "Your April payout of $4,280.12 is on the way",
    preview: "Hi, your payout of $4,280.12 will arrive in your bank account in 2-3 business days...",
    receivedAt: "2026-04-17T05:00:00Z",
    unread: false,
    starred: false,
    category: "transaction",
    labelIds: [],
    attachments: [],
    hasAction: false,
    bodyText: "Your payout of $4,280.12 will arrive in your bank account in 2-3 business days.",
    summary: {
      oneLine: "4월 Stripe 정산금 $4,280.12가 2-3영업일 내 입금 예정.",
      threeLines: [
        "4월 Stripe 정산금 $4,280.12가 승인되어 송금 처리 중.",
        "2-3영업일 내 등록된 은행 계좌로 입금 예정.",
        "세부 명세는 대시보드에서 확인 가능합니다.",
      ],
      status: "ready",
      model: "seed",
      updatedAt: "2026-04-17T05:01:00Z",
    },
  }),
  thread({
    id: "t7",
    userId: USER_ID,
    accountId: "a_g",
    from: "Figma",
    fromEmail: "digest@figma.com",
    subject: "This week in your design team",
    preview: "이번 주 팀에서 42개 파일이 업데이트되었습니다...",
    receivedAt: "2026-04-17T03:00:00Z",
    unread: false,
    starred: false,
    category: "newsletter",
    labelIds: [],
    attachments: [],
    hasAction: false,
    bodyText: "이번 주 팀 내 42개 Figma 파일이 업데이트되었습니다. 가장 활발한 프로젝트는 온보딩 리디자인입니다.",
    summary: {
      oneLine: "팀 Figma 주간 요약: 42개 파일 업데이트.",
      threeLines: [
        "이번 주 팀 내 42개 Figma 파일이 업데이트되었습니다.",
        "가장 활발한 프로젝트는 온보딩 리디자인입니다.",
        "7명의 팀원이 주간 단위로 협업 중입니다.",
      ],
      status: "ready",
      model: "seed",
      updatedAt: "2026-04-17T03:01:00Z",
    },
  }),
  thread({
    id: "t8",
    userId: USER_ID,
    accountId: "a_n",
    from: "토스뱅크",
    fromEmail: "noreply@tossbank.com",
    subject: "[토스뱅크] 4월 거래내역 안내",
    preview: "4월 1일부터 17일까지의 거래내역을 확인해보세요...",
    receivedAt: "2026-04-17T01:00:00Z",
    unread: false,
    starred: false,
    category: "transaction",
    labelIds: [],
    attachments: [],
    hasAction: false,
    bodyText: "4월 1일부터 17일까지의 거래내역이 정리되었습니다.",
    summary: {
      oneLine: "토스뱅크 4월 거래내역 업데이트 (4/1 ~ 4/17).",
      threeLines: [
        "4월 1일부터 17일까지의 거래내역이 정리되었습니다.",
        "총 입금 12건, 출금 47건이 확인됩니다.",
        "거래 상세는 앱에서 확인 가능합니다.",
      ],
      status: "ready",
      model: "seed",
      updatedAt: "2026-04-17T01:01:00Z",
    },
  }),
];

export function createSeedState(): AppState {
  return {
    user: {
      id: USER_ID,
      email: "minji@startup.co.kr",
      displayName: "김민지",
    },
    accounts: [
      {
        id: "a_g",
        userId: USER_ID,
        driverId: "mock",
        provider: "gmail",
        email: "minji@startup.co.kr",
        label: "Gmail",
        unreadCount: 3,
        status: "active",
        connectedAt: "2026-04-18T00:00:00Z",
        lastSyncedAt: "2026-04-18T00:43:00Z",
        connectionSummary: "Mock Gmail 데모 계정",
      },
      {
        id: "a_o",
        userId: USER_ID,
        driverId: "mock",
        provider: "outlook",
        email: "minji.kim@company.com",
        label: "Outlook",
        unreadCount: 2,
        status: "active",
        connectedAt: "2026-04-18T00:00:00Z",
        lastSyncedAt: "2026-04-18T00:20:00Z",
        connectionSummary: "Mock Outlook 데모 계정",
      },
      {
        id: "a_n",
        userId: USER_ID,
        driverId: "mock",
        provider: "naver",
        email: "minji_k@naver.com",
        label: "Naver",
        unreadCount: 2,
        status: "active",
        connectedAt: "2026-04-18T00:00:00Z",
        lastSyncedAt: "2026-04-18T00:10:00Z",
        connectionSummary: "Mock Naver 데모 계정",
      },
    ],
    labels: [
      { id: "l_vc", userId: USER_ID, name: "VC·투자", color: "#2563eb" },
      { id: "l_team", userId: USER_ID, name: "팀 내부", color: "#059669" },
      { id: "l_customer", userId: USER_ID, name: "고객 CS", color: "#d97706" },
      { id: "l_contract", userId: USER_ID, name: "계약·법무", color: "#7c3aed" },
    ],
    threads: THREADS,
  };
}
