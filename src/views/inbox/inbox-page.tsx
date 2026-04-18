"use client";

import {
  Inbox,
  Moon,
  Plus,
  Search,
  Sun,
} from "lucide-react";

import { InboxControllerProvider, useInboxController } from "@/controllers/inbox/inbox-controller";
import { MailComposeSheet } from "@/views/inbox/mail-compose-sheet";
import {
  ConnectAccountSheet,
  DetailPane,
  Sidebar,
  ThreadPane,
} from "@/views/inbox/inbox-sections";
import {
  ghostButtonStyle,
  primaryButtonStyle,
} from "@/views/inbox/view-primitives";

export function InboxPage() {
  return (
    <InboxControllerProvider>
      <InboxPageScreen />
    </InboxControllerProvider>
  );
}

function InboxPageScreen() {
  const controller = useInboxController();

  return (
    <div className="app-shell" data-theme={controller.theme}>
      <div className="panel" style={{ minHeight: "calc(100vh - 40px)", overflow: "hidden" }}>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "18px 20px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              display: "grid",
              placeItems: "center",
              background: "linear-gradient(135deg, #1d4ed8, #60a5fa)",
              color: "#fff",
            }}
          >
            <Inbox size={18} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.03em" }}>Inbox One</div>
            <div style={{ fontSize: 12, color: "var(--fg-2)" }}>
              확장형 메일 provider 백엔드가 연결된 통합 인박스
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              borderRadius: 999,
              background: "var(--bg-2)",
              color: "var(--fg-2)",
              maxWidth: 340,
              width: "100%",
            }}
          >
            <Search size={14} />
            <input
              value={controller.searchInput}
              onChange={(event) => controller.setSearchInput(event.target.value)}
              placeholder="발신자, 제목, 본문 검색"
              style={{
                flex: 1,
                minWidth: 0,
                border: "none",
                outline: "none",
                background: "transparent",
                color: "var(--fg-0)",
              }}
            />
          </div>
          <button
            onClick={() =>
              controller.openComposer({
                mode: "compose",
                accountId: controller.selectedFilter.accountId ?? undefined,
              })
            }
            style={{ ...primaryButtonStyle(), width: "auto" }}
          >
            <Plus size={14} />
            새 메일
          </button>
          <button onClick={controller.toggleTheme} style={ghostButtonStyle()}>
            {controller.theme === "light" ? <Moon size={14} /> : <Sun size={14} />}
            {controller.theme === "light" ? "다크" : "라이트"}
          </button>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "260px minmax(0, 1fr)", minHeight: "calc(100vh - 116px)" }}>
          <Sidebar />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: controller.selectedThreadId ? "minmax(320px, 0.92fr) minmax(0, 1.45fr)" : "minmax(0, 1fr)",
              minWidth: 0,
              transition: "grid-template-columns 180ms ease",
            }}
          >
            <ThreadPane />
            {controller.selectedThreadId ? <DetailPane /> : null}
          </div>
        </div>
      </div>

      {controller.connectSheetOpen ? <ConnectAccountSheet onClose={controller.closeConnectSheet} /> : null}
      {controller.composerIntent ? (
        <MailComposeSheet
          intent={controller.composerIntent}
          onClose={controller.closeComposer}
          onSent={controller.handleMailSent}
        />
      ) : null}
    </div>
  );
}
