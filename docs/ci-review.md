# Pull-request review and verification

## Decision — September 8, 2026

The board authorized disabling the optional automatic Claude Code Review if it was unnecessary alongside our independent agent review. On pull request [#1](https://github.com/neuvetra-hq/neuvetra/pull/1), the integration failed before reviewing code because no usable Anthropic credential was supplied.

The [failed job](https://github.com/neuvetra-hq/neuvetra/actions/runs/34288278407/job/102268798828?pr=1) at head `12e9533b1e141d0a1e4da71e110985a30db52fa0` successfully authenticated with GitHub and installed Claude Code. Its final error was environment-variable validation: the action required an Anthropic API key, Claude Code OAuth token, or configured workload identity federation. It produced no code-review findings. This evidence does not establish that an existing credential expired or that the application code failed.

The automatic workflow was disabled through GitHub's workflow controls; the UI confirmed “This workflow was disabled manually.” Its file, `.github/workflows/claude-code-review.yml`, is removed in this PR so the version-controlled configuration reflects the decision after merge. The historical failed run remains a failed run.

## Checks retained

- **Verify / Typecheck, lint, unit tests and web builds** runs the existing application checks.
- **Verify / Offline research catalog tests** runs the source-catalog tests independently.
- Independent agent review remains required by [AGENTS.md](../AGENTS.md), with findings and validation recorded for each scoped change. This is task-scoped review, not an unattended GitHub review service.

Both Verify jobs [passed on the original PR head](https://github.com/neuvetra-hq/neuvetra/actions/runs/34288278389). The verification workflow and separate manually invoked `@claude` helper are unchanged. That helper still requires its own usable Anthropic authentication when invoked. No branch-protection settings were changed.

For subsequent revisions, inspect the checks on the actual latest PR commit; earlier successful runs do not validate later changes. Passing these checks establishes only their tested scope: the separate Python GHG methodology suite and live model-answer evaluations are not included, and calculation or production readiness is not implied.

To restore automatic Claude review later, restore its workflow from Git history, supply supported authentication through repository secrets or federation, enable the workflow, and verify a real review on a test PR.
