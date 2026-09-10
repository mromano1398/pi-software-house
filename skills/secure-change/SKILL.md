---
name: secure-change
description: Apply when changing auth, crypto, uploads, shell, SQL, HTML, or handling secrets. Threat-model the change before editing.
---

# Secure change

Before editing:

1. Identify trust boundaries (user input, files, network, subprocesses).
2. List what must not happen (injection, secret leak, privilege gain, data loss).
3. Then implement the smallest fix.

Checklist while coding:
- Validate and canonicalize paths; never concatenate unsanitized user paths
- Parameterize SQL / never build shell strings from user input
- Encode output for the destination (HTML, URL, shell)
- Do not log secrets or write them to the repo
- Prefer existing auth/session helpers in the project
- Add a test for the abuse case, not only the happy path
