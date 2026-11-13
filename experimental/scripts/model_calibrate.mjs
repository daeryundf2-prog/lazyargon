#!/usr/bin/env node
/**
 * model_calibrate.mjs — OMH MODEL_OPTI.md + kimi-code/zcode model calibrator
 * CLI:
 *   node scripts/model_calibrate.mjs [--model <name>] [--compact] [--json]
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SHARED_PREAMBLE_MAX_BYTES = 2770;

export const MODEL_PRESETS = {
	"gemini-4-argon": {
		aliases: ["argon", "gemini-4", "inherit"],
		guidance:
			"범용 기본 주력으로서 코딩·디버깅·UI·포렌식·법률·한국어 윤문을 수행하라. 200줄·18KB 이하는 원샷 작성 후 재열람하고 초과 시에만 100줄 이하 청크(#1255)·규칙 24KB(#1254)·run_command 단독 호출(#1249)을 준수하라. 다중 파일 워커는 Edit-Only로 두고 부모가 통합 검증하라.",
	},
	"gemini-4-carbon": {
		aliases: ["carbon", "gemini-4-carbon-medium", "gemini-4-carbon-high"],
		guidance:
			"사이버방어·바이너리 리버싱·익스플로잇 전문가 레인으로서 Argon 안전 필터 오탐 우려 보안 작업을 네이티브로 수행하라(반복 차단 시에만 Claude 5.5 폴백). 다중 파일 워커는 Edit-Only 후 부모가 통합 검증하라.",
	},
	"gemini-3.8-flash": {
		aliases: ["flash", "flash_lite", "gemini-3.8"],
		guidance:
			"오케스트레이션에서 전면 폐기됨(browser 포함 전 레인 inherit 일원화). 주력 쿼터 0% 고갈 비상 폴백(flash_lite) 외 호출을 금지하며 비상 시에도 실제 관찰 출력만 반환하라.",
	},
	"claude-5.5": {
		aliases: ["opus", "sonnet", "claude-opus-5.5", "claude-sonnet-5.5", "claude"],
		guidance:
			"swarm 핀 고정(claude-opus-5-5-medium) 읽기 전용 교차 가족 감사관(dual-verify Pass 3) 및 안전 필터 폴백 전용으로 동작하라. 파일 직접 수정·커밋과 요청 범위 밖 코드 비대화(+79%)를 금지하라.",
	},
	"gpt-6": {
		aliases: ["astra", "codex", "gpt-6-codex"],
		guidance:
			"로컬 레포 규약(AGENTS.md·테스트·린트)을 먼저 확인하고 범위 잠금 내에서만 편집하라. 명시적 테스트·검증 실행 증거를 확보하기 전에는 절대 조기 종료하지 마라.",
	},
	"kimi-k3": {
		aliases: ["kimi-code", "kimi"],
		guidance:
			"세션 도중 effort 파라미터나 상단 시스템 프롬프트를 변경해 프리픽스 캐시를 파괴하지 마라. 저엔트로피 기계적 편집 단계에서의 과분석 루프를 억제하고 즉시 도구를 실행하라.",
	},
	"glm-5": {
		aliases: ["zcode", "glm"],
		guidance:
			"턴 간 인터리브드 추론(Interleaved Thinking) 문맥을 보존하여 다단계 디버깅 일관성을 유지하라. 장문 컨텍스트 후반부 툴콜 포맷 열화를 막기 위해 단문 명령과 소형 청크 편집 규율을 지켜라.",
	},
};

export function resolveModelKey(raw = "gemini-4-argon") {
	const norm = String(raw || "gemini-4-argon").trim().toLowerCase();
	if (MODEL_PRESETS[norm]) return norm;
	for (const [key, spec] of Object.entries(MODEL_PRESETS)) {
		if (spec.aliases.includes(norm)) return key;
	}
	return "gemini-4-argon";
}

export function calibrateModel({ model = "gemini-4-argon", compact = false } = {}) {
	const resolved = resolveModelKey(model);
	const rawGuidance = MODEL_PRESETS[resolved].guidance;
	const text = compact ? `[MODEL_CALIBRATE:${resolved}] ${rawGuidance}` : `## Model Calibration (${resolved})\n${rawGuidance}`;
	const capped = Buffer.byteLength(text, "utf8") <= SHARED_PREAMBLE_MAX_BYTES ? text : Buffer.from(text, "utf8").subarray(0, SHARED_PREAMBLE_MAX_BYTES).toString("utf8");
	const byteLength = Buffer.byteLength(capped, "utf8");
	return {
		schema: "model_calibration/v1",
		model: resolved,
		byte_length: byteLength,
		max_bytes: SHARED_PREAMBLE_MAX_BYTES,
		guidance: capped,
	};
}

function parseCli(argv) {
	const opts = { model: process.env.LAZYARGON_MODEL || "gemini-4-argon", compact: false, json: false };
	for (let i = 0; i < argv.length; i += 1) {
		const a = argv[i];
		if (a === "--model" && argv[i + 1]) opts.model = argv[++i];
		else if (a === "--compact") opts.compact = true;
		else if (a === "--json") opts.json = true;
	}
	return opts;
}

if (resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1] || "")) {
	const opts = parseCli(process.argv.slice(2));
	const res = calibrateModel(opts);
	if (opts.json) {
		const out = JSON.stringify(res);
		process.stdout.write(`${out}\n`);
	} else {
		process.stdout.write(`${res.guidance}\n`);
	}
}
