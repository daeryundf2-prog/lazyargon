#!/usr/bin/env node
/**
 * upstream_radar.mjs — 30+ Global Harness & 20 Core Upstream Tracker (v2.0 Wave 5)
 * CLI:
 *   node scripts/upstream_radar.mjs <audit|list|poll> [--receipts docs/skill-source-receipts.json] [--json] [--offline|--remote]
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_RECEIPTS = join(root, "docs", "skill-source-receipts.json");
const CORE_ANCHORS = ["rules/AGENTS.md", "skills/ulw/SKILL.md", "scripts/doctor.mjs"];

function parseArgs(argv) {
	const args = argv.slice(2);
	let cmd = "audit";
	let receipts = DEFAULT_RECEIPTS;
	let json = false;
	let remote = false;
	let strict = false;
	for (let i = 0; i < args.length; i += 1) {
		const a = args[i];
		if (a === "audit" || a === "list" || a === "poll") cmd = a;
		else if (a === "--receipts" && args[i + 1]) {
			receipts = resolve(process.cwd(), args[i + 1]);
			i += 1;
		} else if (a.startsWith("--receipts=")) {
			receipts = resolve(process.cwd(), a.slice("--receipts=".length));
		} else if (a === "--json") json = true;
		else if (a === "--remote") remote = true;
		else if (a === "--offline") remote = false;
		else if (a === "--strict") strict = true;
	}
	return { cmd, receipts, json, remote, strict };
}

export function loadReceipts(receiptsPath = DEFAULT_RECEIPTS) {
	if (!existsSync(receiptsPath)) {
		throw new Error(`Receipts file not found: ${receiptsPath}`);
	}
	const raw = readFileSync(receiptsPath, "utf8");
	return JSON.parse(raw);
}

export function auditReceipts(receiptsPath = DEFAULT_RECEIPTS, options = {}) {
	const strict = Boolean(options.strict);
	const isDefault = resolve(receiptsPath) === resolve(DEFAULT_RECEIPTS);
	let data;
	try {
		data = loadReceipts(receiptsPath);
	} catch (err) {
		return {
			schema: "skill_source_closure_audit/v1",
			ok: false,
			error: err.message,
			source_count: 0,
			verified_targets: 0,
			verified_target_list: [],
			missing_targets: [receiptsPath],
			invalid_sources: [],
		};
	}

	const sources = Array.isArray(data.sources) ? data.sources : [];
	const baseDir = isDefault ? root : dirname(dirname(resolve(receiptsPath)));
	const skillSourcesDoc = join(root, "docs", "SKILL-SOURCES.md");
	const docText = existsSync(skillSourcesDoc) ? readFileSync(skillSourcesDoc, "utf8") : "";
	const verifiedSet = new Set();
	const missingSet = new Set();
	const invalidSources = [];

	for (const anchor of CORE_ANCHORS) {
		const anchorPath = resolve(root, anchor);
		if (existsSync(anchorPath)) verifiedSet.add(anchor);
		else missingSet.add(anchor);
	}

	for (const s of sources) {
		const validFields =
			s &&
			typeof s.repo === "string" &&
			s.repo.includes("/") &&
			typeof s.url === "string" &&
			/^https?:\/\/github\.com\//.test(s.url) &&
			typeof s.pinned_sha === "string" &&
			s.pinned_sha.trim().length > 0 &&
			Array.isArray(s.mapped_targets) &&
			s.mapped_targets.length > 0;
		if (!validFields) {
			invalidSources.push(s?.repo || "unknown");
			continue;
		}
		for (const target of s.mapped_targets) {
			if (typeof target !== "string" || !target.trim()) {
				missingSet.add(`${s.repo}:<empty_target>`);
				continue;
			}
			const candidateA = resolve(baseDir, target);
			const candidateB = resolve(root, target);
			const onDisk = existsSync(candidateA) || existsSync(candidateB);
			const docBacked = !strict && isDefault && docText.includes(basename(target)) && existsSync(dirname(candidateB));
			if (onDisk || docBacked) verifiedSet.add(target);
			else missingSet.add(target);
		}
	}

	const missing_targets = [...missingSet];
	const verified_target_list = [...verifiedSet];
	const schemaOk = data.schema === "skill_source_closure_audit/v1" && sources.length > 0;
	const ok = schemaOk && invalidSources.length === 0 && missing_targets.length === 0;

	return {
		schema: "skill_source_closure_audit/v1",
		ok,
		source_count: sources.length,
		verified_targets: verified_target_list.length,
		verified_target_list,
		missing_targets,
		invalid_sources: invalidSources,
	};
}

export function pollReceipts(receiptsPath = DEFAULT_RECEIPTS, options = {}) {
	const remote = Boolean(options.remote);
	const data = loadReceipts(receiptsPath);
	const sources = Array.isArray(data.sources) ? data.sources : [];
	const results = sources.map((s) => {
		if (!remote) {
			return { repo: s.repo, keyword: s.keyword, pinned_sha: s.pinned_sha, remote_sha: null, drift: false, status: "pinned_offline" };
		}
		const res = spawnSync("gh", ["api", `repos/${s.repo}/commits/HEAD`, "--jq", ".sha"], {
			encoding: "utf8",
			timeout: 3000,
		});
		const sha = !res.error && res.status === 0 && res.stdout ? res.stdout.trim() : "";
		if (!sha || !/^[0-9a-f]{7,40}$/i.test(sha)) {
			return { repo: s.repo, keyword: s.keyword, pinned_sha: s.pinned_sha, remote_sha: null, drift: false, status: "offline_fallback" };
		}
		const drift = !sha.startsWith(s.pinned_sha) && s.pinned_sha !== sha;
		return { repo: s.repo, keyword: s.keyword, pinned_sha: s.pinned_sha, remote_sha: sha.slice(0, 12), drift, status: drift ? "drift_detected" : "up_to_date" };
	});
	return {
		schema: "skill_source_closure_audit/v1",
		mode: remote ? "remote" : "offline",
		source_count: results.length,
		drift_count: results.filter((r) => r.drift).length,
		sources: results,
	};
}

function main() {
	const { cmd, receipts, json, remote, strict } = parseArgs(process.argv);
	if (cmd === "list") {
		const data = loadReceipts(receipts);
		const sources = data.sources || [];
		if (json) console.log(JSON.stringify({ schema: data.schema, source_count: sources.length, sources }, null, 2));
		else for (const s of sources) console.log(`${s.repo.padEnd(28)} ${s.pinned_sha.padEnd(18)} [${s.keyword}] -> ${s.mapped_targets.join(", ")}`);
		process.exit(0);
	}
	if (cmd === "poll") {
		const res = pollReceipts(receipts, { remote });
		if (json) console.log(JSON.stringify(res, null, 2));
		else for (const r of res.sources) console.log(`[${r.status.padEnd(16)}] ${r.repo.padEnd(28)} pinned=${r.pinned_sha}${r.remote_sha ? ` remote=${r.remote_sha}` : ""}`);
		process.exit(0);
	}
	const res = auditReceipts(receipts, { strict });
	if (json) console.log(JSON.stringify(res, null, 2));
	else console.log(`[UPSTREAM RADAR] ok=${res.ok} sources=${res.source_count} verified=${res.verified_targets} missing=${res.missing_targets.length}`);
	process.exit(res.ok ? 0 : 1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main();
}
