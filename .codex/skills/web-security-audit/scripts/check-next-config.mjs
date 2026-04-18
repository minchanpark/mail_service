#!/usr/bin/env node

// Static Next.js security auditor.
//
// This intentionally uses regex-based source inspection instead of AST parsing
// to stay dependency-free inside the skill. That means it can miss computed
// header names, CSP assembled across helper calls, or more abstract config
// composition patterns. Treat this as a fast static signal, not a proof engine.

import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

const cwd = process.cwd();

const nextConfigCandidates = [
  "next.config.js",
  "next.config.mjs",
  "next.config.ts",
];

const edgeRuntimeCandidates = [
  "proxy.ts",
  "proxy.js",
  "src/proxy.ts",
  "src/proxy.js",
  "middleware.ts",
  "middleware.js",
  "src/middleware.ts",
  "src/middleware.js",
];

const requiredHeaders = [
  { name: "content-security-policy", severity: "high" },
  { name: "x-content-type-options", severity: "medium" },
  { name: "referrer-policy", severity: "medium" },
  { name: "permissions-policy", severity: "medium" },
];

const optionalHeaders = [
  { name: "x-frame-options", severity: "medium" },
];

const weakCspChecks = [
  {
    pattern: /'unsafe-inline'/i,
    severity: "medium",
    issue: "CSP contains 'unsafe-inline'",
    advice: "Replace inline allowances with nonces or hashes where possible.",
  },
  {
    pattern: /'unsafe-eval'/i,
    severity: "high",
    issue: "CSP contains 'unsafe-eval'",
    advice: "Remove 'unsafe-eval' and refactor dynamic evaluation paths.",
  },
  {
    pattern: /(?:default-src|script-src|style-src)[^;\n]*\*/i,
    severity: "high",
    issue: "CSP uses wildcard source for script or style directives",
    advice: "Replace wildcard sources with explicit origin allowlists.",
  },
];

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

async function fileExists(targetPath) {
  try {
    await access(targetPath, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function findFirstExisting(candidates) {
  for (const candidate of candidates) {
    const fullPath = path.join(cwd, candidate);
    if (await fileExists(fullPath)) {
      return fullPath;
    }
  }

  return null;
}

function pushIssue(target, issue) {
  target.issues.push(issue);
}

function hasHeaderLiteral(text, headerName) {
  const escapedHeaderName = headerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const literalPattern = new RegExp(`["'\`]${escapedHeaderName}["'\`]`, "i");
  return literalPattern.test(text);
}

function hasHeadersFunction(text) {
  return /(?:async\s+)?headers\s*\(/.test(text);
}

function detectWeakCsp(text, relativePath) {
  return weakCspChecks.flatMap((check) =>
    check.pattern.test(text)
      ? [
          {
            file: relativePath,
            severity: check.severity,
            issue: check.issue,
            advice: check.advice,
          },
        ]
      : [],
  );
}

function detectWildcardCors(text, relativePath) {
  const patterns = [
    /access-control-allow-origin['"`]\s*,\s*['"`]\*['"`]/i,
    /\.set\(\s*['"`]access-control-allow-origin['"`]\s*,\s*['"`]\*['"`]\s*\)/i,
  ];

  return patterns.some((pattern) => pattern.test(text))
    ? [
        {
          file: relativePath,
          severity: "high",
          issue: "Wildcard Access-Control-Allow-Origin detected in static config",
          advice: "Replace '*' with an explicit origin allowlist, especially on authenticated or sensitive routes.",
        },
      ]
    : [];
}

function auditNextConfig(text, relativePath, combinedText, edgeRuntimeFound) {
  const bucket = {
    path: relativePath,
    found: true,
    issues: [],
  };

  if (!hasHeadersFunction(text)) {
    pushIssue(bucket, {
      file: relativePath,
      severity: edgeRuntimeFound ? "low" : "high",
      issue: "No headers() function found in Next.js config",
      advice: edgeRuntimeFound
        ? "This app appears to rely on proxy/middleware for some headers. Keep that intentional and document it."
        : "Add an async headers() function that sets baseline HTTP security headers.",
    });
  }

  for (const header of requiredHeaders) {
    if (!hasHeaderLiteral(combinedText, header.name)) {
      pushIssue(bucket, {
        file: relativePath,
        severity: header.severity,
        issue: `No static reference to ${header.name} found in next.config or proxy/middleware`,
        advice: `Add "${header.name}" through next.config headers() or the edge runtime entry.`,
      });
    }
  }

  for (const header of optionalHeaders) {
    if (!hasHeaderLiteral(combinedText, header.name)) {
      pushIssue(bucket, {
        file: relativePath,
        severity: header.severity,
        issue: `No static reference to ${header.name} found in next.config or proxy/middleware`,
        advice: `Set "${header.name}" unless the application intentionally permits framing.`,
      });
    }
  }

  bucket.issues.push(...detectWeakCsp(text, relativePath));
  bucket.issues.push(...detectWildcardCors(text, relativePath));

  return bucket;
}

function auditEdgeRuntime(text, relativePath) {
  const bucket = {
    path: relativePath,
    found: true,
    issues: [],
  };

  const looksLikeEdgeMatcher = /matcher\s*:/.test(text) || /export\s+const\s+config\s*=/.test(text);
  if (!looksLikeEdgeMatcher) {
    pushIssue(bucket, {
      file: relativePath,
      severity: "low",
      issue: "Edge runtime entry has no matcher config",
      advice: "Scope proxy/middleware execution with export const config = { matcher: [...] } when possible.",
    });
  }

  bucket.issues.push(...detectWeakCsp(text, relativePath));
  bucket.issues.push(...detectWildcardCors(text, relativePath));

  return bucket;
}

async function readText(targetPath) {
  return readFile(targetPath, "utf8");
}

async function main() {
  const nextConfigPath = await findFirstExisting(nextConfigCandidates);
  const edgeRuntimePath = await findFirstExisting(edgeRuntimeCandidates);

  const nextConfigText = nextConfigPath ? await readText(nextConfigPath) : null;
  const edgeRuntimeText = edgeRuntimePath ? await readText(edgeRuntimePath) : null;
  const combinedText = [nextConfigText, edgeRuntimeText].filter(Boolean).join("\n");

  const result = {
    cwd,
    timestamp: new Date().toISOString(),
    parser: "regex-static-scan",
    limitations: [
      "May miss computed header names or CSP assembled across helper functions.",
      "Treat this as a dependency-free static signal, not as a full semantic parser.",
    ],
    nextConfig: nextConfigPath
      ? auditNextConfig(
          nextConfigText,
          path.relative(cwd, nextConfigPath),
          combinedText,
          Boolean(edgeRuntimePath),
        )
      : {
          path: null,
          found: false,
          issues: [
            {
              file: "(missing next config)",
              severity: edgeRuntimePath ? "low" : "high",
              issue: "No next.config.js/mjs/ts file found",
              advice: edgeRuntimePath
                ? "The app appears to rely on proxy/middleware. Keep that intentional and documented."
                : "Create next.config.ts with a headers() function for baseline security headers.",
            },
          ],
        },
    edgeRuntime: edgeRuntimePath
      ? auditEdgeRuntime(edgeRuntimeText, path.relative(cwd, edgeRuntimePath))
      : {
          path: null,
          found: false,
          issues: [
            {
              file: "(missing proxy/middleware)",
              severity: hasHeaderLiteral(combinedText, "content-security-policy") ? "info" : "medium",
              issue: "No proxy.ts or middleware.ts detected",
              advice: hasHeaderLiteral(combinedText, "content-security-policy")
                ? "Informational only if CSP is intentionally static and nonce-free."
                : "If you need nonce-based CSP or edge auth behavior, add proxy.ts or middleware.ts.",
            },
          ],
        },
    summary: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
      total: 0,
    },
  };

  const allIssues = [...result.nextConfig.issues, ...result.edgeRuntime.issues];
  for (const issue of allIssues) {
    if (issue.severity in result.summary) {
      result.summary[issue.severity] += 1;
    }
  }
  result.summary.total = allIssues.length;

  console.log(JSON.stringify(result, null, 2));

  if (allIssues.some((issue) => severityRank(issue.severity) >= severityRank("medium"))) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        cwd,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
