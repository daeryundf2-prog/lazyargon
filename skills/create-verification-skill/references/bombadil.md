# Property exploration with Bombadil (optional drive mode)

[Bombadil](https://github.com/antithesishq/bombadil) (Antithesis, MIT) explores a web or terminal UI on its own: it reads the current state, checks every exported property, picks the next action (click, type, navigate, reload), and repeats. Example-based drives (Playwright steps, tmux scripts) prove the paths you thought of; Bombadil looks for the paths you did not. Use it as an extra pass after the scripted drive, not instead of it. Manual: <https://github.com/antithesishq/bombadil/tree/main/docs/manual/src>.

Checked on 2026-11-16 with v0.7.10 (`bombadil-aarch64-darwin`, ad-hoc signed, no Developer ID): a local page that throws on the third click of a button was found within seconds, exit code 2, `noUncaughtExceptions` named, a reproduce command printed; a custom `always` property on a counter element and a terminal run (`head -n100`, exit 0) also worked.

## Install

- npm, per project: `npm install --save-dev @antithesishq/bombadil` (also gives the TypeScript types for specifications).
- macOS binary: `curl -L -o bombadil https://github.com/antithesishq/bombadil/releases/download/v<version>/bombadil-aarch64-darwin && chmod +x bombadil`.
- Browser tests drive a local Chrome/Chromium; terminal tests need nothing else.

## Run

```bash
# Web: default properties (uncaught exceptions, unhandled rejections, error logs, HTTP 4xx/5xx, ...)
bombadil browser test --headless --exit-on-violation --time-limit 2m --output-path evidence/bombadil-web http://127.0.0.1:<port>/
# Terminal: default properties (exit code 0, no unrenderable byte sequences)
bombadil terminal test --output-path evidence/bombadil-tui <your-cli> <args>   # terminal mode is marked EXPERIMENTAL
```

- Exit codes: `0` no violation, `1` tool error, `2` property violation(s). Treat `2` as FAIL with the printed property name as the finding.
- `--output-path` must name a file whose parent directory exists; it keeps the trace and screenshots as evidence. `bombadil browser inspect <trace>` opens the timeline viewer; `bombadil trace <trace> --screen` prints terminal states.
- Reproduce: the run prints `bombadil browser test '<url>' --headless --reproduce <trace>`; `bombadil browser shrink --headless --trace <trace> <url>` shrinks it to fewer steps.
- Restrict navigation with `--allow-url <pattern>` so the explorer stays on the app under test. Only point it at local or staging instances you started, never at production or a third-party site, and never at an app holding client data.

## Custom properties

A specification is a TypeScript module; every exported property and action generator is used. Start from the defaults and add the app's own invariants:

```typescript
export * from "@antithesishq/bombadil/browser/defaults";
import { always, extract } from "@antithesishq/bombadil";

const count = extract(state => Number(state.document.querySelector("#count")?.textContent ?? "0"));
export const countNeverNegative = always(() => count.current >= 0);
```

Browser: pass it as the last positional argument (`bombadil browser test [OPTIONS] <url> spec.ts`). Terminal: `--specification spec.ts` (uses the `@antithesishq/bombadil/terminal` API). Temporal operators (`always`, `eventually(...).within(5, "seconds")`, sliding windows, state machines) are in the manual's Specification language chapter; read it before writing anything beyond `always`.

## In a generated verify skill

Add an **Explore** step after Drive when the surface is a web UI or a CLI/TUI: the exact command for this repo, the time limit, the allow-url pattern, where the trace goes, and how a violation is reported (property name, reproduce command, trace path). Keep the trace through cleanup like any other evidence.
