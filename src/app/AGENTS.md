# AGENTS

This file applies to `src/app/`.

## Scope

- `layout.tsx`, `page.tsx`, global styles, and all App Router route handlers live here.

## Rules

- Default to server components unless a file truly needs `"use client"`.
- Keep page/layout files thin; complex UI belongs in `src/views/**`.
- Keep route handlers thin and move logic into `src/lib/server/services/**`.
- Read deeper `AGENTS.md` files before touching `api/**`.
