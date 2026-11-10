// flash_mode.mjs — 세션 모델에 따른 모드 선택과 효율 계층 안내문 (lazyargon).
// 정적 규칙(rules/AGENTS.md, 12KB 예산)은 건드리지 않고 SessionStart 의 동적 블록으로만 주입한다.
// 모델명은 호스트가 보고한 값만 쓴다(추정 금지): gemini-3.8-flash-* 는 flash, gemini-4-argon-* 와 gemini-4-carbon-* 는 argon(Argon 모드 규칙 공유), 그 외는 other.

export function modeFor(model) {
	const m = String(model ?? "").toLowerCase();
	if (/^gemini-3\.8-flash(?!-lite)/.test(m)) return "flash";
	if (/^gemini-4-(argon|carbon)/.test(m)) return "argon";
	return "other";
}

const ROUTING = [
	"### 하위 작업 라우팅 (공통)",
	"- 쉬운 하위 작업(탐색·파싱·초안·서식·단순 치환)은 `flash`, 구현·리팩터·검증·설계는 `inherit`, 쿼터 비상시에만 `flash_lite`.",
	"- 하위 작업에도 같은 규칙을 적용한다: 큰 파일은 골격으로 찾고, 수정 전에는 함수 전체를 읽는다.",
];

const SKELETON = [
	"### 큰 파일 읽기 (공통)",
	"- 300줄 넘는 파일에서 위치를 찾을 때는 `node scripts/skeleton.mjs <파일> [--find <이름>]` 로 선언 목록(이름·줄 범위)만 본다. 골격은 **검색 전용**이다.",
	"- 함수·클래스를 수정하기 전에는 반드시 `node scripts/skeleton.mjs <파일> --body <이름>` 또는 해당 줄 범위 전체를 읽는다. 골격만 보고 수정하지 않는다.",
];

const THINKING = [
	"### 사고 예산 (3.8 Flash 전용)",
	"- 세션 모델이 3.8 Flash 이므로 작업별로 `--effort`/사고 수준을 조절한다: 서식·단순 치환·조회는 low, 일반 구현은 medium, 원인 불명 버그·설계는 high.",
	"- 막히면 먼저 근거(로그·테스트 출력)를 더 모으고, 같은 시도를 반복하지 않는다.",
];

const ARGON_NOTE = ["- Argon·Carbon 은 사고 수준이 세션 단위이므로 작업별 조절을 시도하지 않는다."];

export function flashModeContext(model) {
	const mode = modeFor(model);
	if (mode === "other") return "";
	const head = mode === "flash" ? "## 효율 모드: Flash (gemini-3.8-flash)" : /^gemini-4-carbon/i.test(String(model)) ? "## 효율 모드: Argon (Carbon 공유)" : "## 효율 모드: Argon";
	const parts = [head, "", ...ROUTING, "", ...SKELETON];
	parts.push("", ...(mode === "flash" ? THINKING : ARGON_NOTE));
	return parts.join("\n");
}
