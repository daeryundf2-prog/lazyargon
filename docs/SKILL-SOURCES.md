# LazyArgon v2.0 Upstream Harness & Skill Sources (`SKILL-SOURCES.md`)

`@rlaope` 원문 19대 키워드 및 32개 글로벌 1위 업스트림 하네스의 고정 버전(`pinned_sha`)과 LazyArgon 내부 구현 매핑 원장이다. 정형 영수증은 `docs/skill-source-receipts.json`(`skill_source_closure_audit/v1`)에서 관리하며 `scripts/upstream_radar.mjs`로 상시 감사한다.

## 1. 32대 글로벌 1위 업스트림 하네스 매핑 원장

| # | 키워드 | 업스트림 레포 (`repo`) | 고정 SHA / 태그 (`pinned_sha`) | LazyArgon 매핑 타겟 (`mapped_targets`) |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `OMH / oh-my-hermes` | `rlaope/oh-my-hermes` | `0f9cf0c` | `scripts/dag_ulw.mjs`, `scripts/lazy_tui.mjs`, `scripts/upstream_radar.mjs` |
| 2 | `Hermes-Agent base` | `NousResearch/hermes-agent` | `63d0b941` | `scripts/doctor.mjs`, `scripts/session_start.mjs` |
| 3 | `omp LSP & DAP` | `can1357/oh-my-pi` | `omp-lsp-dap-v1` | `scripts/lsp_diagnostics.mjs`, `skills/debugging/references/dap-session-plan.md` |
| 4 | `poteto pstack & skills` | `michael-denyer/pstack-claude` | `pstack-v1` | `skills/programming/references/formal-verify.md` |
| 5 | `ultracode graph engineering` | `faxenoff/ultracode` | `codegraph-ppr-v1` | `scripts/codegraph.mjs` |
| 6 | `videogen / showreel` | `revfactory/showreel` | `64521220a2f8` | `../lazyargon-workspace/skills/video-editor/references/showreel-videogen.md` |
| 7 | `humanizer(말투)` | `blader/humanizer` | `8c307f36` | `scripts/lazy_slop_cleaner.mjs`, `../lazyargon-workspace/skills/humanize-korean/SKILL.md` |
| 8 | `OmO` | `code-yeongyu/oh-my-openagent` | `v5.1.51` | `skills/ulw/SKILL.md`, `scripts/stop_claim_guard.mjs` |
| 9 | `OMC` | `Yeachan-Heo/oh-my-claudecode` | `8262f9f7` | `scripts/lazy_slop_cleaner.mjs` |
| 10 | `OMX` | `Yeachan-Heo/oh-my-codex` | `omx-runtime-v1` | `scripts/dag_ulw.mjs` |
| 11 | `superpowers` | `obra/superpowers` | `v7.0.1` | `skills/debugging/SKILL.md`, `skills/debugging/references/dap-session-plan.md` |
| 12 | `gstack` | `garrytan/gstack` | `gstack-23roles` | `skills/ulw/references/gstack-gates.md` |
| 13 | `auto-research` | `karpathy/autoresearch` | `autoresearch-v1` | `scripts/autoresearch_loop.mjs`, `skills/ulw/references/measured-loop-discipline.md` |
| 14 | `deepseek-harness` | `deepseek-ai/deepseek-harness` | `cordis-2608.25512` | `rules/AGENTS.md`, `scripts/lazy_slop_cleaner.mjs` |
| 15 | `kimi-code` | `MoonshotAI/kimi-cli` | `kimi-k3.1-pro` | `scripts/model_calibrate.mjs` |
| 16 | `zcode` | `zai-org/ZCode` | `glm-5.3-zcode` | `scripts/model_calibrate.mjs` |
| 17 | `mem0` | `mem0ai/mem0` | `mem0-graph-v1` | `scripts/lazy_memory.py` |
| 18 | `letta` | `letta-ai/letta` | `letta-dreaming-v1` | `scripts/lazy_memory.py` |
| 19 | `autorag` | `MarkrAI/AutoRAG` | `autorag-rrf-v1` | `scripts/lazy_rag.py` |
| 20 | `harness2` | `google-research/harness2` | `harness2-keep-base` | `scripts/doctor.mjs`, `scripts/lazy_slop_cleaner.mjs` |
| 21 | `Claude Code Hook & Subagent Harness` | `anthropics/claude-code` | `v1.0.24` | `hooks.json`, `scripts/session_start.mjs` |
| 22 | `OpenAI Codex CLI Sandbox Harness` | `openai/codex` | `codex-cli-01a8f2c` | `skills/programming/SKILL.md` |
| 23 | `Gemini CLI Agent Runtime` | `google-gemini/gemini-cli` | `a4c91e2` | `rules/AGENTS.md`, `scripts/doctor.mjs` |
| 24 | `OpenCode TUI & LSP Harness` | `anomalyco/opencode` | `9b3d41e` | `scripts/lazy_tui.mjs`, `scripts/lsp_diagnostics.mjs` |
| 25 | `Aider RepoMap PageRank Harness` | `Aider-AI/aider` | `7c2e89a` | `scripts/codegraph.mjs` |
| 26 | `OpenHands Runtime Verification` | `All-Hands-AI/OpenHands` | `5f1b30d` | `skills/gf-qa-behavioral-verification/SKILL.md` |
| 27 | `SWE-agent ACI Debugging` | `SWE-agent/SWE-agent` | `3e8a71c` | `skills/debugging/SKILL.md` |
| 28 | `Continue Context Rerank` | `ContinueDev/continue` | `4d9c20b` | `scripts/lazy_rag.py` |
| 29 | `Cline Plan/Act & Browser QA` | `cline/cline` | `8a1f64e` | `skills/visual-qa/SKILL.md` |
| 30 | `Firecrawl Web Evidence & Deep Research` | `mendableai/firecrawl` | `2c7e51a` | `skills/ulw-research/SKILL.md` |
| 31 | `ast-grep Structural Codemod` | `ast-grep/ast-grep` | `6b4d92f` | `skills/ast-grep/SKILL.md` |
| 32 | `Biome Fast Lint & Format Guard` | `biomejs/biome` | `1f8e34c` | `skills/programming/SKILL.md`, `scripts/lsp_diagnostics.mjs` |

## 2. 클로저 감사 및 상시 트래킹 (`upstream_radar.mjs`)

- **클로저 감사 (`audit`)**: 영수증 스키마 무결성(`repo`, `url`, `pinned_sha`, `mapped_targets`)과 로컬 디스크 매핑 파일 실존 여부를 검증한다.

```bash
node scripts/upstream_radar.mjs audit --json
node scripts/upstream_radar.mjs list
node scripts/upstream_radar.mjs poll --offline
node scripts/upstream_radar.mjs poll --remote
```

- **드리프트 폴링 (`poll`)**: 기본(`--offline`) 모드는 고정 SHA 상태를 즉시 반환하며, `--remote` 지정 시 `gh api repos/<repo>/commits/HEAD --jq .sha`(타임아웃 3초, 실패 시 로컬 폴백)로 업스트림 커밋 드리프트를 감지한다.
