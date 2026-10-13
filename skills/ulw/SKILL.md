---
name: ulw
description: "Unified Argon 4 autonomous execution workflow (/ulw, ultrawork, ulw-plan, mass-ulw, ulw-loop). Locks scope in 3 lines (목표/완료 조건/범위), routes 1-2 file tasks directly or 3+ independent tasks via parallel Argon 4 subagents (Model: inherit), and enforces empirical verification before completion."
---

# ULW — Unified Argon 4 Autonomous Execution (`/ulw`)

단일 진입점(`/ulw`, `ulw`, `ultrawork`, `ulw-plan`, `mass-ulw`, `ulw-loop`)으로 계획·병렬 구현·검증을 끝까지 완수하는 Gemini 4 Argon 전용 자율 실행 프로토콜이다. 불필요한 다단계 상태 파일(`.lazyantigravity/`, 스냅샷, 형식적 역할극)을 생성하지 않고, 3줄 범위 잠금과 실제 실행 증거(`verified`)로만 동작한다.

---

## Step 1. 3줄 범위 잠금 (Scope Lock)

모든 `/ulw` 작업은 첫 도구 호출 직전에 아래 3줄을 먼저 선언하고 작업이 끝날 때까지 이탈하지 않는다:

```text
목표: <한 문장>
완료 조건: <직접 실행할 검증 명령과 기대 결과>
범위: <수정할 파일·디렉토리 / 손대지 않을 경로>
```

- **모호성 게이트**: 요구사항에 치명적 충돌이나 방향 결정을 요하는 모호함이 있을 때만 `ask_question`으로 딱 1회 질문한다. 코드베이스 탐색으로 답을 찾을 수 있는 사실 관계는 질문하지 않고 직접 확인한다.
- **계획 승인 게이트 (`ulw-plan` / 대규모 설계 요청 시)**: 사용자가 명시적으로 계획 검토를 요청했거나 비가역적 아키텍처 변경(DB 마이그레이션, 공용 API 파괴 등)인 경우, 수정할 파일 목록과 검증 명령을 간결히 제시해 승인받은 뒤 즉시 실행한다.

---

## Step 2. 실행 라우팅 (Direct vs. Parallel Argon Fan-Out)

작업 규모와 파일 결합도에 따라 가장 가벼운 경로를 즉시 선택한다:

| 작업 형태 | 실행 경로 | 모델 및 규칙 |
|---|---|---|
| **단일~2개 파일 / 순차 의존 작업** | 메인 에이전트 직접 수행 (`replace_file_content`, `write_to_file`, `run_command`) | 서브에이전트 위임 오버헤드 금지 |
| **3개 이상 독립 모듈·파일·검증 레인** | 단일 `invoke_subagent` 호출로 병렬 팬아웃 (`Subagents` 배열) | `TypeName: "self"`, `Model: "inherit"` (Gemini 4 Argon) 고정 |
| **쿼터 비상시 단순 반복/포맷팅** | `invoke_subagent` 폴백 | `Model: "flash_lite"` (유일한 경량 예외; `"flash"` 사용 금지) |

### 병렬 서브에이전트 프롬프트 규약 (`Model: "inherit"`)

병렬 워커를 띄울 때는 파일 소유권이 겹치지 않도록 분할(`references/swarm-sync.md`)하고, 각 워커 프롬프트에 3줄 계약만 전달한다:

```javascript
invoke_subagent({
  Subagents: [
    {
      TypeName: "self",
      Role: "Module A Implementation",
      Model: "inherit",
      Prompt: "목표: <구체적 목표>\n완료 조건: <실행할 테스트 명령과 통과 기준>\n범위: <담당 파일 목록 (외부 파일 수정 금지)>"
    }
  ]
})
```

- 서브에이전트 호출 후에는 폴링 루프를 돌지 않고 즉시 독립 작업을 수행하거나 턴을 종료해 Reactive Wakeup을 기다린다.

---

## Step 3. 도메인 스킬 & 전술 레퍼런스 연동

작업 성격에 따라 `lazyargon` 및 `lazyargon-workspace`의 전문 스킬을 결합한다:

- **엄격한 구현 / 250줄 상한**: `programming` (`skills/programming/SKILL.md`)
- **근본 원인 디버깅 / 3가설 반증**: `debugging` (`skills/debugging/SKILL.md`), `references/hypothesis-tree.md`
- **AST 구조 개편 / 슬롭 제거**: `refactor`, `ast-grep`, `remove-ai-slops`
- **UI/UX/AX & 시각 검증**: `frontend`, `visual-qa`, `diagram-design`, `logo-design`
- **고위험 변경 시 심화 검증 레퍼런스**:
  - 아키텍처 경계 감사: `references/arch-guard.md`
  - 간헐적 테스트 격리: `references/flaky-guard.md`
  - 보안/동시성/경계 2중 검증: `references/dual-verify.md`
  - 전체 레포지토리 토폴로지 조사: `references/repo-survey.md`

---

## Step 4. 실측 검증 게이트 (Evidence-Bound Verification)

완료 선언 전 반드시 Step 1의 **완료 조건** 명령을 실제로 실행하고 출력을 확인한다:

1. **행동 검증 (`gf-qa-behavioral-verification`)**: 정적 코드 읽기로 통과를 주장하지 않는다. 테스트 스위트(`pytest`, `npm test`, `cargo test`, `go test`)와 엣지/실패 경로를 실제 실행한다.
2. **수식·참조 무결성 (`gf-qa-computed-outputs`)**: 금액, 세액, 해시, ID, 링크, 카운트가 포함된 산출물은 계산식을 재검산한다.
3. **산출물 일관성 (`gf-qa-artifact-consistency`)**: 매니페스트(`plugin.json`, `package.json`), 미러 파일, 설정 파일 간 드리프트가 없는지 확인한다.
4. **3단계 증거 보고**: 최종 보고에는 실행한 명령어와 관찰된 출력(`PASS` 수, `git status`/`git diff --stat`)을 명시한다.
