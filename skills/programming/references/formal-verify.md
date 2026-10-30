# Formal Verification Playbook (`@poteto` `pstack` `/create-formal-verification-skill` 증류)

단위 테스트와 퍼징은 유한한 입력 경로만 확인한다. 상태기계 전이, 분산 동시성 프로토콜, 정산·회계 원장 불변식, 포인터/산술 안전성처럼 **단 1건의 반례도 허용되지 않는 핵심 로직**은 `@poteto` `pstack`의 정형 검증(Formal Verification) 워크플로에 따라 수학적 모델 체커와 정리 증명기로 검증한다.

## 1. 대상 도메인별 정형 검증 도구 매트릭스

| 검증 대상 도메인 | 표준 도구 | 실행 명령 | 증명 목표 |
| :--- | :--- | :--- | :--- |
| 분산 상태기계·합의·동시성 | TLA+ (`tlc`) | `tlc Spec.tla -config Spec.cfg -workers auto` | Safety(불변식 유지) · Liveness(기아·데드락 부재) |
| 순수 알고리즘·법칙·정산 수식 | Lean 4 (`lake`) | `lake build && lean --run Verify.lean` | 정리 증명(`theorem`), `sorry` 0건 완전 증명 |
| Rust `unsafe`·비트필드·제로카피 | Kani (`cargo kani`) | `cargo kani --harness proof_ring_buffer` | 패닉·오버플로·UB·경계 밖 메모리 접근 부재 |
| Python 도메인 규칙·제약 해법 | Hypothesis + Z3 | `pytest -k test_ledger_z3` | SMT 제약 충족 가능성(`unsat` 반례 부재) + 속성 기반 반례 탐색 |

## 2. 4단계 정형 검증 루프 (`pstack` Discipline)

1. **불변식 추출 (Invariant Extraction)**: 코드에서 절대 깨지면 안 되는 상태 조건을 자연어와 수식 1~3줄로 먼저 정의한다 (예: `ConservationOfFunds: sum(balances) + fee_pool == initial_supply`).
2. **경량 모델링 (Bounded Specification)**: 전체 애플리케이션이 아니라 핵심 상태 변수와 전이 액션만 추려 최소 모델(`.tla`, `.lean`, `#[kani::proof]`, Z3 수식)로 작성한다.
3. **반례 탐색 (Counterexample Hunting)**: 모델 체커를 실행해 반례 트레이스(Counterexample Trace)가 나오면 모델과 실제 구현 중 어느 쪽이 전제 조건을 누락했는지 대조한다.
4. **코드-명세 동기화 (Spec-to-Code Lock)**: 반례를 막는 가드 조건을 프로덕션 코드에 반영하고, 동일한 반례 입력을 결정적 회귀 테스트로 고정한다.

## 3. 도구별 최소 실행 템플릿

### 3.1 TLA+ 상태기계 모델 체킹 (`tlc`)

```tla
---- MODULE UlwWaveLock ----
EXTENDS Naturals, FiniteSets
VARIABLES activeLanes, completedWaves

TypeOK == activeLanes \in 0..4 /\ completedWaves \in 0..2
SafetyInvariant == activeLanes <= 4
====
```

### 3.2 Rust `cargo kani` 유계 모델 체킹

```rust
#[cfg(kani)]
#[kani::proof]
#[kani::unwind(8)]
fn proof_chunk_bounds() {
    let total: u32 = kani::any();
    let limit: u32 = kani::any();
    kani::assume(limit > 0 && limit <= 20_480);
    kani::assume(total <= 1_048_576);
    let chunks = total.div_ceil(limit);
    assert!(chunks * limit >= total);
}
```

### 3.3 Lean 4 정리 증명 (`sorry` 금지)

```lean
theorem balance_conservation (a b delta : Int) (h : delta <= a) :
    (a - delta) + (b + delta) = a + b := by
  omega
```

### 3.4 Python Z3 + Hypothesis 결합 검증

```python
from hypothesis import given, strategies as st
import z3

def verify_conservation_smt() -> bool:
    a, b, delta = z3.Ints("a b delta")
    s = z3.Solver()
    s.add(a >= 0, b >= 0, delta >= 0, delta <= a)
    s.add((a - delta) + (b + delta) != a + b)
    return s.check() == z3.unsat

@given(st.integers(min_value=0, max_value=10**9), st.integers(min_value=0, max_value=10**6))
def test_transfer_invariant(balance: int, delta: int) -> None:
    if delta <= balance:
        assert (balance - delta) + delta == balance
```

## 4. 완료 게이트 (Verification Receipt)

- 정형 검증을 선언할 때는 실행한 명령(`tlc`, `cargo kani`, `lake build`, `pytest`)과 탐색 상태 수 또는 `unsat` 출력을 그대로 인용한다.
- Lean 4의 `sorry`, Kani의 과도한 `kani::assume(false)`처럼 증명을 우회하는 가짜 통과(Vacuous Truth)는 즉시 실패로 판정한다.
