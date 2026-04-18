# AGENTS

This file applies to `src/views/`.

## Rules

- This subtree owns page-oriented UI code.
- Organize files by page or feature screen, not by generic widget bucket.
- Views should prefer controller APIs over direct backend wiring when the state is shared across the page.
- Page-local helper logic is acceptable here when it is not reused elsewhere.
