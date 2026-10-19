---
name: antislop-ai
description: >-
  Enforces strict anti-slop engineering standards across codebase, UI/UX, and architecture.
  Use this skill whenever writing, modifying, refactoring, or reviewing code and UI in the PulseNOC project.
---

# Anti-Slop AI Engineering & Design Standard

This skill establishes the uncompromising quality threshold for **PulseNOC**. "Anti-Slop" means eradicating lazy AI code generation patterns, soulless template designs, unchecked assumptions, and half-baked implementations.

---

## 1. Core Engineering Principles (Code Anti-Slop)

### A. Strict Type Safety (No `any` Escapes)
- **Zero `any` Policy**: Never use `any` to bypass TypeScript's type checker.
  - Use strongly typed DTOs, interfaces, or generics.
  - Use `unknown` with runtime type narrowing (`typeof`, `instanceof`, or Zod/class-validator) when dealing with external or arbitrary payloads.
- **Explicit Return Types**: All service methods, controller handlers, utility functions, and hooks must specify explicit return types.
- **Discriminated Unions**: Model distinct states (e.g. `Idle`, `Loading`, `Success`, `Error`, `Offline`) with discriminated unions rather than multiple loose boolean flags.

### B. Defensive Architecture & Error Handling
- **No Silent Failures**: Never write empty `catch (err) {}` blocks. Every catch block must either:
  1. Log the error with structured contextual details (service, host, timestamp, input params).
  2. Transform and re-throw as an actionable domain exception.
  3. Return a safe, well-typed fallback value with warning telemetry.
- **Resource Hygiene**:
  - Always clean up event listeners, WebSocket channels, intervals, timeouts, and SSH streams in `onModuleDestroy` / `useEffect` cleanup.
  - Manage database connection pooling properly; do not leak connections.
- **No Hallucinated or Zombie Dependencies**:
  - Only import packages present in `package.json`.
  - Delete unused imports, dead functions, and obsolete comments immediately.
- **No Placeholder Code**: Never leave `// TODO: Implement later`, `return true; // mock`, or hardcoded mock data in production pathways. Implement the actual logic or fail explicitly.

### C. System & External Service Telemetry
- **Local Debian Laptop Metrics**: Read accurate telemetry from CPU, memory, storage partitions, thermals, and network interfaces using `systeminformation` / native OS tools. Handle permission drops and offline status gracefully.
- **External Service Probers**: Support robust probing protocols (HTTP/HTTPS, TCP port check, ICMP ping, DNS).
  - Enforce strict timeouts (e.g., 3000ms - 5000ms) to prevent prober thread exhaustion.
  - Record latency, status codes, packet loss, and jitter.

---

## 2. NOC Dashboard & UI/UX Standards (UI Anti-Slop)

### A. NOC Aesthetic & Visual Hierarchy
- **Purposeful Design, Not AI Template Fluff**:
  - Avoid generic, generic pastel card templates with meaningless excessive whitespace.
  - Deliver a high-density, high-legibility **NOC (Network Operations Center)** cyber dashboard:
    - Dark mode first (`#090d16` to `#131b2e` palette).
    - Sharp border contrast, subtle ambient glows for active telemetry.
    - Monospace fonts (`JetBrains Mono`, `Fira Code`, or `ui-monospace`) for numeric data: IPs, ports, latencies, CPU percentages, byte counters, and timestamps.
- **Semantic Status Signals**:
  - `HEALTHY` / `UP`: Cyber green (`#10b981` / `#059669`).
  - `WARNING` / `DEGRADED`: Amber / Gold (`#f59e0b` / `#d97706`).
  - `ERROR` / `DOWN`: High-contrast Crimson (`#ef4444` / `#dc2626`).
  - `CRITICAL`: Pulsing neon crimson / magenta (`#f43f5e`) with urgent visual indicator.
  - `OFFLINE` / `UNKNOWN`: Slate gray (`#64748b`).

### B. Real-Time Telemetry & State Feedback
- **Live Stream Awareness**: Show clear WebSocket status indicators (Connected, Reconnecting, Disconnected).
- **Graceful Loading & Empty States**:
  - Use tailored skeleton loaders that mirror the actual chart/grid layout rather than generic centered spinning wheels.
  - Empty states must provide actionable guidance (e.g., "No external services registered yet. Click '+ Add External Monitor' to start pinging an endpoint").
- **Chart Fidelity**:
  - Real-time sparklines and time-series charts must have responsive axes, readable tooltips, and appropriate data decimation to prevent browser rendering lag.

---

## 3. Git & Work Execution Discipline

1. **Branch Isolation**: Never commit to `main`. Every task must execute on a dedicated branch (`feature/...`, `fix/...`, `chore/...`).
2. **Quality Gates**: Every branch must pass:
   - Type checks: `tsc --noEmit`
   - Linter: `eslint` with zero errors
   - Tests: Unit & integration test suites
   - Build: Successful production compilation
   - AI Reviewer: Zero `High` or `Critical` findings.
