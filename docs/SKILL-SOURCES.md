# LazyArgon v2.0 Upstream Harness & Skill Sources (`SKILL-SOURCES.md`)

`@rlaope` 원문 키워드와 참고한 업스트림 32개의 매핑 원장이다. `verified`는 GitHub에서 확인된 40자 커밋 SHA이고, `unverified`는 핀이 확인되지 않아 `pinned_sha: null`로 둔 항목이다(예전 값은 `claimed_pin`에 보존). 매핑은 "참고한 아이디어"이지 원본 구현 이식이 아니다. 정형 영수증은 `docs/skill-source-receipts.json`(`skill_source_closure_audit/v1`)에서 관리하며 `scripts/upstream_radar.mjs`로 상시 감사한다.

## 1. 32대 글로벌 1위 업스트림 하네스 매핑 원장

| # | 키워드 | 업스트림 레포 (`repo`) | 핀 (`pinned_sha` / `status`) | LazyArgon 매핑 타겟 (`mapped_targets`) |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `OMH / oh-my-hermes` | `rlaope/oh-my-hermes` | unverified (claimed `0f9cf0c`) | `experimental/scripts/dag_ulw.mjs`, `experimental/scripts/lazy_tui.mjs`, `scripts/upstream_radar.mjs` |
| 2 | `Hermes-Agent base` | `NousResearch/hermes-agent` | `63d0b9412002` (verified) | `scripts/doctor.mjs`, `scripts/session_start.mjs` |
| 3 | `omp LSP & DAP` | `can1357/oh-my-pi` | unverified (claimed `omp-lsp-dap-v1`) | `scripts/lsp_diagnostics.mjs`, `skills/debugging/references/dap-session-plan.md` |
| 4 | `poteto pstack & skills` | `michael-denyer/pstack-claude` | unverified (claimed `pstack-v1`) | `skills/programming/references/formal-verify.md` |
| 5 | `ultracode graph engineering` | `faxenoff/ultracode` | unverified (claimed `codegraph-ppr-v1`) | `scripts/codegraph.mjs` |
| 6 | `videogen / showreel` | `revfactory/showreel` | `64521220a2f8` (verified) | `../lazyargon-workspace/skills/video-editor/references/showreel-videogen.md` |
| 7 | `humanizer(말투)` | `blader/humanizer` | `8c307f367c91` (verified) | `experimental/scripts/lazy_slop_cleaner.mjs`, `../lazyargon-workspace/skills/humanize-korean/SKILL.md` |
| 8 | `OmO` | `code-yeongyu/oh-my-openagent` | `c8955517dd95` (verified) | `skills/ulw/SKILL.md`, `scripts/stop_claim_guard.mjs` |
| 9 | `OMC` | `Yeachan-Heo/oh-my-claudecode` | `8262f9f790ee` (verified) | `experimental/scripts/lazy_slop_cleaner.mjs` |
| 10 | `OMX` | `Yeachan-Heo/oh-my-codex` | unverified (claimed `omx-runtime-v1`) | `experimental/scripts/dag_ulw.mjs` |
| 11 | `superpowers` | `obra/superpowers` | `2ce8aa15d05b` (verified) | `skills/debugging/SKILL.md`, `skills/debugging/references/dap-session-plan.md` |
| 12 | `gstack` | `garrytan/gstack` | unverified (claimed `gstack-23roles`) | `skills/ulw/references/gstack-gates.md` |
| 13 | `auto-research` | `karpathy/autoresearch` | unverified (claimed `autoresearch-v1`) | `experimental/scripts/autoresearch_loop.mjs`, `experimental/docs/measured-loop-discipline.md` |
| 14 | `deepseek-harness` | `deepseek-ai/deepseek-harness` | unverified (claimed `cordis-2608.25512`) | `rules/AGENTS.md`, `experimental/scripts/lazy_slop_cleaner.mjs` |
| 15 | `kimi-code` | `MoonshotAI/kimi-cli` | unverified (claimed `kimi-k3.1-pro`) | `experimental/scripts/model_calibrate.mjs` |
| 16 | `zcode` | `zai-org/ZCode` | unverified (claimed `glm-5.3-zcode`) | `experimental/scripts/model_calibrate.mjs` |
| 17 | `mem0` | `mem0ai/mem0` | unverified (claimed `mem0-graph-v1`) | `experimental/scripts/lazy_memory.py` |
| 18 | `letta` | `letta-ai/letta` | unverified (claimed `letta-dreaming-v1`) | `experimental/scripts/lazy_memory.py` |
| 19 | `autorag` | `Marker-Inc-Korea/AutoRAG` | unverified (claimed `autorag-rrf-v1`) | `experimental/scripts/lazy_rag.py` |
| 20 | `harness2` | `google-research/harness2` | unverified (claimed `harness2-keep-base`) | `scripts/doctor.mjs`, `experimental/scripts/lazy_slop_cleaner.mjs` |
| 21 | `Claude Code Hook & Subagent Harness` | `anthropics/claude-code` | unverified (claimed `v1.0.24`) | `hooks.json`, `scripts/session_start.mjs` |
| 22 | `OpenAI Codex CLI Sandbox Harness` | `openai/codex` | unverified (claimed `codex-cli-01a8f2c`) | `skills/programming/SKILL.md` |
| 23 | `Gemini CLI Agent Runtime` | `google-gemini/gemini-cli` | unverified (claimed `a4c91e2`) | `rules/AGENTS.md`, `scripts/doctor.mjs` |
| 24 | `OpenCode TUI & LSP Harness` | `anomalyco/opencode` | unverified (claimed `9b3d41e`) | `experimental/scripts/lazy_tui.mjs`, `scripts/lsp_diagnostics.mjs` |
| 25 | `Aider RepoMap PageRank Harness` | `Aider-AI/aider` | unverified (claimed `7c2e89a`) | `scripts/codegraph.mjs` |
| 26 | `OpenHands Runtime Verification` | `OpenHands/OpenHands` | unverified (claimed `5f1b30d`) | `skills/gf-qa-behavioral-verification/SKILL.md` |
| 27 | `SWE-agent ACI Debugging` | `SWE-agent/SWE-agent` | unverified (claimed `3e8a71c`) | `skills/debugging/SKILL.md` |
| 28 | `Continue Context Rerank` | `continuedev/continue` | unverified (claimed `4d9c20b`) | `experimental/scripts/lazy_rag.py` |
| 29 | `Cline Plan/Act & Browser QA` | `cline/cline` | unverified (claimed `8a1f64e`) | `skills/visual-qa/SKILL.md` |
| 30 | `Firecrawl Web Evidence & Deep Research` | `firecrawl/firecrawl` | unverified (claimed `2c7e51a`) | `skills/ulw-research/SKILL.md` |
| 31 | `ast-grep Structural Codemod` | `ast-grep/ast-grep` | unverified (claimed `6b4d92f`) | `skills/ast-grep/SKILL.md` |
| 32 | `Biome Fast Lint & Format Guard` | `biomejs/biome` | unverified (claimed `1f8e34c`) | `skills/programming/SKILL.md`, `scripts/lsp_diagnostics.mjs` |

## 2. 클로저 감사 및 상시 트래킹 (`upstream_radar.mjs`)

- **클로저 감사 (`audit`)**: 영수증 스키마 무결성(`repo`, `url`, `pinned_sha`, `mapped_targets`)과 로컬 디스크 매핑 파일 실존 여부를 검증한다.

```bash
node scripts/upstream_radar.mjs audit --json
node scripts/upstream_radar.mjs list
node scripts/upstream_radar.mjs poll --offline
node scripts/upstream_radar.mjs poll --remote
```

- **드리프트 폴링 (`poll`)**: 기본(`--offline`) 모드는 고정 SHA 상태를 즉시 반환하며, `--remote` 지정 시 `gh api repos/<repo>/commits/HEAD --jq .sha`(타임아웃 3초, 실패 시 로컬 폴백)로 업스트림 커밋 드리프트를 감지한다.
