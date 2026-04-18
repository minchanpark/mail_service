# AGENTS

This file applies to `src/components/inbox/`.

## Rules

- This subtree owns the inbox UI composition layer.
- Keep route/service/provider logic out of this directory.
- Use hooks from `src/lib/client/**` for fetching and mutations.
- If `inbox-app.tsx` grows materially, split by view concern rather than mixing UI and server logic.
