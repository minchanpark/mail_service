#!/usr/bin/env node

import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

const reportDir = process.argv[2] ?? ".reports/security";

function severityRank(severity) {
  switch (severity) {
    case "critical":
    case "high":
      return 4;
    case "moderate":
    case "medium":
      return 3;
    case "low":
      return 2;
    case "info":
      return 1;
    default:
      return 0;
  }
}

async function readJsonSafely(fileName) {
  const filePath = path.join(reportDir, fileName);
  try {
    await access(filePath, constants.R_OK);
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function readTextSafely(fileName) {
  const filePath = path.join(reportDir, fileName);
  try {
    await access(filePath, constants.R_OK);
    return await readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

function collectHeaderIssues(report) {
  const targets = Array.isArray(report?.targets) ? report.targets : report ? [report] : [];

  return targets.flatMap((target) =>
    Array.isArray(target.issues)
      ? target.issues.map((issue) => ({
          source: "headers",
          severity: issue.level ?? "medium",
          target: target.url ?? "(unknown URL)",
          issue: issue.issue ?? "Header issue",
          advice: issue.advice ?? "",
          header: issue.header ?? "",
        }))
      : [],
  );
}

function collectNextConfigIssues(report) {
  if (!report) {
    return [];
  }

  const buckets = [report.nextConfig, report.edgeRuntime].filter(Boolean);
  return buckets.flatMap((bucket) =>
    Array.isArray(bucket.issues)
      ? bucket.issues.map((issue) => ({
          source: "next-config",
          severity: issue.severity ?? "medium",
          target: issue.file ?? bucket.path ?? "(unknown file)",
          issue: issue.issue ?? "Static config issue",
          advice: issue.advice ?? "",
        }))
      : [],
  );
}

function collectRetireIssues(report) {
  const files = Array.isArray(report?.data) ? report.data : Array.isArray(report) ? report : [];

  return files.flatMap((fileEntry) =>
    Array.isArray(fileEntry?.results)
      ? fileEntry.results.flatMap((result) =>
          Array.isArray(result?.vulnerabilities)
            ? result.vulnerabilities.map((vulnerability) => ({
                source: "retire",
                severity: vulnerability.severity ?? "medium",
                target: fileEntry.file ?? "(unknown bundle)",
                issue: vulnerability.identifiers?.summary ?? "Known vulnerable JavaScript library",
                advice: Array.isArray(vulnerability.info) ? vulnerability.info.join(" ") : "Upgrade the affected library.",
                component: `${result.component ?? "unknown"}@${result.version ?? "unknown"}`,
              }))
            : [],
        )
      : [],
  );
}

function renderAuditSection(auditText) {
  if (!auditText) {
    return "_audit-ci output not found._";
  }

  const lines = auditText.trim().split("\n").slice(0, 40);
  return ["```text", ...lines, "```"].join("\n");
}

function renderIssueTable(issues) {
  if (issues.length === 0) {
    return "_No issues._";
  }

  const rows = issues.map((issue) => {
    const severity = String(issue.severity).replace(/\|/g, "\\|");
    const source = String(issue.source).replace(/\|/g, "\\|");
    const target = String(issue.target ?? "").replace(/\|/g, "\\|");
    const detail = String(issue.issue ?? "").replace(/\|/g, "\\|");
    const advice = String(issue.advice ?? "").replace(/\|/g, "\\|");
    return `| ${severity} | ${source} | ${target} | ${detail} | ${advice} |`;
  });

  return [
    "| Severity | Source | Target | Issue | Advice |",
    "|---|---|---|---|---|",
    ...rows,
  ].join("\n");
}

async function main() {
  const [headersReport, nextConfigReport, retireReport, auditText] = await Promise.all([
    readJsonSafely("security-headers.json"),
    readJsonSafely("next-config.json"),
    readJsonSafely("retire.json"),
    readTextSafely("audit-ci.txt"),
  ]);

  const issues = [
    ...collectHeaderIssues(headersReport),
    ...collectNextConfigIssues(nextConfigReport),
    ...collectRetireIssues(retireReport),
  ].sort((left, right) => severityRank(right.severity) - severityRank(left.severity));

  const criticalAndHigh = issues.filter((issue) => severityRank(issue.severity) >= severityRank("high")).length;
  const medium = issues.filter((issue) => severityRank(issue.severity) === severityRank("medium")).length;
  const low = issues.filter((issue) => severityRank(issue.severity) === severityRank("low")).length;
  const info = issues.filter((issue) => severityRank(issue.severity) === severityRank("info")).length;

  const output = [
    "# Web Security Audit Summary",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    `**Totals:** ${criticalAndHigh} high/critical · ${medium} medium · ${low} low · ${info} info`,
    "",
    "## Prioritized Findings",
    "",
    renderIssueTable(issues),
    "",
    "## Dependency Audit (audit-ci)",
    "",
    renderAuditSection(auditText),
    "",
    "## Scope Reminder",
    "",
    "This report covers horizontal security: dependencies, bundled libraries, HTTP headers, CSP quality, and static Next.js config.",
    "It does not cover mass assignment, authentication/authorization logic, secret storage, prompt injection, or business-logic vulnerabilities.",
    "If your workspace has a companion business-logic review skill such as `inbox-one-security-review`, hand off those concerns there.",
    "",
  ];

  console.log(output.join("\n"));
}

main().catch((error) => {
  console.error(`Summary generation failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
