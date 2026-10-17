# LazyArgon (`v1.1.0`)

Google Antigravity용 자율 실행(`/ulw`)·소프트웨어 엔지니어링·디자인 통합 플러그인. 주 대상은 Gemini 4 Argon이지만, 세션 모델은 호스트가 보고한 값을 따른다(Ultra·Enterprise는 Argon, 그 외 플랜은 Gemini 3.8 Flash 또는 Claude 5.5).

## v1.1.0 — Argon 실사용 보고 반영 (2026-10)

출시 후 2주간의 1차 사용기(HN, Google AI 개발자 포럼, 국내외 블로그·커뮤니티 30여 건, [`docs/argon-field-notes.md`](docs/argon-field-notes.md))에서 반복 확인된 제약을 규칙·스킬·훅에 넣었다.

| 관찰 | 반영 |
|---|---|
| 큰 단일 `write_to_file`(≈1,000줄)이 호스트 60초 컷오프로 유실 | 모든 쓰기 100줄 청크 + 쓴 구간 재열람 (`rules/AGENTS.md`, `ulw`, `frontend`) |
| 컴팩션 뒤 기억에 의존한 편집이 없는 식별자를 만듦 | 컴팩션 후 재열람 규칙 + 범위 잠금 파일 `.lazyargon/ulw-scope.md` 를 `SessionStart`가 재주입 |
| 워커 1개가 Flash의 ~20× 출력 토큰, 5시간 한도 급속 소진 | 팬아웃 전 `예산:` 선언(기본 4레인/2웨이브), 탐색·초안 레인은 `flash`, 판정 레인만 `inherit` |
| 추론 루프·"Model unavailable" 재시도 | 워커 종료 조건(같은 도구 3회·호출 40회·무진척 2턴 → UNKNOWN) + 1회 재시도 후 제외 |
| 테스트 통과 직후 리뷰 종료, 브라우저 미확인 | `gf-qa-behavioral-verification` 5·6단계(실제 렌더 확인, 채택 심사) |
| 터미널·에이전틱 코딩에서 Opus 5.5 열세 | 고위험 코드는 `dual-verify` Pass 3 교차 가족 판정 기본화 |
| 사고(thinking) 블록 경계 누락 | `markdown_structure_guard` `leaked_reasoning_block` 검사 (가드 팩 1.1.0) |
| API 키 모드에서 3.8 Flash로 무음 폴백 | `session_start.mjs`가 호스트 보고 모델명만 주입, 없으면 `unknown` |
| 장황한 산출물, 지어낸 수치 패널 | 디자인 스킬에 카피 밀도 상한·수치 날조 금지 |
| UI 표시와 달리 실제 컨텍스트 상한 256K, 컴팩션 뒤 ID·SHA 날조 (#1245) | `.lazyargon/pins.md`에 식별자 고정, `SessionStart`가 재주입 |
| 예산을 넘은 규칙 파일이 통째로 빠짐 (#1254) | `rules/AGENTS.md` 21.9KB → 10KB, 키워드 표는 `docs/keyword-routing.md`, `doctor.mjs` `rules.budget` |
| 한 턴 다중 도구 호출 시 승인 오배정으로 웨이브 정지 (#1249) | 워커 계약: 승인 도구는 한 턴에 하나 |
| 한 번 차단된 대화는 계속 막힘, 보안 디버깅 차단 | 새 대화에서 범위 잠금으로 재개, 해당 레인만 Claude 5.5 |
| API 키 모드 무음 폴백, 구버전 description 콜론 로딩 실패 | `doctor.mjs` `antigravity.model_provider`·`frontmatter.description_colon` |

## 포함 스킬 (18종)

| 스킬 | 설명 |
|---|---|
| `ulw` | `/ulw` 단일 진입점 자율 실행 (3줄 범위 잠금 + 예산, 티어별 병렬 팬아웃, 실측 검증) |
| `ulw-research` | 예산 안에서 병렬 서브에이전트 웨이브로 심층 리서치 및 교차 검증 |
| `programming` | 엄격한 타입, TDD, 단일 파일 250줄 상한 엔지니어링 |
| `debugging` | 가설-반증 기반 런타임 디버깅 |
| `refactor` | 코드 구조 개선 및 안전한 리팩토링 |
| `ast-grep` | 25개 언어 AST 패턴 검색 및 코드모드 재작성 |
| `remove-ai-slops` | AI 코드 슬롭 10종 병렬 제거 |
| `git-master` | 원자적 커밋, 히스토리 분석, rebase/bisect 관리 |
| `coding-agent-sessions` | 멀티 플랫폼 코딩 에이전트 세션 로그 탐색 및 복구 |
| `frontend` | 시니어 디자이너급 UI/UX/AX 디자인 시스템 |
| `visual-qa` | 멀티모달 시각 QA 및 CJK 조판 정밀 검증 (375px 우선) |
| `image-prompt` | 이미지 생성 프롬프트 컴파일러 및 플레이북 |
| `diagram-design` | 39종 브랜드 에디토리얼 다이어그램 디자인 |
| `logo-design` | 정밀 SVG 로고 및 브랜드 아이덴티티 디자인 |
| `data-scientist` | DuckDB / Polars 상주 커널 기반 데이터 분석 |
| `gf-qa-behavioral-verification` | 런타임 행동 검증, 에러 은폐 차단, 채택 심사 |
| `gf-qa-computed-outputs` | 수식·파생 지표·참조 링크 무결성 검증 |
| `gf-qa-artifact-consistency` | 산출물·미러 트리·매니페스트 일관성 검증 |

## 훅과 스크립트

| 파일 | 역할 |
|---|---|
| `hooks.json` → `scripts/session_start.mjs` | 세션 시작 시 런타임 블록 주입: 세션 모델(호스트 보고값), 범위 잠금, 가드 팩 버전 |
| `hooks.json` → `scripts/markdown_structure_guard.mjs` | 쓰기 직후 마크다운 구조·사고 블록 누출 검사 (workspace 캐노니컬과 동기화) |
| `hooks.json` → `scripts/json_schema_guard.mjs` | JSON 산출물 스키마 검사 |
| `scripts/doctor.mjs` | 읽기 전용 진단: Node/Python, 훅 배선, 스킬 프런트매터, 가드 팩 동기화, 매니페스트 버전 |

## 테스트

```bash
npm test                 # node --test test/*.test.mjs
node scripts/doctor.mjs  # 또는 npm run doctor
python3 tools/smoke_test.py
```
