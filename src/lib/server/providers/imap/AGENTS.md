# AGENTS

This file applies to `src/lib/server/providers/imap/`.

## Rules

- Keep IMAP connection details and parsing logic isolated here.
- Convert raw IMAP/mailparser output into shared thread data before returning.
- Be conservative with secrets, mailbox locking, and date parsing.
- If you add another IMAP-based provider, prefer extending presets and helpers before duplicating logic.
