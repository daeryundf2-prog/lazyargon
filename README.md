# LazyArgon (`v1.0.0`)

Gemini 4 Argon (`Model: "inherit"`) 전용 자율 실행(`/ulw`)·소프트웨어 엔지니어링·디자인 통합 플러그인.

## 포함 스킬 (17종)
- **`ulw`**: `/ulw` 단일 진입점 자율 실행 (3줄 범위 잠금 `목표 / 완료 조건 / 범위` + Argon 4 병렬 팬아웃 + 실측 검증)
- **`ulw-research`**: 병렬 서브에이전트 기반 심층 리서치 및 교차 검증
- **`programming`**: 엄격한 타입, TDD, 단일 파일 250줄 상한 엔지니어링
- **`debugging`**: 가설-반증 기반 런타임 디버깅
- **`refactor`** / **`ast-grep`** / **`remove-ai-slops`** / **`git-master`**: AST 기반 리팩토링, AI 코드 슬롭 10종 제거, 원자적 Git 관리
- **`frontend`** / **`visual-qa`** / **`image-prompt`**: UI/UX/AX 디자인 시스템 및 멀티모달 시각 QA
- **`diagram-design`**: 39종 에디토리얼 다이어그램 디자인 (`lazydiagram` 통합)
- **`logo-design`**: 정밀 SVG 로고 및 브랜드 아이덴티티 디자인 (`logo-design-skill` 통합)
- **`data-scientist`**: DuckDB / Polars 기반 데이터 분석
- **`gf-qa-behavioral-verification`** / **`gf-qa-computed-outputs`** / **`gf-qa-artifact-consistency`**: 런타임 행동·수식·산출물 일관성 검증
