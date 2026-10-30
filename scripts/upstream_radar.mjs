#!/usr/bin/env node
/**
 * upstream_radar.mjs — upstream receipt audit + real HEAD SHA tracker
 * CLI:
 *   node scripts/upstream_radar.mjs <audit|list|poll> [--receipts docs/skill-source-receipts.json] [--json] [--offline|--remote] [--write]
 * poll --remote --write records observed_head_sha/observed_at; pins change only by human decision.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";
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
	let write = false;
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
		else if (a === "--write") write = true;
	}
	return { cmd, receipts, json, remote, write };
}

export function loadReceipts(receiptsPath = DEFAULT_RECEIPTS) {
	if (!existsSync(receiptsPath)) {
		throw new Error(`Receipts file not found: ${receiptsPath}`);
	}
	const raw = readFileSync(receiptsPath, "utf8");
	return JSON.parse(raw);
}

// A pin is honest only when it is a full commit SHA marked verified, or explicitly null + unverified.
export function pinIsHonest(s) {
	if (s?.status === "verified") return typeof s.pinned_sha === "string" && /^[0-9a-f]{40}$/.test(s.pinned_sha);
	if (s?.status === "unverified") return s.pinned_sha === null;
	return false;
}

// Offline audit checks pin shape only; remote audit also asks GitHub whether each verified pin exists.
function pinExistsOnGitHub(s) {
	const res = spawnSync("gh", ["api", `repos/${s.repo}/commits/${s.pinned_sha}`, "--jq", ".sha"], { encoding: "utf8", timeout: 15000 });
	return !res.error && res.status === 0 && (res.stdout || "").trim() === s.pinned_sha;
}

export function auditReceipts(receiptsPath = DEFAULT_RECEIPTS, options = {}) {
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
			pinIsHonest(s) &&
			Array.isArray(s.mapped_targets) &&
			s.mapped_targets.length > 0;
		if (!validFields) {
			invalidSources.push(s?.repo || "unknown");
			continue;
		}
		if (options.remote && s.status === "verified" && !pinExistsOnGitHub(s)) {
			invalidSources.push(`${s.repo}:pin_not_on_github`);
			continue;
		}
		for (const target of s.mapped_targets) {
			if (typeof target !== "string" || !target.trim()) {
				missingSet.add(`${s.repo}:<empty_target>`);
				continue;
			}
			const candidateA = resolve(baseDir, target);
			const candidateB = resolve(root, target);
			const pluginsDir = dirname(root);
			if (isAbsolute(target) || !candidateB.startsWith(pluginsDir + sep)) {
				missingSet.add(`${s.repo}:<outside_plugins_dir:${target}>`);
				continue;
			}
			const onDisk = existsSync(candidateA) || existsSync(candidateB);
			if (onDisk) verifiedSet.add(target);
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
		pinned_verified: sources.filter((s) => s?.status === "verified").length,
		pinned_unverified: sources.filter((s) => s?.status === "unverified").length,
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
			timeout: 15000,
		});
		const sha = !res.error && res.status === 0 && res.stdout ? res.stdout.trim() : "";
		if (!/^[0-9a-f]{40}$/.test(sha)) {
			const error = (res.error?.message || res.stderr || res.stdout || "no sha").trim().slice(0, 200);
			return { repo: s.repo, keyword: s.keyword, pinned_sha: s.pinned_sha, remote_sha: null, drift: false, status: "unreachable", error };
		}
		if (!s.pinned_sha) {
			return { repo: s.repo, keyword: s.keyword, pinned_sha: null, remote_sha: sha, drift: false, status: "unpinned" };
		}
		const drift = s.pinned_sha !== sha;
		return { repo: s.repo, keyword: s.keyword, pinned_sha: s.pinned_sha, remote_sha: sha, drift, status: drift ? "drift_detected" : "up_to_date" };
	});
	if (remote && options.write) {
		const observedAt = new Date().toISOString();
		const byRepo = new Map(results.map((r) => [r.repo, r]));
		for (const s of sources) {
			const r = byRepo.get(s.repo);
			if (r?.remote_sha) {
				s.observed_head_sha = r.remote_sha;
				s.observed_at = observedAt;
			}
		}
		const tmp = `${receiptsPath}.${process.pid}.tmp`;
		writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`);
		renameSync(tmp, receiptsPath);
	}
	return {
		schema: "skill_source_closure_audit/v1",
		mode: remote ? "remote" : "offline",
		source_count: results.length,
		drift_count: results.filter((r) => r.drift).length,
		unreachable_count: results.filter((r) => r.status === "unreachable").length,
		sources: results,
	};
}

function main() {
	const { cmd, receipts, json, remote, write } = parseArgs(process.argv);
	if (cmd === "list") {
		const data = loadReceipts(receipts);
		const sources = data.sources || [];
		if (json) console.log(JSON.stringify({ schema: data.schema, source_count: sources.length, sources }, null, 2));
		else for (const s of sources) console.log(`${s.repo.padEnd(28)} ${String(s.pinned_sha ?? "unverified").padEnd(40)} [${s.keyword}] -> ${s.mapped_targets.join(", ")}`);
		process.exit(0);
	}
	if (cmd === "poll") {
		const res = pollReceipts(receipts, { remote, write });
		if (json) console.log(JSON.stringify(res, null, 2));
		else for (const r of res.sources) console.log(`[${r.status.padEnd(16)}] ${r.repo.padEnd(28)} pinned=${r.pinned_sha ?? "unverified"}${r.remote_sha ? ` remote=${r.remote_sha}` : ""}`);
		process.exit(res.unreachable_count ? 1 : 0);
	}
	const res = auditReceipts(receipts, { remote });
	if (json) console.log(JSON.stringify(res, null, 2));
	else console.log(`[UPSTREAM RADAR] ok=${res.ok} sources=${res.source_count} verified=${res.verified_targets} missing=${res.missing_targets.length}`);
	process.exit(res.ok ? 0 : 1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main();
}
