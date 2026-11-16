# LazyArgon upstream sources (`SKILL-SOURCES.md`)

Generated from `docs/skill-source-receipts.json` (2026-11-15 rewrite). `skill_original` rows are code or text we copied and adapted; `inspiration` rows only shaped a design. `verified` means a 40-character commit that exists upstream; `unverified` rows carry no pin (the earlier made-up tags such as `pstack-v1` were removed). Check and poll with `node scripts/upstream_radar.mjs audit|poll --remote`.

## 1. Skill originals (copied and adapted)

| Upstream | Commit | License | Our files | Note |
| :--- | :--- | :--- | :--- | :--- |
| [`code-yeongyu/oh-my-openagent`](https://github.com/code-yeongyu/oh-my-openagent) | `3a5891d18cb5` | SUL-1.0 / see upstream LICENSE.md | `skills/ast-grep/SKILL.md`, `skills/coding-agent-sessions/SKILL.md`, `skills/data-scientist/SKILL.md`, `skills/debugging/SKILL.md`, `skills/frontend/SKILL.md`, `skills/git-master/SKILL.md`, `skills/programming/SKILL.md`, `skills/refactor/SKILL.md`, `skills/remove-ai-slops/SKILL.md`, `skills/visual-qa/SKILL.md`, `skills/ulw-research/SKILL.md`, `skills/ulw/SKILL.md`, `scripts/stop_claim_guard.mjs` | packages/shared-skills/skills: ten skills three-way merged to this commit on 2026-11-15; ulw and ulw-research are our own rewrites that diverged from upstream ulw-plan/ulw-execute/ulw-research |
| [`LilMGenius/paperthin`](https://github.com/LilMGenius/paperthin) | `c2ee8762b12a` | MIT | `skills/hate/SKILL.md`, `skills/shower/SKILL.md`, `skills/factchk/SKILL.md`, `skills/mandela/SKILL.md`, `skills/dedot/SKILL.md`, `NOTICE` | skills/depth/<name>; no upstream change to these five since our copy (checked 2026-11-15) |
| [`cathrynlavery/diagram-design`](https://github.com/cathrynlavery/diagram-design) | `f6db0decea96` | MIT | `skills/diagram-design/SKILL.md` | synced to upstream 2.6.164 on 2026-11-15; three Argon anti-pattern rows kept; repo-level checker scripts copied into skills/diagram-design/scripts |
| [`kaankiziltug/logo-design-skill`](https://github.com/kaankiziltug/logo-design-skill) | `e9eaddc07895` | MIT | `skills/logo-design/SKILL.md` | skills/logo-design |
| [`nexu-io/open-design`](https://github.com/nexu-io/open-design) | `6afe7eae156b` | Apache-2.0 | `skills/frontend/ATTRIBUTION.md` | frontend/references/design/<brand>.md, see skills/frontend/ATTRIBUTION.md |
| [`epoko77-ai/im-not-ai`](https://github.com/epoko77-ai/im-not-ai) | `80fae0ca391b` | MIT | `../lazyargon-workspace/skills/humanize-korean/SKILL.md` | skills/humanize-korean (was misattributed to blader/humanizer before 2026-11-15) |
| [`michael-denyer/pstack-claude`](https://github.com/michael-denyer/pstack-claude) | `a12b04786023` | MIT | `skills/create-verification-skill/SKILL.md`, `skills/encode-lessons/SKILL.md`, `skills/no-comments/SKILL.md`, `skills/programming/references/formal-verify.md` | pstack (Lauren Tan): no-comments, encode-lessons (two principles merged), create-verification-skill ported for Antigravity on 2026-11-16 |

## 2. Inspiration and references

| Upstream | Commit | License | Our files | Note |
| :--- | :--- | :--- | :--- | :--- |
| [`rlaope/oh-my-hermes`](https://github.com/rlaope/oh-my-hermes) | unpinned | - | `scripts/upstream_radar.mjs` | OMH / oh-my-hermes |
| [`NousResearch/hermes-agent`](https://github.com/NousResearch/hermes-agent) | `63d0b9412002` | - | `scripts/doctor.mjs`, `scripts/session_start.mjs` | Hermes-Agent base |
| [`can1357/oh-my-pi`](https://github.com/can1357/oh-my-pi) | unpinned | - | `scripts/lsp_diagnostics.mjs`, `skills/debugging/references/dap-session-plan.md` | omp LSP & DAP |
| [`faxenoff/ultracode`](https://github.com/faxenoff/ultracode) | unpinned | - | `scripts/codegraph.mjs` | ultracode graph engineering |
| [`revfactory/showreel`](https://github.com/revfactory/showreel) | `64521220a2f8` | - | `../lazyargon-workspace/skills/video-editor/references/showreel-videogen.md` | videogen / showreel |
| [`obra/superpowers`](https://github.com/obra/superpowers) | `2ce8aa15d05b` | - | `skills/debugging/SKILL.md`, `skills/debugging/references/dap-session-plan.md` | superpowers |
| [`garrytan/gstack`](https://github.com/garrytan/gstack) | unpinned | - | `skills/ulw/references/gstack-gates.md` | gstack |
| [`deepseek-ai/deepseek-harness`](https://github.com/deepseek-ai/deepseek-harness) | unpinned | - | `rules/AGENTS.md` | deepseek-harness |
| [`google-research/harness2`](https://github.com/google-research/harness2) | unpinned | - | `scripts/doctor.mjs` | harness2 |
| [`anthropics/claude-code`](https://github.com/anthropics/claude-code) | unpinned | - | `hooks.json`, `scripts/session_start.mjs` | Claude Code Hook & Subagent Harness |
| [`openai/codex`](https://github.com/openai/codex) | unpinned | - | `skills/programming/SKILL.md` | OpenAI Codex CLI Sandbox Harness |
| [`google-gemini/gemini-cli`](https://github.com/google-gemini/gemini-cli) | unpinned | - | `rules/AGENTS.md`, `scripts/doctor.mjs` | Gemini CLI Agent Runtime |
| [`anomalyco/opencode`](https://github.com/anomalyco/opencode) | unpinned | - | `scripts/lsp_diagnostics.mjs` | OpenCode TUI & LSP Harness |
| [`Aider-AI/aider`](https://github.com/Aider-AI/aider) | unpinned | - | `scripts/codegraph.mjs` | Aider RepoMap PageRank Harness |
| [`OpenHands/OpenHands`](https://github.com/OpenHands/OpenHands) | unpinned | - | `skills/gf-qa-behavioral-verification/SKILL.md` | OpenHands Runtime Verification |
| [`SWE-agent/SWE-agent`](https://github.com/SWE-agent/SWE-agent) | unpinned | - | `skills/debugging/SKILL.md` | SWE-agent ACI Debugging |
| [`cline/cline`](https://github.com/cline/cline) | unpinned | - | `skills/visual-qa/SKILL.md` | Cline Plan/Act & Browser QA |
| [`firecrawl/firecrawl`](https://github.com/firecrawl/firecrawl) | unpinned | - | `skills/ulw-research/SKILL.md` | Firecrawl Web Evidence & Deep Research |
| [`ast-grep/ast-grep`](https://github.com/ast-grep/ast-grep) | unpinned | - | `skills/ast-grep/SKILL.md` | ast-grep Structural Codemod |
| [`biomejs/biome`](https://github.com/biomejs/biome) | unpinned | - | `skills/programming/SKILL.md`, `scripts/lsp_diagnostics.mjs` | Biome Fast Lint & Format Guard |
| [`fivetaku/insane-research`](https://github.com/fivetaku/insane-research) | `8f92b33d5d80` | MIT | `skills/ulw-research/ATTRIBUTION.md`, `skills/ulw-research/scripts/claims-gate.mjs` | ideas and gate rules only, no code copied |
| [`yunshenwuchuxun/latex-paper-skills`](https://github.com/yunshenwuchuxun/latex-paper-skills) | `d0f106108cb0` | MIT | `skills/ulw-research/references/latex-report.md` | ideas only |
| [`ndpvt-web/latex-document-skill`](https://github.com/ndpvt-web/latex-document-skill) | `54279f78ecd9` | none declared | `skills/ulw-research/references/latex-report.md` | ideas only |
| [`Marker-Inc-Korea/ko-pii`](https://github.com/Marker-Inc-Korea/ko-pii) | `8957e8bc9f0a` | MIT | `../lazyargon-workspace/skills/korean-pii-masker/SKILL.md` | reference only |
| [`fivetaku/insane-search`](https://github.com/fivetaku/insane-search) | `82211894339e` | MIT | `skills/ulw-research/scripts/fetch-guard.mjs` | internal-address and injection-signal rules adapted; the engine is called, not bundled, only with --allow-bypass |

## 3. Removed on 2026-11-15

- `experimental/` (dag_ulw, lazy_memory, lazy_rag, autoresearch_loop, lazy_tui, model_calibrate, lazy_slop_cleaner): quarantined since 2026-10-30 with no use in real Antigravity sessions; deleted with their tests. Their inspiration rows (oh-my-claudecode, oh-my-codex, autoresearch, kimi-cli, ZCode, mem0, letta, AutoRAG, continue) went with them.
- `blader/humanizer`: was listed as the source of humanize-korean; the real original is `epoko77-ai/im-not-ai`.
