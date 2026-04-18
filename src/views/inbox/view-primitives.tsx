"use client";

import type { ReactNode } from "react";

type LabelPillValue = {
  color: string;
  name: string;
};

export function formatAddressSummary(addresses: string[] | undefined, fallback = "수신자 미지정") {
  if (!addresses || addresses.length === 0) {
    return fallback;
  }

  if (addresses.length === 1) {
    return addresses[0];
  }

  return `${addresses[0]} 외 ${addresses.length - 1}명`;
}

export function ProviderDot({ provider }: { provider: string }) {
  return (
    <span
      style={{
        width: 10,
        height: 10,
        borderRadius: 999,
        background: `var(--${provider})`,
        display: "inline-block",
      }}
    />
  );
}

export function LabelPill({ label }: { label: LabelPillValue }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 10px",
        borderRadius: 999,
        background: `${label.color}18`,
        color: label.color,
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: 999, background: label.color }} />
      {label.name}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  compact = false,
}: {
  icon: ReactNode;
  title: string;
  compact?: boolean;
}) {
  return (
    <div
      style={{
        minHeight: compact ? 120 : "100%",
        display: "grid",
        placeItems: "center",
        padding: compact ? 12 : 32,
        textAlign: "center",
        color: "var(--fg-2)",
      }}
    >
      <div>
        <div style={{ display: "grid", placeItems: "center", marginBottom: 10 }}>{icon}</div>
        <div style={{ fontSize: 14 }}>{title}</div>
      </div>
    </div>
  );
}

export function SidebarItem({
  active,
  label,
  count,
  meta,
  leading,
  onClick,
}: {
  active: boolean;
  label: string;
  count?: number;
  meta?: string;
  leading?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 14,
        border: "none",
        background: active ? "var(--accent-soft)" : "transparent",
        cursor: "pointer",
        color: active ? "var(--accent-soft-fg)" : "var(--fg-1)",
        marginBottom: 6,
      }}
    >
      {leading ?? <span style={{ width: 10, height: 10 }} />}
      <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
        <div style={{ fontWeight: 600 }}>{label}</div>
        {meta ? <div style={{ fontSize: 11, color: "var(--fg-3)" }}>{meta}</div> : null}
      </div>
      {count !== undefined ? <span style={{ fontSize: 12, color: "var(--fg-2)" }}>{count}</span> : null}
    </button>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        marginTop: 20,
        marginBottom: 10,
        fontSize: 11,
        color: "var(--fg-3)",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </div>
  );
}

export function MiniBadge({ tone, label }: { tone: "accent" | "neutral"; label: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 8px",
        borderRadius: 999,
        background: tone === "accent" ? "var(--accent-soft)" : "var(--bg-2)",
        color: tone === "accent" ? "var(--accent-soft-fg)" : "var(--fg-2)",
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      {label}
    </span>
  );
}

export function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ padding: 10, borderRadius: 14, background: "rgba(255,255,255,0.4)", border: "1px solid var(--border)" }}>
      <div style={{ fontSize: 11, color: "var(--fg-2)" }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 20, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

export function ActionButton({
  icon,
  label,
  primary = false,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  primary?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 12px",
        borderRadius: 12,
        border: primary ? "1px solid transparent" : "1px solid var(--border)",
        background: primary ? "var(--accent)" : "var(--bg-0)",
        color: primary ? "#fff" : "var(--fg-1)",
        cursor: "pointer",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

export function Field({
  label,
  helpText,
  children,
}: {
  label: string;
  helpText?: string;
  children: ReactNode;
}) {
  return (
    <label style={{ display: "grid", gap: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 600 }}>
        {label}
        {helpText ? <div style={{ marginTop: 4, fontSize: 12, color: "var(--fg-2)", fontWeight: 400 }}>{helpText}</div> : null}
      </div>
      {children}
    </label>
  );
}

export function inputStyle(multiline = false) {
  return {
    width: "100%",
    border: "1px solid var(--border)",
    borderRadius: 12,
    background: "var(--bg-0)",
    color: "var(--fg-0)",
    padding: "12px 14px",
    outline: "none",
    minHeight: multiline ? 180 : undefined,
    resize: multiline ? "vertical" : undefined,
    font: "inherit",
  } as const;
}

export function primaryButtonStyle() {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    padding: "12px 16px",
    borderRadius: 14,
    border: "1px solid transparent",
    background: "var(--accent)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 700,
  } as const;
}

export function ghostButtonStyle() {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--bg-0)",
    color: "var(--fg-1)",
    cursor: "pointer",
  } as const;
}
