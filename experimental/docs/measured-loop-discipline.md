---
name: measured-loop-discipline
description: "karpathy/autoresearch 및 OMH 기반 불변 평가기(Immutable Harness) 실측 최적화 루프 규율."
---

# Measured Loop Discipline (`autoresearch_loop.mjs`)

코드·알고리즘·프롬프트·파이프라인의 정량 지표(지연 시간, 처리량, 메모리, 정확도, 토큰 바이트)를 반복 개선할 때 적용하는 실측 최적화 프로토콜이다. `karpathy/autoresearch`의 단일 파일 실험 원장과 OMH의 불변 하네스 규율을 결합해 보상 해킹(Reward Hacking)과 컨텍스트 오염을 차단한다.

---

## 1. 4대 핵심 불변식 (Core Invariants)

1. **불변 평가기 잠금 (Immutable Evaluation Harness)**: 루프 시작(`init`) 시점에 평가 스크립트(`--eval-script`)의 SHA-256 해시를 `.lazyargon/experiment-lock.json`(`harness_mutable: false`)에 고정한다. 실험 도중 평가 스크립트가 단 1바이트라도 수정되면 `step`은 즉시 `ABORT_MUTATED_HARNESS`(exit 2)로 중단한다.
2. **이진 채택 판정 (Binary Keep / Discard)**: 직전 최고 기록(`best_metric`) 대비 엄격한 개선(`direction=min`이면 감소, `direction=max`이면 증가)이 실측된 경우에만 `KEEP`으로 판정해 기준점을 갱신한다. 동일하거나 악화된 변경은 예외 없이 `DISCARD`하고 즉시 `git checkout`으로 되돌린다.
3. **단일 줄 로그 위생 (1-Line Log Hygiene)**: 평가 실행의 방대한 표준 출력은 파일로 리다이렉트하고, 에이전트 컨텍스트에는 `.lazyargon/experiment-ledger.tsv`의 1줄 요약(`summary_line`)만 남긴다.
4. **4단 아이디어 사다리 (4-Rung Idea Ladder)**: 연속 기각(`stall_count`)이 누적될 때마다 탐색 반경을 단계적으로 전환한다.

---

## 2. 표준 실행 워크플로

```bash
# 1. 평가기 해시 잠금 및 TSV 원장 초기화
node scripts/autoresearch_loop.mjs init \
  --ledger .lazyargon/experiment-ledger.tsv \
  --eval-script scripts/bench_eval.mjs \
  --direction min

# 2. 가설 적용 후 평가 실행 및 원장 기록
node scripts/autoresearch_loop.mjs step \
  --ledger .lazyargon/experiment-ledger.tsv \
  --metric 42.15 \
  --hypothesis "hoist regex compilation outside inner loop"

# 3. 현재 실험 상태 및 최근 5회 이력 조회
node scripts/autoresearch_loop.mjs status \
  --ledger .lazyargon/experiment-ledger.tsv
```

---

## 3. 정체 횟수별 4단 아이디어 사다리

| 연속 기각 (`stall_count`) | 단계 (`rung`) | 처방 행동 (`advice`) |
| :--- | :--- | :--- |
| `1` | `Rung 1 (Local Parameter/Constant Tuning)` | 인터페이스 변경 없이 임계값·배치 크기·캐시 상수를 조정한다. |
| `2` | `Rung 2 (Data Structure / Representation Swap)` | 선형 스캔을 해시/인덱스 조회로 교체하거나 불변값을 사전 계산한다. |
| `3` | `Rung 3 (Algorithmic / Pipeline Simplification)` | 중복 패스를 제거하거나 단계(stage)를 병합해 연산 복잡도를 낮춘다. |
| `4+` | `Rung 4 (Orthogonal Architecture Pivot / Stop)` | 3회 이상 연속 실패 시 근본 가정을 재검토하거나 루프를 종료한다. |
