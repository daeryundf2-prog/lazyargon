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
			"100줄·20KB 이하 청크로 분할 기록(#1255)하고 규칙 파일 합계 24KB 상한(#1254)을 준수하라. 승인 필요 도구(run_command 등)는 한 턴에 단독 호출(#1249)하며, 상단 정적 컨텍스트를 고정해 6,144토큰 프리픽스 캐시(95% 할인)를 유지하라. 모든 쓰기 직후 파일을 재열람해 무결성을 검증하라.",
	},
	"gemini-3.8-flash": {
		aliases: ["flash", "flash_lite", "gemini-3.8"],
		guidance:
			"파싱·표 정리·초안 스캐폴딩 작업에 집중하고 위임된 write_scope 외부 파일은 절대 수정하지 마라. 추측성 조기 완료 선언을 금지하며 실행 명령과 실제 관찰 출력을 함께 반환하라.",
	},
	"claude-5.5": {
		aliases: ["opus", "sonnet", "claude-opus-5.5", "claude-sonnet-5.5", "claude"],
		guidance:
			"교차 가족 최종 판정(dual-verify) 및 보안·메모리 안전 필터 폴백 레인 전용으로 동작하라. 요청 범위 밖의 주변 코드 과잉 리팩터링과 방어적 추상화 도입을 억제하라.",
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
