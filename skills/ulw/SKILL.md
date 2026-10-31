---
name: ulw
description: "Unified autonomous execution workflow for Antigravity (/ulw, ultrawork, ulw-plan, mass-ulw, ulw-loop). Locks scope in 3 lines (목표/완료 조건/범위) persisted to .lazyargon/ulw-scope.md, declares a quota budget, routes 1-2 file tasks directly or 3+ independent tasks via tiered parallel subagents, enforces chunked writes and post-compaction re-reads, and requires empirical verification before completion."
---

# ULW — Unified Autonomous Execution (`/ulw`)

단일 진입점(`/ulw`, `ulw`, `ultrawork`, `ulw-plan`, `mass-ulw`, `ulw-loop`)으로 계획·병렬 구현·검증을 끝까지 완수하는 자율 실행 프로토콜이다. 상태 파일은 **딱 하나**(`.lazyargon/ulw-scope.md`)만 쓴다. 이 파일은 컨텍스트 컴팩션과 호스트 재시도 루프 뒤에 범위 잠금을 복구하기 위한 것이지, 진행 로그가 아니다. 형식적 역할극 없이 3줄 범위 잠금과 실제 실행 증거(`verified`)로만 동작한다.

`rules/AGENTS.md`의 `<argon_runtime_constraints>`가 이 스킬의 전제다: 100줄 청크 쓰기, 컴팩션 후 재열람, 쓴 뒤 재열람, 완전성 명시, 짧은 출력, 쿼터 예산.

---

## Step 1. 3줄 범위 잠금 + 예산 (Scope Lock)

모든 `/ulw` 작업은 첫 도구 호출 직전에 아래를 선언하고, **같은 내용을 `.lazyargon/ulw-scope.md`에 쓴다**:

```text
목표: <한 문장>
완료 조건: <직접 실행할 검증 명령과 기대 결과>
범위: <수정할 파일·디렉토리 전수 / 손대지 않을 경로>
예산: <N 레인 / M 웨이브 / 세션 한도 추정 %>   ← 기본 4 레인 / 2 웨이브
시간 예산: <분>                                  ← 기본 메인 60분, 워커당 20분
```

- **저장소 규약 먼저**: 첫 수정 전에 대상 저장소의 `AGENTS.md`·`CLAUDE.md`·`GEMINI.md`, 기여 문서, 린트·CI 설정, 작업과 맞는 `skills/`를 읽고 범위 잠금 아래에 `규약: <읽은 파일 목록>` 한 줄을 남긴다. Argon은 저장소의 스킬 파일과 CI 실패를 건너뛴 사례가 보고됐다.

- **식별자 고정 (`Workspace Fact` vs `Domain Procedure` 이원화)**: 해시·ID·파일 경로·버전·측정값·테이블 조인 키 매핑처럼 현재 워크스페이스에서 검증된 사실(`Workspace Fact`)은 확인한 즉시 `.lazyargon/pins.md`에 `- [fact] <이름>: <값> (출처 명령 또는 파일:라인)`으로 적는다. 실제 컨텍스트 상한은 UI 표시와 무관하게 256K이고 240~280K에서 컴팩션되며, 요약(`<CONTEXT_SUMMARY>`) 뒤 인접 행의 ID(`hit_id`·`source_id`)·분류명(`artifact_name`)·스케일·SHA를 서로 뒤섞어 날조한 사례가 있다(antigravity-cli #1245, 로컬 세션 6b6b9fad). 따라서 `<CONTEXT_SUMMARY>`는 절대 1차 근거로 신뢰하지 않으며, 컴팩션 뒤에는 반드시 `.lazyargon/pins.md`·원본 DB(`query_evidence_db.py --verify-hits/--verify-report`)·원시 실행 로그(`steps/*/output.txt`)에서 재검증한 값만 인용한다. `SessionStart`가 이 파일 앞 20줄을 다시 주입한다. 다른 과제·사건으로 넘어갈 때 이전 워크스페이스의 `[fact]`는 가설로만 취급하고 재검증하며, 도메인 전반에서 재사용할 절차(`Domain Procedure`)는 `cue`(발동 조건) / `lesson`(행동 지침) / `evidence`(근거 궤적) 3요소로 스킬·스크립트에 분리 기록한다(`google-research/harness2`).
- **재개 규칙**: 턴 시작 시 `.lazyargon/ulw-scope.md`가 있으면 먼저 읽는다. 트랜스크립트에 "Resuming from a compaction"이 보이거나 범위 잠금을 그대로 인용할 수 없으면, 이 파일이 유일한 진실이다. 작업이 끝나면 파일 맨 끝에 `상태: 완료 <검증 명령>` 한 줄을 추가한다(삭제하지 않는다).
- **모호성 게이트**: 요구사항에 치명적 충돌이나 방향 결정을 요하는 모호함이 있을 때만 `ask_question`으로 딱 1회 질문한다. 코드베이스 탐색으로 답을 찾을 수 있는 사실 관계는 질문하지 않고 직접 확인한다.
- **실수 시나리오 (판단이 필요한 작업만)**: 결과가 정해진 절차가 아니라 판단에 달린 작업이면 범위 잠금 아래에 `실수 시나리오: <틀리기 쉬운 단계> → <틀린 결과> / <그렇게 판단하기 쉬운 이유>` 한 줄을 쓰고 그 함정을 피해 진행한다. 절차 작업은 쓰지 않고, 답변에는 반복하지 않는다.
- **완전성 게이트**: 범위에는 "관련 파일"이 아니라 파일 목록 전수를 쓴다. Argon은 적힌 범위만 수행하므로, `grep`으로 호출처·사용처를 먼저 세고 그 수를 범위에 적는다.
- **계획 승인 게이트 (`ulw-plan` / 대규모 설계 요청 시)**: 사용자가 명시적으로 계획 검토를 요청했거나 비가역적 아키텍처 변경(DB 마이그레이션, 공용 API 파괴 등)인 경우, 수정할 파일 목록과 검증 명령을 간결히 제시해 승인받은 뒤 즉시 실행한다. 이때 세션 사고 수준을 HIGH로 올려 달라고 한 번 요청한다(서브에이전트에서는 설정 불가).

---

## Step 2. 실행 라우팅 (Direct vs. Budgeted Fan-Out)

작업 규모와 파일 결합도에 따라 가장 가벼운 경로를 즉시 선택한다:

| 작업 형태 | 실행 경로 | 모델 및 규칙 |
|---|---|---|
| **단일~2개 파일 / 순차 의존 작업** | 메인 에이전트 직접 수행 (`replace_file_content`, `write_to_file`, `run_command`) | 서브에이전트 위임 오버헤드 금지 |
| **3개 이상 독립 모듈·파일·검증 레인** | 단일 `invoke_subagent` 호출로 병렬 팬아웃 (`Subagents` 배열), 레인 수 ≤ 예산 | 탐색·초안·포맷 레인 `flash`, 구현·검증 레인 `inherit` |
| **고위험 코드(스키마·동시성·보안·인증)** | 구현 후 `references/dual-verify.md`의 교차 가족 판정 레인 | 세션을 Claude 5.5로 전환해 판정 1레인 |
| **쿼터 비상시 단순 반복/포맷팅** | `invoke_subagent` 폴백 | `Model: "flash_lite"` |

### 병렬 서브에이전트 프롬프트 규약

병렬 워커를 띄울 때는 파일 소유권이 겹치지 않도록 분할(`references/swarm-sync.md`)하고, 각 워커 프롬프트에 아래 계약을 그대로 전달한다:

```javascript
invoke_subagent({
  Subagents: [
    {
      TypeName: "self",
      Role: "Module A Implementation",
      Model: "inherit",
      Prompt: [
        "목표: <구체적 목표>",
        "완료 조건: <실행할 테스트 명령과 통과 기준>",
        "범위: <담당 파일 전수 — 외부 파일 수정 금지, 동일 기능 중복 구현 금지>",
        "종료 조건: 같은 도구 호출 3회 반복 / 도구 호출 40회 초과 / 진척 없는 턴 2회 / 시간 예산 초과 → 즉시 UNKNOWN 반환",
        "시간 예산: 20분",
        "근거 순서: 로컬 파일·로그·테스트 출력 → 저장소 문서 → 웹(검색 ≤8회). 로컬에서 답이 나오면 웹을 열지 않는다",
        "반환 형식: ≤40줄 — 결과·실행 명령·관찰 출력·미해결 항목만. 계획 재진술 금지",
        "쓰기 규칙: 100줄 이하 청크로 쓰고, 쓴 뒤 해당 구간을 다시 읽어 확인"
      ].join("\n")
    }
  ],
  toolAction: "Module A 구현 서브에이전트 호출",
  toolSummary: "Module A 구현"
})
```

- 서브에이전트 호출 후에는 폴링 루프를 돌지 않고 즉시 독립 작업을 수행하거나 턴을 종료해 Reactive Wakeup을 기다린다.
- `UNKNOWN`이나 실패로 돌아온 레인은 같은 프롬프트로 1회만 재시도한다. 두 번째도 실패하면 `미해결`로 기록하고 합성에서 제외한다. 루프에 빠진 레인을 기다리느라 런을 열어 두지 않는다.
- 워커 보고서가 40줄을 넘으면 요약하지 말고 처음 40줄만 저널에 남긴다. 긴 보고는 계약 위반이며 다음 웨이브 프롬프트에 "반환 형식" 줄을 다시 강조한다.

---

## Step 3. 도메인 스킬 & 전술 레퍼런스 연동

작업 성격에 따라 `lazyargon` 및 `lazyargon-workspace`의 전문 스킬을 결합한다:

- **엄격한 구현 / 250줄 상한**: `programming` (`skills/programming/SKILL.md`)
- **근본 원인 디버깅 / 3가설 반증**: `debugging` (`skills/debugging/SKILL.md`), `references/hypothesis-tree.md`
- **AST 구조 개편 / 슬롭 제거**: `refactor`, `ast-grep`, `remove-ai-slops`
- **UI/UX/AX & 시각 검증**: `frontend`, `visual-qa`, `diagram-design`, `logo-design`
- **고위험 변경 시 심화 검증 레퍼런스 및 v2.0 엔진**:
  - 아키텍처 경계 감사: `references/arch-guard.md`
  - 간헐적 테스트 격리: `references/flaky-guard.md`
  - 보안/동시성/경계 2중 검증 + 교차 가족 판정: `references/dual-verify.md`
  - 전체 레포지토리 토폴로지 조사: `references/repo-survey.md`
  - 문제 재정의(`/office-hours`)·프로덕션 결함/OWASP 감사(`/review`)·브라우저 루프(`/qa`): `references/gstack-gates.md`
  - 변경 파일 기준 역방향 임포트 테스트 선별: `node scripts/codegraph.mjs tests --changed`

---

## Step 4. 실측 검증 게이트 (Evidence-Bound Verification)

완료 선언 전 반드시 Step 1의 **완료 조건** 명령을 실제로 실행하고 출력을 확인한다. **테스트 통과는 완료의 필요조건이지 충분조건이 아니다.**

1. **행동 검증 (`gf-qa-behavioral-verification`)**: 정적 코드 읽기로 통과를 주장하지 않는다. 테스트 스위트(`pytest`, `npm test`, `cargo test`, `go test`)와 엣지/실패 경로를 실제 실행한다. 시각 표면이 있으면 실제 브라우저(375 / 768 / 1280px)를 연다. Argon은 스스로 브라우저를 열지 않는다.
2. **수식·참조 무결성 (`gf-qa-computed-outputs`)**: 금액, 세액, 해시, ID, 링크, 카운트가 포함된 산출물은 계산식을 재검산한다. 모델이 센 글자 수·줄 수는 측정값이 아니다.
3. **산출물 일관성 및 형태 불변성 (`gf-qa-artifact-consistency` & `Deliverable Shape Invariant`)**: 매니페스트(`plugin.json`, `package.json`), 미러 파일, 설정 파일 간 드리프트가 없는지 확인하고 쓴 파일은 전부 다시 열어 본다. 산출물의 구조(시트·열 이름·순서·섹션·JSON 키)는 전적으로 요청에 속한다 — 검토 편의를 핑계로 설명용 열, 중간 유도 과정, 수식 문자열(요청값이 아닌 미계산 식), 미요청 요약 박스·배지를 산출물 안에 삽입하지 않는다(`google-research/harness2`).
4. **채택 심사 및 레버 비용 계층 (`Adoption Screen` & `KEEP_BASE`)**: 공개 테스트를 통과한 변경도 (a) 스테일 데이터·캐시 가정, (b) 비공개 내부 API·구현 세부 의존, (c) 범위 밖 파일 수정, (d) 요청 30줄짜리를 수백 줄로 부풀림 중 하나에 해당하면 기각한다. 에이전트 하네스(규칙·스킬·훅) 자체를 개선할 때는 실행 궤적(trajectory) 근거가 없으면 수정하지 않고 `KEEP_BASE`를 유지하며, 수정이 필요할 때는 Always-on 텍스트 대신 **`SKILL`(온디맨드 절차) → `SCRIPT`(결정론적 연산) → `SUBAGENT`(큰 입력·작은 답 조사) → `HOOK`(툴 루프 내부 강제 검증) → `ALWAYS-ON TEXT`(최후 수단, 추가 시 기존 문장 절삭)** 순서를 따른다.
5. **임시 아티팩트 정리 (Scrub)**: 검증용 스크린샷(`verify_*.png`, `page_*.png`), 일회성 보조 스크립트, Headless 브라우저 임시 프로필(`os.tmpdir()` 하위 `edge_prof*` 등), `__pycache__`가 작업 폴더에 남지 않도록 완료 전 정리한다.
6. **3단계 증거 보고**: 최종 보고에는 실행한 명령어와 관찰된 출력(`PASS` 수, `git status`/`git diff --stat`)을 명시한다. 보고는 20줄 이내.
