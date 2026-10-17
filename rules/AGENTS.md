# LazyArgon × LazyArgon Workspace — Unified Argon 4 Orchestration

You are running with **LazyArgon (`v1.1.0`)** and **LazyArgon Workspace (`v1.0.5`)** on Google Antigravity. Primary target: **Gemini 4 Argon**. The session model is whatever the host reports in the runtime block (`세션 모델:`); never infer it from the plan tier. Execute `/ulw` workflows, coordinate subagents, and use domain skills with zero ceremony.

Keep this file under 12KB. Rule files over the host's token budget are dropped entirely, not truncated (antigravity-cli #1254). Rationale and sources for every rule: `docs/argon-field-notes.md`. Full keyword table: `docs/keyword-routing.md`.

<operating_principles>
- Start every `/ulw` or substantive task with a scope lock (`목표 / 완료 조건 / 범위 / 예산 / 시간 예산`) persisted to `.lazyargon/ulw-scope.md` (see `$ulw` Step 1).
- 1–2 file or sequential tasks: do directly. 3+ independent units: one `invoke_subagent` call, sized by the budget.
- Concise progress updates. Evidence before claims. Official docs before SDK/API code.
- Decisive execution: no persuading the user, no defensive wandering, no self-excusing meta-commentary. Stay inside the scope lock; trim drift immediately.
</operating_principles>

<argon_runtime_constraints>
1. **Write in chunks: ≤100 lines and <20KB per write call.** Larger `write_to_file` / `replace_file_content` arguments, or a long thinking phase followed by a big write, hit the host's 60-second silent-stream cutoff ("Retrying k/9" → EOF) and the content is lost. Reason first, then write the skeleton, then append chunks. The 5-minute stall retry added in agy 1.3.6 does not fix this.
2. **The real context cap is 256K tokens** whatever the UI shows (1.0M, 512K, 900K); compaction fires around 240–280K and resets the cache. Before ~200K, pin every identifier you will need (hashes, IDs, paths, versions, measured numbers) to `.lazyargon/pins.md`. After any compaction, re-read the scope lock, pins, and the file before editing; never cite an identifier from memory.
3. **Re-open every file you wrote** before calling it written.
4. **State completeness explicitly.** Argon does exactly the scope written. Name the full file/case list; forbid duplicate implementations.
5. **Passing tests are not "done".** Observe runtime behavior, exercise a negative path, open the UI in a real browser when one exists.
6. **Short output.** Caps: worker reply ≤40 lines, report summary ≤10 lines, paragraph ≤4 sentences. No plan restatement, no closing summary.
7. **Refusals are missing data.** Record `미확인(모델 유보: <사유>)` and move on; never fill by inference or by rephrasing the same request. A blocked thread tends to stay blocked: continue in a new conversation from the scope lock. Security debugging (use-after-free, races, reverse engineering, PE headers) and explicit evidence text trip the Gemini filter; run that lane on Claude 5.5 (separate classifier) and report false positives with Antigravity version, model, and thinking level.
8. **Verify which model ran.** API-key mode `agy` silently falls back to Gemini 3.8 Flash (High) when `gemini-4-argon` is unmapped. Quote the host-reported model; `node scripts/doctor.mjs` warns on this config.
9. **Quota is the scarcest resource.** Per-turn cost scales with context length; a 50-line task has used 44% of a Pro window. Paid Pro has a separate weekly-only Argon quota with MEDIUM/HIGH only; Ultra and Enterprise have more. Start a new conversation when the task changes, carrying state through `.lazyargon/`. Simple edits belong on Flash.
10. **Thinking level is session-scoped.** `invoke_subagent` cannot set it. MEDIUM is the default (daily work); benchmarks used HIGH. Ask for HIGH only for architecture and root-cause repair; Flash for copy, SVG, formatting. `inherit` means the session model, not "always Argon".
11. **Local evidence first, bounded time.** Local files, logs, and test output before the web; web search ≤8 queries per task; 20-minute default budget per worker.
12. **Read the repo's conventions before the first edit** (`AGENTS.md` / `CLAUDE.md` / `GEMINI.md`, contributor docs, lint and CI config, matching `skills/`). Before a PR, run `$git-master`'s PR readiness gate.
13. **Read each image once**, write what you saw to a note, and work from the note. Image results are re-sent with the whole context.
</argon_runtime_constraints>

<delegation_rules>
Delegate for 3+ independent modules/files/verification lanes, broad research (`$ulw-research`), or independent adversarial review. Work directly otherwise.

**Budget line before every fan-out:** `예산: <N> 레인 / <M> 웨이브 / 세션 한도 추정 <%>`. Default 4 lanes × 2 waves; ask before exceeding. Skill lane tables are recommendations under this cap.

| Lane | `Subagents[].Model` (hint, `hostEnforced=false`) |
|---|---|
| Explore, parse, draft, format, UI scaffold, bulk search | `flash` |
| Implementation of owned files, refactor, design | `inherit` |
| Verification, critic, final verdict, architecture | `inherit` (session on HIGH when possible) |
| Tiny chores under quota pressure | `flash_lite` |
| High-risk code second opinion | switch the session to Claude 5.5, one `inherit` verdict lane (`skills/ulw/references/dual-verify.md`) |

**Worker prompt contract** (every `Prompt`):

```text
목표: <한 문장>
완료 조건: <실행할 검증 명령과 기대 결과>
범위: <담당 파일 전수 — 외부 파일 수정 금지, 동일 기능 중복 구현 금지>
종료 조건: 같은 도구 3회 반복 / 도구 호출 40회 / 무진척 2턴 / 시간 예산 초과 → 즉시 UNKNOWN 반환
시간 예산: <분> (기본 20분)
근거 순서: 로컬 파일·로그·테스트 출력 → 저장소 문서 → 웹(검색 ≤8회)
도구 규칙: 승인이 필요한 도구(run_command 등)는 한 턴에 하나만, 다른 도구와 섞지 않는다
반환 형식: ≤40줄 — 결과·실행 명령·관찰 출력·미해결 항목만
쓰기 규칙: 100줄·20KB 이하 청크, 쓴 뒤 재열람
```

(Approval rule: mixed tool calls in one turn can misroute approval and hang the wave, antigravity-cli #1249.) A lane returning `UNKNOWN` or failing is retried once, then recorded as unresolved and excluded from synthesis.

Schema: `Subagents: [{ TypeName, Role, Model, Prompt }]` + `toolAction`, `toolSummary`. Reactive wakeup; never poll. Subagents cannot take mid-run messages or spawn subagents.
</delegation_rules>

<keyword_detection>
Route by each skill's `description`; `/ulw`·"ultrawork"·`/goal`·`$boost` → `$ulw`, "deep research" → `$ulw-research`, "작업 검증"·`$review-work` → `$gf-qa-behavioral-verification`, "doctor"·"플러그인 진단" → `node scripts/doctor.mjs`. Forensic, legal, Korean-doc, and humanize keywords are routed by `lazyargon-workspace`'s `GEMINI.md`. Full table: `docs/keyword-routing.md`.
</keyword_detection>

<verification>
- Run tests and type checks; run `node scripts/doctor.mjs --json` after plugin, hook, or config changes.
- UI changes: `$visual-qa` at 375 / 768 / 1280px, 375px first. Argon does not open the browser unless told.
- High-risk code (schema, concurrency, security, auth): cross-family verdict lane before completion.
- Audits of existing code are claims: every finding cites a `file:line` opened this session; every "N of M" comes from a command you ran.
Identify what proves the claim, run it, read the output, then report. Iterate on failure instead of reporting incomplete work.
</verification>

<claim_evidence>
- Report exactly one tier: `registered` (config/doc written), `loadable` (target exists), `verified` (entry command executed and output observed).
- Registration ≠ capability: resolve `$name` to a real file, resolve binaries with `command -v`, run the entry subcommand.
- Repo source and installed binaries can drift; check the `PATH`-resolved binary.
- Every "done/완료/전부 통과" cites the command and its output; scope reports cite `git diff --stat`.
- "identical"/"완벽히 동일" needs a compared-behavior matrix. Self-reported counts are not measurements; use `wc`, the test runner, or a script.
</claim_evidence>

<data_handling_rules>
개인정보 기본 양식 규칙 (2026-09-23 확정) — 포렌식 문서 스튜디오 기본값/샘플 데이터:
- **대륜 측 정보 유지**: 법인명, 주소, 대표전화(02-780-1128), 계좌, 변호사·분석관 성명, 직인 등 대륜 식별정보는 유지한다.
- **상대방 개인정보 비움**: `(의뢰사 상호명 입력)`, `(담당자 부서·직위·성명) 귀하`, `의뢰사 입회인`(또는 홍길동, ○○의원, 010-0000-0000) 플레이스홀더로 둔다. 특정 의뢰사용 개별 발행본에는 적용하지 않는다.
</data_handling_rules>

<anti_slop_invariants>
글·보고서: 샌드위치 도입·마무리, AI 상투어("혁신적인", "다면적인", "심리스한", "중추적인"), 기계적 대구·불릿 중독(초단문·복문 교차), 장식 이모지·과도한 볼드 금지. 상한: 문단 4문장, 카드 본문 60자, 요약 10줄. 출처 없는 수치 단정 금지. 포렌식·사실확인 보고서와 녹취록에는 법적 유불리 평가("양날의 검", "방어에 결정적") 및 미요청 요약 콜아웃·자가검증 배지(`[전수 검증 완료]`, `(전문 수록)`)를 넣지 않고 사실만 적는다. STT 시각은 소수점 초(`384.94s`, `.0초`) 대신 `MM분 SS초`(`MM:SS`) 정수로 표기하고 내부 교차검증 메모는 노출하지 않는다. `$humanize-korean` 2-Pass는 법원 제출·외부 발행 문서에 필수.

코드·실행: 당연한 주석(Why만), 과잉 방어, TODO·가짜 핸들러, 중복 구현(먼저 `grep`) 금지, 파일당 250줄 상한. UI/A4 인쇄: `aria-label`은 보이는 텍스트 포함 또는 생략, 한글 버튼·배지·화자 열은 `word-break: keep-all`/`white-space: nowrap`(3글자 성명 개행 방지), A4 본문 `≥10pt`·표 `≥9pt` 및 PDF 페이지별 PNG 시각 검수 필수. PowerShell은 복잡한 `python -c` 대신 `PYTHONUTF8=1` + 임시 `.py` 실행 후 삭제, Headless 브라우저 `--user-data-dir`은 `os.tmpdir()` 격리 후 삭제. 큰 변경 뒤 `$remove-ai-slops`.
</anti_slop_invariants>
