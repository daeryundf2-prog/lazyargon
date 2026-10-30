# DAP Session Plan & 3-Strike Architecture Escalation (`omp` × `obra/superpowers`)

추측성 `printf`·`console.log` 삽입 후 반복 재빌드하는 루프를 금지한다. 런타임 크래시, 데드락, 비동기 상태 오염, 메모리 변조는 반드시 `debugger_session_plan/v1` 스키마로 관찰 계획을 먼저 수립한 뒤 DAP(Debug Adapter Protocol) 어댑터를 연결해 단판에 검증한다.

## 1. 언어·런타임별 DAP 어댑터 매트릭스

| 언어 / 런타임 | DAP 어댑터 명령 | 연결 방식 | 핵심 용도 |
| :--- | :--- | :--- | :--- |
| Rust / C / C++ (macOS·Linux) | `lldb-dap` 또는 `codelldb` | stdio / TCP | 세그폴트, 소유권·라이프타임, 하드웨어 워치포인트 |
| C / C++ / Rust (Linux ELF) | `gdb -i=dap` | stdio | 코어 덤프 역추적, 레지스터·메모리 맵 검사 |
| Python 3.11+ | `python3 -m debugpy --listen 127.0.0.1:5678 --wait-for-client` | TCP attach | 비동기 태스크 경합, 텐서/데이터프레임 형상 오차 |
| Go 1.22+ | `dlv dap --listen=127.0.0.1:38697` | TCP | 고루틴 누수, 채널 데드락, 슬라이스 재할당 |
| Node.js / TypeScript | `node --inspect-brk=127.0.0.1:9229` | WebSocket / CDP | 이벤트 루프 고갈, 클로저 캡처 오염, Promise 미결 |

## 2. `debugger_session_plan/v1` 사전 설계 규율

디버거를 띄우기 전에 가설 3개 이상과 정확히 대응하는 브레이크포인트·워치포인트·평가지표를 JSON으로 선언한다.

```json
{
  "schema": "debugger_session_plan/v1",
  "target_binary_or_entry": "node --inspect-brk=127.0.0.1:9229 src/scheduler.mjs",
  "adapter": "node --inspect-brk",
  "hypotheses": [
    {
      "id": "H1",
      "claim": "웨이브 2 전환 시 write_scope 교집합 배열이 초기화되지 않고 누적됨",
      "breakpoint": {
        "file": "src/scheduler.mjs",
        "line": 84,
        "condition": "waveIndex >= 1 && overlap.length > 0"
      },
      "watchpoints": ["nodeState.writeScope", "activeLocks.size"],
      "frame_expressions": ["JSON.stringify(overlap)", "waveIndex"]
    }
  ],
  "stop_on_entry": false,
  "max_steps": 25
}
```

### 관찰 우선 원칙 (No Speculative Printf Rebuilds)

1. **조건부 브레이크포인트(`condition`) 우선**: 수천 번 호출되는 루프 안에 무조건 멈추지 말고, 위반 조건식(`idx >= len || ptr == null`)이 참일 때만 정지시킨다.
2. **데이터 워치포인트(`watchpoints`) 활용**: 어느 함수가 상태를 덮어쓰는지 모를 때는 변수/주소의 쓰기 워치포인트를 걸어 가해 호출 스택(Call Stack)을 즉시 포착한다.
3. **프레임 변수 일괄 덤프(`frame_expressions`)**: 정지 시점의 지역 변수와 인자를 한 번에 평가해 가설 참/거짓을 판정하고 세션을 즉시 종료(`disconnect`/`terminate`)한다.
4. **무재빌드 원칙**: 소스 코드를 더럽히는 디버그 출력문 추가 및 재컴파일은 DAP 연결이 불가능한 샌드박스에서만 최후 수단으로 허용한다.

## 3. `obra/superpowers` 3-Strike Architecture Escalation

국소 패치가 연속 실패할 때 같은 자리에서 조건문만 덧대는 행위를 차단한다.

| 스트라이크 | 실패 징후 | 강제 행동 규율 |
| :--- | :--- | :--- |
| Strike 1 | 1차 수정 후 동일 테스트 실패 또는 인접 회귀 발생 | DAP 세션 출력으로 근본 원인(Root Cause) 재검증 후 2차 최소 수정 |
| Strike 2 | 2차 수정 후에도 불변식 위반·타이밍 버그 재발 | 즉시 편집 중단. 직교 관점의 읽기 전용 검증 레인(Oracle) 호출 |
| Strike 3 | 3회 연속 패치 실패 또는 수정 범위가 3개 이상 파일로 확산 | **Architecture Escalation**: 국소 버그가 아닌 설계 결함으로 판정 |

### Strike 3 발동 시 필수 절차

```text
[3-STRIKE ESCALATION]
1. 모든 임시 패치 롤백 (git checkout -- <files>)
2. 실패한 3개 가설과 DAP 관찰 로그를 .lazyargon/pins.md 에 고정
3. 상태 소유권·경계 계약(Boundary Contract)·동시성 모델을 재설계하거나 사용자에게 구조 변경 승인 요청
```

- 3-Strike에 도달한 모듈은 방어적 `try/catch`나 `if (!x) return`으로 증상을 숨기지 않는다.
- 반드시 실패 재현 단위 테스트를 먼저 고정한 뒤 아키텍처 단위의 해법을 적용한다.
