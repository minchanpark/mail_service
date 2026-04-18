#!/usr/bin/env node

const urls = process.argv.slice(2);
const targets = urls.length > 0 ? urls : ["http://localhost:3000"];

const requiredHeaders = [
  {
    name: "content-security-policy",
    level: "high",
    advice: "Add a CSP that blocks unsafe inline script execution where possible.",
  },
  {
    name: "x-content-type-options",
    level: "medium",
    expected: "nosniff",
    advice: "Set X-Content-Type-Options to nosniff.",
  },
  {
    name: "referrer-policy",
    level: "medium",
    advice: "Set a strict referrer policy such as strict-origin-when-cross-origin.",
  },
  {
    name: "permissions-policy",
    level: "low",
    advice: "Explicitly disable browser features your app does not need.",
  },
];

const optionalHeaders = [
  {
    name: "strict-transport-security",
    level: "medium",
    advice: "Enable HSTS on HTTPS production deployments.",
  },
  {
    name: "x-frame-options",
    level: "medium",
    advice: "Use DENY or SAMEORIGIN unless framing is required.",
  },
];

const cspDirectiveChecks = [
  {
    pattern: /'unsafe-inline'/i,
    level: "medium",
    issue: "CSP contains 'unsafe-inline'",
    advice: "Replace inline allowances with nonces or hashes where possible.",
  },
  {
    pattern: /'unsafe-eval'/i,
    level: "high",
    issue: "CSP contains 'unsafe-eval'",
    advice: "Remove 'unsafe-eval' and refactor any dynamic evaluation paths.",
  },
  {
    pattern: /(?:^|;)\s*(?:default-src|script-src|style-src)[^;]*\*(?:\s|;|$)/im,
    level: "high",
    issue: "CSP uses wildcard source for script or style directives",
    advice: "Replace wildcard sources with explicit origin allowlists.",
  },
];

function levelRank(level) {
  switch (level) {
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

function isLocalHttp(url) {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "http:" &&
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "::1")
    );
  } catch {
    return false;
  }
}

function checkCookies(response, url) {
  const getSetCookie = response.headers.getSetCookie?.bind(response.headers);
  const cookies = typeof getSetCookie === "function" ? getSetCookie() : [];

  return cookies.flatMap((cookie) => {
    const issues = [];
    if (!/;\s*HttpOnly/i.test(cookie)) {
      issues.push("missing HttpOnly");
    }
    if (!/;\s*SameSite=/i.test(cookie)) {
      issues.push("missing SameSite");
    }
    if (url.startsWith("https://") && !/;\s*Secure/i.test(cookie)) {
      issues.push("missing Secure");
    }

    if (issues.length === 0) {
      return [];
    }

    return [
      {
        header: "set-cookie",
        level: "medium",
        value: cookie.split(";")[0],
        issue: issues.join(", "),
      },
    ];
  });
}

function evaluateCsp(policy) {
  return cspDirectiveChecks.flatMap((check) =>
    check.pattern.test(policy)
      ? [
          {
            header: "content-security-policy",
            level: check.level,
            issue: check.issue,
            advice: check.advice,
          },
        ]
      : [],
  );
}

async function auditOne(url) {
  const response = await fetch(url, {
    redirect: "manual",
    headers: {
      "user-agent": "mail-service-security-audit",
    },
  });

  const issues = [];

  for (const header of requiredHeaders) {
    const value = response.headers.get(header.name);
    if (!value) {
      issues.push({
        header: header.name,
        level: header.level,
        issue: "missing",
        advice: header.advice,
      });
      continue;
    }

    if (header.expected && value.toLowerCase() !== header.expected) {
      issues.push({
        header: header.name,
        level: header.level,
        issue: `expected ${header.expected}, got ${value}`,
        advice: header.advice,
      });
    }

    if (header.name === "content-security-policy") {
      issues.push(...evaluateCsp(value));
    }
  }

  for (const header of optionalHeaders) {
    const value = response.headers.get(header.name);
    if (value) {
      continue;
    }

    issues.push({
      header: header.name,
      level: header.name === "strict-transport-security" && isLocalHttp(url) ? "info" : header.level,
      issue: "missing",
      advice:
        header.name === "strict-transport-security" && isLocalHttp(url)
          ? "Informational on plain localhost HTTP. Enable HSTS on HTTPS production deployments."
          : header.advice,
    });
  }

  const acao = response.headers.get("access-control-allow-origin");
  if (acao === "*") {
    issues.push({
      header: "access-control-allow-origin",
      level: "high",
      issue: "wildcard origin",
      advice: "Do not use wildcard CORS on authenticated or sensitive endpoints.",
    });
  }

  issues.push(...checkCookies(response, url));
  issues.sort((left, right) => levelRank(right.level) - levelRank(left.level));

  return {
    url,
    status: response.status,
    issues,
    headers: Object.fromEntries(response.headers.entries()),
  };
}

async function main() {
  const results = [];

  for (const url of targets) {
    try {
      results.push(await auditOne(url));
    } catch (error) {
      results.push({
        url,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const summary = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
    total: 0,
  };

  for (const result of results) {
    for (const issue of result.issues ?? []) {
      if (issue.level in summary) {
        summary[issue.level] += 1;
      }
    }
  }
  summary.total = Object.values(summary).slice(0, 5).reduce((total, count) => total + count, 0);

  const payload = {
    timestamp: new Date().toISOString(),
    targets: results,
    summary,
  };

  console.log(JSON.stringify(payload, null, 2));

  const hasSeriousFinding = results.some((result) =>
    Array.isArray(result.issues) && result.issues.some((issue) => levelRank(issue.level) >= levelRank("medium")),
  );
  const hasExecutionError = results.some((result) => Boolean(result.error));

  if (hasSeriousFinding) {
    process.exitCode = 2;
  } else if (hasExecutionError) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
