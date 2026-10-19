# Jarvis Protocol & Development Guidelines

This repository follows strict development guidelines defined in [AGENTS.md](./AGENTS.md) and the `antislop` skills at [.agents/skills/antislop/SKILL.md](./.agents/skills/antislop/SKILL.md).

## Quick Summary for AI / Developers
1. **Never commit directly to `main`**: Always branch to `feature/*`, `fix/*`, `chore/*`, or `refactor/*`.
2. **Anti-Slop AI is Mandatory**: No `any`, no silent `catch` blocks, no placeholder mocks, no generic AI-slop UI cards. Build purposeful, high-density NOC telemetry.
3. **CI Pipeline Gates**: Lint, typecheck, tests, and build must pass cleanly.
4. **AI Reviewer Gate**: Every PR is reviewed and categorized into `Low`, `Medium`, `High`, and `Critical`. `High` and `Critical` issues strictly block merging.
