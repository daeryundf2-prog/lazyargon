# GStack Execution Gates (`garrytan/gstack` 증류: `/office-hours` · `/review` · `/qa`)

복잡한 기능 구현이나 리팩터링에서 요구사항 오해, CI만 통과하는 프로덕션 장애, 반응형 레이아웃 붕괴를 원천 차단하기 위해 `garrytan/gstack`의 3대 품질 게이트(`/office-hours`, `/review`, `/qa`)를 `/ulw` 파이프라인에 결합한다.

## 1. `/office-hours` — 구현 전 6대 질문 문제 재정의 및 스펙 잠금

코드를 한 줄이라도 쓰기 전에 모호한 요청을 아래 6대 질문으로 해부하여 `.lazyargon/ulw-scope.md`에 잠근다.

| 번호 | 질문 축 | 검증 포인트 |
| :--- | :--- | :--- |
| Q1 | **Pain & Reality** | 사용자가 겪는 실제 병목은 무엇이며, 지금 당장 고치지 않으면 어떤 실패가 발생하는가? |
| Q2 | **Status Quo & Workaround** | 현재 코드베이스나 운영 절차는 이 문제를 어떻게 우회하고 있는가? (`grep`·기존 스크립트 우선 확인) |
| Q3 | **Smallest Wedge** | 전체 비전을 다 만들지 않고도 가치를 입증하는 최소 단면(1~3개 파일, 250줄 이하)은 무엇인가? |
| Q4 | **Non-Goals (Scope Cut)** | 이번 턴에 **절대 건드리지 않을 파일과 기능**은 무엇인가? |
| Q5 | **Failure Modes** | 타임아웃, 빈 입력, 권한 거부, 대용량 입력에서 어떻게 안전하게 실패(Fail-Closed)할 것인가? |
| Q6 | **Observable Verification** | 완료를 증명할 단 하나의 결정적 명령과 기대 출력(Exit Code·스키마·뷰포트 캡처)은 무엇인가? |

## 2. `/review` — CI 통과 프로덕션 결함 및 OWASP + STRIDE 위협 매트릭스

테스트가 통과했더라도 실제 운영 환경에서 터지는 구조적 결함과 보안 위협을 교차 점검한다.

### 2.1 CI-Pass Production Defect Checklist

- **N+1 및 무제한 메모리 적재**: 루프 내 동기 I/O·쿼리 호출, 상한 없는 `readFileSync` (반드시 바이트 캡 적용).
- **비원자적 상태 변이**: 부분 실패 시 파일·DB가 반쯤 쓰인 채 남는 현상 (임시 파일 기록 후 rename 또는 트랜잭션 강제).
- **조용한 예외 삼킴**: 빈 `catch {}` 블록으로 인한 무음 장애 (오탐 방지 훅 외에는 명시적 에러 전파).
- **경쟁 조건 (TOCTOU)**: 파일 존재 확인 후 열기 사이의 경합, 병렬 워커 간 동일 파일 동시 쓰기(`write_scope` 분리 필수).

### 2.2 OWASP + STRIDE 위협 매트릭스

| STRIDE 위협 | OWASP 대응 범주 | 필수 코드 방어선 |
| :--- | :--- | :--- |
| **S**poofing | A07 Identification & Auth Failures | 호스트 보고 `세션 모델`·서명 토큰만 신뢰, 클라이언트 헤더 위조 차단 |
| **T**ampering | A08 Software & Data Integrity | `write_chunk_guard.mjs`·`json_schema_guard.mjs`·SHA-256 해시 대조 |
| **R**epudiation | A09 Security Logging Failures | 모든 검증 판정에 실행 명령·시각·감사 수신증(`coverage_audit.mjs`) 기록 |
| **I**nformation Disclosure | A01 Broken Access Control | API 키·토큰·민감 원문 로그 출력 금지, 상대방 PII 플레이스홀더 유지 |
| **D**enial of Service | A04 Insecure Design | 외부 프로세스 `timeout` 필수, 스트림 읽기 데드라인(1,500ms) 강제 |
| **E**levation of Privilege | A03 Injection (`Command`/`Path`) | 쉘 문자열 보간 대신 `spawnSync(cmd, args)` 배열 인자 사용, 경로 탈출(`..`) 차단 |

## 3. `/qa` — 375 / 768 / 1280px 실브라우저 검증 루프

UI·문서·시각 산출물은 정적 코드 검사를 넘어 실제 브라우저 엔진(Playwright)에서 3개 표준 뷰포트를 순회하며 검증한다.

```text
[QA VIEWPORT LOOP]
1. Mobile First (375x812)   → 가로 스크롤 오버플로, 한글 단어 쪼개짐(word-break: keep-all), 터치 타겟(>=44px) 확인
2. Tablet (768x1024)        → 그리드 2열 전환 시 카드 높이 불균형, 배지·화자 열 줄바꿈 깨짐 확인
3. Desktop / A4 (1280x900)  → 표 열 정렬, 차트/SVG 텍스트 겹침, A4 인쇄 시 페이지 경계 절단 여부 확인
```

- 콘솔 에러(`pageerror`, `console.error`)와 깨진 리소스(`status >= 400`)가 0건이어야 `/qa` 게이트를 통과한다.
- 결함 발견 시 스크린샷 좌표와 DOM 선택자를 특정해 최소 수정한 뒤 3개 뷰포트를 재검증한다.

## 4. GStack Gate Receipt (`gstack_gate_receipt/v1`)

3대 게이트를 통과한 뒤에는 아래 JSON 영수증 형식으로 검증 결과를 기록한다.

```json
{
  "schema": "gstack_gate_receipt/v1",
  "office_hours_locked": true,
  "scope_file": ".lazyargon/ulw-scope.md",
  "review_matrix": { "ci_defects": 0, "owasp_stride_findings": 0 },
  "qa_viewports": [
    { "viewport": "375x812", "overflow_x": false, "console_errors": 0 },
    { "viewport": "768x1024", "overflow_x": false, "console_errors": 0 },
    { "viewport": "1280x900", "overflow_x": false, "console_errors": 0 }
  ]
}
```
