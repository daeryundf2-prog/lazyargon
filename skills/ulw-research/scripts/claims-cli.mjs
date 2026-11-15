// claims-cli.mjs - report-tools `claims snapshot | gate | report`, file IO around claims-gate.mjs.
// Files under $SESSION_DIR: claims.jsonl, sources.jsonl, sources/snapshots/<id>.txt,
// claim-status.json (always), verified-claims.json (gate passed) or gate-failed.json (gate failed).

import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { extname, join, relative, resolve } from "node:path"

import { DEFAULT_MAX_UNRESOLVED_RATIO, normText, runGate, sha256, verifyReport } from "./claims-gate.mjs"
import { CliError, parseArgs, readJsonFile, writeJsonAtomic } from "./cli-support.mjs"
import { parseHtml, proseText } from "./html-lite.mjs"

export const SNAPSHOT_TIMEOUT_MS = 20_000

function sessionDir(flags) {
	const dir = flags["session-dir"] ?? process.env.SESSION_DIR
	if (!dir) throw new CliError("--session-dir is required (or set SESSION_DIR)")
	return resolve(dir)
}

export function readJsonl(path) {
	let text
	try {
		text = readFileSync(path, "utf8")
	} catch (error) {
		throw new CliError(`cannot read ${path}: ${error.code ?? error.message}`)
	}
	return text.split(/\r?\n/).flatMap((line, i) => {
		if (!line.trim()) return []
		try {
			return [JSON.parse(line)]
		} catch (error) {
			throw new CliError(`${path}:${i + 1} is not valid JSON: ${error.message}`)
		}
	})
}

function writeJsonl(path, records) {
	const temp = `${path}.${process.pid}.tmp`
	writeFileSync(temp, records.map((r) => JSON.stringify(r)).join("\n") + "\n")
	copyFileSync(temp, path)
	rmSync(temp, { force: true })
}

function toText(raw, kind) {
	return kind === "html" ? proseText(parseHtml(raw)) : raw
}

/** Fetch a URL as text. HTML becomes its prose text; PDFs and other binaries are refused. */
export async function fetchSourceText(url, fetchImpl = fetch) {
	const response = await fetchImpl(url, { signal: AbortSignal.timeout(SNAPSHOT_TIMEOUT_MS), redirect: "follow" })
	const type = response.headers.get("content-type") ?? ""
	if (!response.ok) {
		await response.body?.cancel()
		return { status: "blocked", why: `HTTP ${response.status}` }
	}
	if (!/text\/|json|xml/i.test(type)) {
		await response.body?.cancel()
		return { status: "unsupported", why: `content-type ${type || "unknown"}; save the text yourself and pass --from <id>=<file>` }
	}
	const raw = await response.text()
	return { status: "ok", text: toText(raw, /html/i.test(type) ? "html" : "text") }
}

function storeSnapshot(dir, src, text, now) {
	const snapDir = join(dir, "sources", "snapshots")
	mkdirSync(snapDir, { recursive: true })
	const path = join(snapDir, `${src.id}.txt`)
	writeFileSync(path, text)
	src.snapshot = { path: relative(dir, path), sha256: sha256(Buffer.from(text)), status: "ok", fetched_at: now }
}

/** Snapshot the sources that high-risk evidence quotes point at (all evidence with --all). */
export async function runSnapshot(argv, { fetchImpl = fetch, now = () => new Date().toISOString() } = {}) {
	const args = parseArgs(argv, { repeatable: ["from"], booleans: ["all", "refresh"] })
	const dir = sessionDir(args.flags)
	const sourcesPath = join(dir, "sources.jsonl")
	const claims = readJsonl(join(dir, "claims.jsonl"))
	const sources = readJsonl(sourcesPath)
	const byId = new Map(sources.map((s) => [s.id, s]))
	const results = []
	for (const spec of args.flags.from ?? []) {
		const eq = spec.indexOf("=")
		const src = byId.get(spec.slice(0, eq))
		if (eq < 1 || !src) throw new CliError(`--from needs <source id>=<file> with a registered id: ${spec}`)
		const file = resolve(spec.slice(eq + 1))
		const raw = readFileSync(file, "utf8")
		storeSnapshot(dir, src, toText(raw, /\.html?$/i.test(extname(file)) ? "html" : "text"), now())
		src.snapshot.from_file = file
		results.push({ id: src.id, status: "ok", from: file })
	}
	const wanted = new Set()
	for (const c of claims) {
		if (!args.flags.all && c.risk !== "high") continue
		for (const ev of c.evidence ?? []) wanted.add(ev.source_id)
	}
	for (const id of wanted) {
		const src = byId.get(id)
		if (!src || results.some((r) => r.id === id)) continue
		if (src.snapshot?.status === "ok" && !args.flags.refresh && existsSync(join(dir, src.snapshot.path))) continue
		let got
		try {
			got = await fetchSourceText(src.url, fetchImpl)
		} catch (error) {
			got = { status: "error", why: error.message }
		}
		if (got.status === "ok") storeSnapshot(dir, src, got.text, now())
		else src.snapshot = { status: got.status, why: got.why, fetched_at: now() }
		results.push({ id, status: got.status, ...(got.why ? { why: got.why } : {}) })
	}
	writeJsonl(sourcesPath, sources)
	const failed = results.filter((r) => r.status !== "ok")
	return {
		json: { snapshots: results },
		summary: `claims snapshot: ${results.length - failed.length} ok, ${failed.length} not stored`,
		exitCode: failed.length ? 1 : 0,
	}
}

function snapshotReader(dir) {
	return (src) => {
		const snap = src?.snapshot ?? {}
		const path = snap.path ? join(dir, snap.path) : ""
		if (snap.status !== "ok" || !path || !existsSync(path)) return { body: null, why: `${src?.id}: no stored snapshot (status ${snap.status ?? "missing"}); run claims snapshot` }
		const raw = readFileSync(path)
		if (snap.sha256 && sha256(raw) !== snap.sha256) return { body: null, why: `${src.id}: snapshot changed after capture (sha256 mismatch)` }
		return { body: normText(raw.toString("utf8")) }
	}
}

export function runClaimGate(argv) {
	const args = parseArgs(argv)
	const dir = sessionDir(args.flags)
	const ratio = args.flags["max-unresolved-ratio"] === undefined ? DEFAULT_MAX_UNRESOLVED_RATIO : Number(args.flags["max-unresolved-ratio"])
	const claims = readJsonl(join(dir, "claims.jsonl"))
	const sources = readJsonl(join(dir, "sources.jsonl"))
	const result = runGate({ claims, sources, readSnapshot: snapshotReader(dir), maxUnresolvedRatio: ratio })
	const verifiedPath = join(dir, "verified-claims.json")
	const failedPath = join(dir, "gate-failed.json")
	const signature = sha256(readFileSync(join(dir, "claims.jsonl")))
	if (result.exitCode === 0) {
		writeJsonAtomic(join(dir, "claim-status.json"), { claims_sha256: signature, records: result.records, unresolved_ratio: result.unresolvedRatio })
		writeJsonAtomic(verifiedPath, { claims_sha256: signature, claims: result.verified })
		rmSync(failedPath, { force: true })
	} else {
		// The lock: a failed gate leaves no allowlist behind, not even a stale one.
		rmSync(verifiedPath, { force: true })
		if (result.records.length) writeJsonAtomic(join(dir, "claim-status.json"), { claims_sha256: signature, records: result.records, unresolved_ratio: result.unresolvedRatio })
		writeJsonAtomic(failedPath, { exit_code: result.exitCode, errors: result.errors, violations: result.violations, next_step: "fix claims.jsonl or sources.jsonl and rerun claims gate" })
	}
	if (result.exitCode === 2) throw new CliError(`claims gate: the ledger is malformed (gate-failed.json written):\n  ${result.errors.join("\n  ")}`)
	const counts = Object.fromEntries(["verified", "unresolved", "refuted"].map((s) => [s, result.records.filter((r) => r.status === s).length]))
	return {
		json: { ...counts, violations: result.violations, warnings: result.warnings, records: result.records },
		summary: `claims gate: ${result.exitCode === 0 ? "pass" : "FAIL"} (${counts.verified} verified, ${counts.unresolved} unresolved, ${counts.refuted} refuted)${result.warnings.length ? ` WARN ${result.warnings[0]}` : ""}`,
		exitCode: result.exitCode,
	}
}

export function runClaimReport(argv) {
	const args = parseArgs(argv)
	const dir = sessionDir(args.flags)
	const report = readFileSync(resolve(args.required("report")), "utf8")
	if (existsSync(join(dir, "gate-failed.json")) || !existsSync(join(dir, "verified-claims.json"))) {
		return { json: { defects: [{ code: "gate_not_passed", message: "claims gate has not passed; nothing may be asserted yet" }] }, summary: "claims report: FAIL (gate not passed)", exitCode: 1 }
	}
	const status = readJsonFile(join(dir, "claim-status.json"))
	const minCoverage = args.flags["min-coverage"] === undefined ? 0 : Number(args.flags["min-coverage"])
	const result = verifyReport(report, status.records, { minCoverage })
	return { json: result, summary: `claims report: ${result.exitCode === 0 ? "pass" : "FAIL"} (${result.defects.length} defects, coverage ${result.coverage.toFixed(2)})`, exitCode: result.exitCode }
}

export async function runClaims(argv) {
	const [sub, ...rest] = argv
	if (sub === "snapshot") return runSnapshot(rest)
	if (sub === "gate") return runClaimGate(rest)
	if (sub === "report") return runClaimReport(rest)
	throw new CliError("usage: claims <snapshot | gate | report> --session-dir <dir> [...]")
}
