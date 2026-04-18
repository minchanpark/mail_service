#!/usr/bin/env node

const inputUrl = process.argv[2] ?? "http://localhost:3000";

const requiredHeaders = [
  {
    name: "content-security-policy",
    level: "high",
    advice: "Add a CSP that blocks unsafe inline/script execution where possible.",
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
    level: "info",
    advice: "Required on HTTPS production deployments, not on plain localhost HTTP.",
  },
  {
    name: "x-frame-options",
    level: "medium",
    advice: "Use DENY or SAMEORIGIN unless framing is required.",
  },
];

function checkCookies(response) {
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
    if (inputUrl.startsWith("https://") && !/;\s*Secure/i.test(cookie)) {
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

function levelRank(level) {
  switch (level) {
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    default:
      return 0;
  }
}

async function main() {
  const response = await fetch(inputUrl, {
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
  }

  for (const header of optionalHeaders) {
    const value = response.headers.get(header.name);
    if (!value) {
      issues.push({
        header: header.name,
        level: header.level,
        issue: "missing",
        advice: header.advice,
      });
    }
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

  issues.push(...checkCookies(response));
  issues.sort((a, b) => levelRank(b.level) - levelRank(a.level));

  const result = {
    url: inputUrl,
    status: response.status,
    issues,
    headers: Object.fromEntries(response.headers.entries()),
  };

  console.log(JSON.stringify(result, null, 2));
  if (issues.some((issue) => levelRank(issue.level) >= 2)) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        url: inputUrl,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
