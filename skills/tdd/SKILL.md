---
name: tdd
description: Test-driven implementation. Use when the user wants TDD, failing tests first, or a bugfix proven by a test.
---

# TDD

Work in this order. Do not skip steps.

1. Write or update the smallest failing test that specifies the behavior.
2. Run it and confirm it fails for the right reason.
3. Write the minimal production change to make it pass.
4. Run the same test (and a narrow related suite if cheap).
5. Only then clean up if the user asked for cleanup.

If you cannot run tests, stop after writing the test and say why.
