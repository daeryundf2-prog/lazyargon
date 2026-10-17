# LazyArgon 키워드 라우팅 표

`rules/AGENTS.md`에서 분리한 전체 표다. 규칙 파일이 호스트 토큰 예산을 넘으면 잘리지 않고 **통째로 빠지므로**(google-antigravity/antigravity-cli #1254) 규칙 파일에는 요약만 두고 이 표는 필요할 때 읽는다. 각 스킬의 `SKILL.md` 프런트매터 `description`이 1차 라우팅 근거다.


| Keyword(s) | Skill / Action | Role & Purpose |
|---|---|---|
| "/ulw", "ulw", "ultrawork", "ulw-loop", "ulw-plan", "mass-ulw", "plan this", "작업 계획", "계획 실행" | `$ulw` | Autonomous workflow (3-line scope lock, budgeted fan-out, runtime verification) |
| "review work", "QA work", "작업 검증", "행동 검증" | `$gf-qa-behavioral-verification` | Runtime behavioral verification, negative-path & error-masking check |
| "artifact consistency", "산출물 무결성", "미러 검증" | `$gf-qa-artifact-consistency` | Dual-copy tree, manifest & generated artifact parity check |
| "computed outputs", "수식 검증", "참조 무결성" | `$gf-qa-computed-outputs` | Formula, derived metric, link & ID cross-reference check |
| "ulw-research", "ulw research", "deep research", "ultra-research" | `$ulw-research` | Saturation research with budgeted subagent waves & debate |
| "flaky-guard", "flaky test" | `$ulw` | Stress-run test hardening via `skills/ulw/references/flaky-guard.md` |
| "arch-guard", "architecture drift" | `$ulw` | Clean Architecture audit via `skills/ulw/references/arch-guard.md` |
| "hypothesis-tree", "falsification" | `$ulw` | 3-hypothesis root-cause isolation via `skills/ulw/references/hypothesis-tree.md` |
| "swarm-sync", "file ownership" | `$ulw` | Partitioned conflict-free swarm via `skills/ulw/references/swarm-sync.md` |
| "ui-loopback", "visual loopback" | `$visual-qa` | Real-time UI multimodal remediation via `skills/visual-qa/references/ui-loopback.md` |
| "dual-verify", "co-verify" | `$ulw` | 2-Pass co-verification via `skills/ulw/references/dual-verify.md` |
| "repo-survey", "deepsearch" | `$ulw` | Whole-codebase topology via `skills/ulw/references/repo-survey.md` |
| "self-audit", "잘못했어요", "반성문" | `$ulw` | Agent confession & rollback via `skills/ulw/references/self-audit.md` |
| "vector diagram", "구조도 생성" | `$image-prompt` | Code-based vector diagram via `skills/image-prompt/references/vector-diagram.md` |
| "diagram design", "다이어그램", "diagram-design", "도식화" | `$diagram-design` | Branded editorial diagram design (39 visual types) |
| "programming", "strict types", "코드 작성" | `$programming` | Strict types, modern stacks, TDD & 250 LOC ceiling |
| "debugging", "debug this", "버그 추적" | `$debugging` | Hypothesis-driven runtime debugging across any binary |
| "refactor", "리팩토링", "구조 개선" | `$refactor` | Intelligent code refactor & restructuring |
| "ast-refactor", "ast grep", "ast-grep", "codemod", "sg" | `$ast-grep` | AST-shape search/rewrite across 25 languages via sg CLI |
| "git commit", "git master", "커밋" | `$git-master` | Atomic commits, history analysis, rebase/bisect |
| "remove slop", "clean ai code", "코드 슬롭 제거" | `$remove-ai-slops` | Parallel AI code smell elimination across 10 categories |
| "coding sessions", "past session", "세션 복구" | `$coding-agent-sessions` | Cross-platform coding-agent session finder |
| "data analysis", "csv", "parquet", "duckdb", "polars" | `$data-scientist` | DuckDB/Polars resident-kernel data processing |
| "frontend", "ui-ux", "design system" | `$frontend` | Senior designer-grade UI/UX design systems & motion rules |
| "visual-qa", "pixel diff", "ui check", "시각적 검증" | `$visual-qa` | Multimodal UI verification & CJK precision review |
| "image-prompt", "공냥 프롬프트", "이미지 프롬프트" | `$image-prompt` | Image generation prompt compiler & playbook |
| "logo design", "로고 디자인", "로고 제작", "logo-design" | `$logo-design` | Professional SVG logo & brand identity design |
| "doctor", "플러그인 진단", "plugin doctor" | `node scripts/doctor.mjs` | Plugin environment & consistency diagnostics (read-only) |
