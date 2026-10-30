# experimental/

v2.0 "apex" 작업에서 만들었지만 실제 Antigravity 세션에서 쓰인 기록이 없는 엔진을 모아 둔 곳이다(2026-10-30 격리, 태그 `apex-v2-snapshot`).

- 규칙(`rules/`), 훅(`hooks.json`), `session_start.mjs`, `bin/lazyargon`에서는 참조하지 않는다.
- 테스트는 `test/`에 남아 있어 회귀는 계속 잡는다.
- 다시 쓰려면 실제 세션의 실패 사례(brain/transcript 경로)를 근거로 하나씩 `scripts/`로 되돌린다.

| 스크립트 | 원래 의도 |
| :--- | :--- |
| `scripts/dag_ulw.mjs` | 서브에이전트 DAG와 write_scope 충돌 검사 |
| `scripts/lazy_memory.py`, `scripts/lazy_rag.py` | SQLite FTS5 메모리와 리콜 팩 |
| `scripts/autoresearch_loop.mjs` | 단일 지표 실험 루프 (`docs/measured-loop-discipline.md`) |
| `scripts/lazy_tui.mjs` | 상태 대시보드 |
| `scripts/model_calibrate.mjs` | 모델별 세션 시작 가이드 주입 |
| `scripts/lazy_slop_cleaner.mjs` | 규칙/코드 슬롭 스캔 |
