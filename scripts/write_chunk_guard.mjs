#!/usr/bin/env node
/**
 * write_chunk_guard.mjs — PreToolUse Argon 60s silent-stream cutoff guard
 * Blocks oversized single writes (>24KB or >250 lines by default) before Antigravity
 * hits the 60-second silent-stream cutoff (antigravity-cli #1255).
 * Override via LAZYARGON_MAX_WRITE_BYTES / LAZYARGON_MAX_WRITE_LINES or disable via LAZYARGON_DISABLE_WRITE_CHUNK_GUARD=1.
 */
import { stdin } from "node:process";

const DEFAULT_MAX_BYTES = 24 * 1024;
const DEFAULT_MAX_LINES = 250;

function readStdin(limitMs = 1500) {
	return new Promise((resolve) => {
		if (stdin.isTTY) return resolve("");
		const chunks = [];
		let settled = false;
		const finish = (val) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			stdin.removeAllListeners();
			resolve(val);
		};
		const timer = setTimeout(() => finish(Buffer.concat(chunks).toString("utf8")), limitMs);
		stdin.on("data", (c) => chunks.push(c));
		stdin.on("end", () => finish(Buffer.concat(chunks).toString("utf8")));
		stdin.on("error", () => finish(""));
	});
}

function tryParseJson(text) {
	if (!text || typeof text !== "string") return undefined;
	const t = text.trim();
	if (!t.startsWith("{") && !t.startsWith("[")) return undefined;
	try {
		return JSON.parse(t);
	} catch {
		return undefined;
	}
}

export function extractWriteContent(payload) {
	if (!payload || typeof payload !== "object") return "";
	let args =
		payload.toolCall?.args ??
		payload.toolCall?.arguments ??
		payload.tool_input ??
		payload.input ??
		payload.args ??
		payload;
	if (typeof args === "string") args = tryParseJson(args) || {};
	if (!args || typeof args !== "object") return "";

	const parts = [];
	for (const k of ["CodeContent", "code_content", "ReplacementContent", "replacement_content", "content", "new_str", "new_string", "text"]) {
		if (typeof args[k] === "string" && args[k].length > 0) parts.push(args[k]);
	}
	let chunks = args.ReplacementChunks ?? args.replacement_chunks ?? args.edits;
	if (typeof chunks === "string") chunks = tryParseJson(chunks);
	if (Array.isArray(chunks)) {
		for (const c of chunks) {
			if (!c || typeof c !== "object") continue;
			const piece = c.ReplacementContent ?? c.replacement_content ?? c.new_str ?? c.new_string ?? c.content ?? "";
			if (typeof piece === "string" && piece.length > 0) parts.push(piece);
		}
	}
	return parts.join("\n");
}

function allow() {
	process.stdout.write(`${JSON.stringify({ decision: "allow" })}\n`);
	process.exit(0);
}

function deny(reason) {
	console.error(`[WRITE CHUNK GUARD] BLOCKED: ${reason}`);
	process.stdout.write(`${JSON.stringify({ decision: "deny", reason })}\n`);
	process.exit(1);
}

async function main() {
	if (process.env.LAZYARGON_DISABLE_WRITE_CHUNK_GUARD === "1") allow();
	const raw = process.env.ANTIGRAVITY_TOOL_INPUT || process.env.TOOL_INPUT || (await readStdin(1500));
	const payload = tryParseJson(raw);
	const content = extractWriteContent(payload);
	if (!content) allow();

	const maxBytes = Number.parseInt(process.env.LAZYARGON_MAX_WRITE_BYTES || "", 10) || DEFAULT_MAX_BYTES;
	const maxLines = Number.parseInt(process.env.LAZYARGON_MAX_WRITE_LINES || "", 10) || DEFAULT_MAX_LINES;
	const bytes = Buffer.byteLength(content, "utf8");
	const lines = content.split(/\r?\n/).length;

	if (bytes > maxBytes || lines > maxLines) {
		deny(
			`Argon 60s stream cutoff guard: write payload is ${lines} lines / ${bytes}B (limit: ${maxLines} lines / ${maxBytes}B). Split into chunks <=100 lines and <20KB.`,
		);
	}
	allow();
}

main().catch(() => allow());
