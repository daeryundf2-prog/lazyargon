// claims-gate.mjs - the mechanical Phase 4b lock: a claim ledger (claims.jsonl) and a source
// registry (sources.jsonl) in $SESSION_DIR go in; verified-claims.json comes out only when every
// claim was classified without a procedure violation. High-risk claims must quote the source
// verbatim, and the quote is matched against a stored snapshot of the page, not a model summary.
// Rules adapted from insane-research (fivetaku, MIT) validate_ledger.py v2.10; code is our own.
// Plain Node ESM, node: builtins and siblings only.

import { createHash } from "node:crypto"

export const QUOTE_MIN = 20
export const QUOTE_MAX = 300
export const DEFAULT_MAX_UNRESOLVED_RATIO = 0.5

/** Source types that count as a primary source (the standard, statute, filing, first-party doc). */
export const PRIMARY_SOURCE_TYPES = new Set([
	"standards_document", "official_docs", "official_blog", "official_release", "government", "law_db",
	"court_decision", "statute", "filing", "sec_filing", "peer_reviewed", "primary", "repository", "api", "dataset",
])

/** Hosting domains whose subdomain is its own organization. */
const HOSTING_SUFFIXES = new Set([
	"github.io", "gitlab.io", "readthedocs.io", "netlify.app", "vercel.app", "pages.dev", "web.app",
	"blogspot.com", "wordpress.com", "substack.com", "hashnode.dev", "notion.site", "tistory.com", "velog.io",
])

/** Two-label public suffixes (co.kr and friends): keep three labels for the organization. */
const SECOND_LEVEL_SUFFIXES = new Set([
	"co.kr", "go.kr", "or.kr", "ac.kr", "re.kr", "pe.kr", "ne.kr", "co.uk", "ac.uk", "gov.uk", "org.uk",
	"co.jp", "or.jp", "ne.jp", "go.jp", "ac.jp", "com.au", "org.au", "com.cn", "com.br", "com.tw",
])

/** Sections where unresolved or refuted claims may be named: the annex and the synthesis Gaps, Contradictions and Debate record sections. */
export const ANNEX_HEADING = /(미확정|미해결|반증|부록|빈틈|충돌|토론|unresolved|refuted|annex|appendix|gaps|contradictions|debate)/i
const CLAIM_CITE = /\[(C\d+)\]/g

function hostOf(src) {
	const explicit = String(src.domain ?? "").trim().toLowerCase()
	if (explicit) return explicit
	try {
		return new URL(String(src.url ?? "")).hostname.toLowerCase().replace(/^www\./, "")
	} catch {
		return ""
	}
}

/** Independence unit: the organization, so docs.python.org and peps.python.org count once. */
export function orgOf(src) {
	const explicit = String(src.org ?? "").trim().toLowerCase()
	if (explicit) return explicit
	const parts = hostOf(src).split(".").filter(Boolean)
	if (parts.length <= 2) return parts.join(".")
	const tail2 = parts.slice(-2).join(".")
	if (HOSTING_SUFFIXES.has(tail2) || SECOND_LEVEL_SUFFIXES.has(tail2)) return parts.slice(-3).join(".")
	return tail2
}

const QUOTE_MAP = { "\u201c": '"', "\u201d": '"', "\u201e": '"', "\u2018": "'", "\u2019": "'", "\u201a": "'" }

/** Exact-match normalization: NFKC, straight quotes, markdown links and marks dropped, one space, lower case. No fuzzy matching. */
export function normText(value) {
	return String(value ?? "")
		.normalize("NFKC")
		.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
		.replace(/[\u201c\u201d\u201e\u2018\u2019\u201a]/g, (ch) => QUOTE_MAP[ch])
		.replace(/[*`#]/g, "")
		.replace(/\s+/g, " ")
		.trim()
		.toLowerCase()
}

export function sha256(data) {
	return createHash("sha256").update(data).digest("hex")
}

function parseCounter(claim) {
	const counter = claim.counter_search
	if (counter && typeof counter === "object" && !Array.isArray(counter)) {
		const urls = Array.isArray(counter.urls) ? counter.urls.filter((u) => typeof u === "string" && u.trim()) : []
		return { query: String(counter.query ?? "").trim(), urls, legacy: false }
	}
	return { query: "", urls: [], legacy: typeof counter === "string" && counter.trim() !== "" }
}

/**
 * Check every evidence quote of a claim against its source snapshot.
 * @param {object} claim
 * @param {(sourceId: string) => { body: string | null, why?: string }} snapshotText
 */
export function checkEvidence(claim, snapshotText) {
	const reasons = []
	const matched = []
	for (const ev of claim.evidence ?? []) {
		const quote = String(ev.quote ?? "").trim()
		if (quote.length < QUOTE_MIN || quote.length > QUOTE_MAX) {
			reasons.push(`${ev.source_id}: quote is ${quote.length} chars (allowed ${QUOTE_MIN}-${QUOTE_MAX})`)
			continue
		}
		const { body, why } = snapshotText(ev.source_id)
		if (body === null) reasons.push(why)
		else if (body.includes(normText(quote))) matched.push(normText(quote))
		else reasons.push(`${ev.source_id}: quote not in the source - "${quote.slice(0, 40)}..."`)
	}
	return { matched, reasons }
}

/** A numeric claim needs a matched quote that carries one of the claim's numbers (two or more digits). */
export function numericValueMissing(claim, matched) {
	if (String(claim.claim_type ?? "").toLowerCase() !== "numeric") return false
	const values = new Set(String(claim.text ?? "").normalize("NFKC").match(/\d{2,}/g) ?? [])
	if (values.size === 0) return false
	return !matched.some((q) => [...values].some((v) => q.includes(v)))
}

/**
 * Classify one claim. Returns { status: verified|unresolved|refuted, reason, violation }.
 * violation = a fixable procedure gap (missing counter-search, missing proof); it fails the gate.
 */
export function classifyClaim(claim, sourcesById, snapshotText) {
	const resolved = (claim.source_ids ?? []).map((id) => sourcesById.get(id)).filter(Boolean)
	const high = claim.risk === "high"
	const type = String(claim.claim_type ?? "").toLowerCase()
	if (claim.counter_refuted) return { status: "refuted", reason: "counter-search found a stronger refutation", violation: false }

	if (type === "executable") {
		const verdict = String(claim.execution_proof?.verdict ?? "").toLowerCase()
		if (!verdict) return { status: "unresolved", reason: "executable claim without execution_proof", violation: true }
		if (verdict === "refuted") return { status: "refuted", reason: "execution refuted it", violation: false }
		if (verdict === "partial") return { status: "unresolved", reason: "execution only partly confirmed it", violation: false }
		if (verdict !== "confirmed") return { status: "unresolved", reason: `unknown execution verdict "${verdict}"`, violation: true }
		if (claim.conflicting) return { status: "unresolved", reason: "sources conflict", violation: false }
		return { status: "verified", reason: "execution confirmed it", violation: false }
	}

	const counter = parseCounter(claim)
	if (high && counter.legacy) return { status: "unresolved", reason: "counter_search must be {query, urls, summary}, not free text", violation: true }
	if (high && !counter.query) return { status: "unresolved", reason: "high-risk claim without a counter-search", violation: true }

	const primary = resolved.some((s) => PRIMARY_SOURCE_TYPES.has(String(s.type ?? "").toLowerCase()))
	const exception = String(claim.single_source_exception ?? "").trim()
	const orgs = new Set(resolved.map(orgOf).filter(Boolean))
	const surfaces = new Set(resolved.map((s) => String(s.type ?? "").toLowerCase()).filter(Boolean))
	const singleOk = exception !== "" && primary
	if (orgs.size < 2 && !singleOk) return { status: "unresolved", reason: `${orgs.size} independent organization(s) < 2`, violation: false }
	if (claim.conflicting) return { status: "unresolved", reason: "sources conflict", violation: false }
	if (!high) return { status: "verified", reason: "ok", violation: false }

	if (!primary) return { status: "unresolved", reason: "high-risk claim without a primary source type", violation: false }
	if (surfaces.size < 2 && !singleOk) return { status: "unresolved", reason: `${surfaces.size} source surface type(s) < 2`, violation: false }
	if (!(claim.evidence ?? []).length) return { status: "unresolved", reason: "high-risk claim without a verbatim quote", violation: false }
	const { matched, reasons } = checkEvidence(claim, snapshotText)
	if (reasons.length) return { status: "unresolved", reason: reasons.join("; "), violation: false }
	if (numericValueMissing(claim, matched)) return { status: "unresolved", reason: "numeric claim: no matched quote contains its value", violation: false }
	return { status: "verified", reason: exception ? `ok (single-source exception: ${exception})` : "ok", violation: false }
}

/** Structural errors that make the ledger untrustworthy (exit 2 in the CLI). */
export function ledgerErrors(claims, sources) {
	const errors = []
	const sourcesById = new Map()
	const urls = new Set()
	for (const [i, s] of sources.entries()) {
		if (!s.id) errors.push(`sources.jsonl[${i}]: missing id`)
		else if (sourcesById.has(s.id)) errors.push(`sources.jsonl: duplicate id ${s.id}`)
		else sourcesById.set(s.id, s)
		if (s.url) urls.add(String(s.url))
	}
	const seen = new Set()
	for (const [i, c] of claims.entries()) {
		const label = c.id ?? `claims.jsonl[${i}]`
		if (!c.id || !c.text || !Array.isArray(c.source_ids)) errors.push(`${label}: id, text and source_ids are required`)
		if (c.id && seen.has(c.id)) errors.push(`claims.jsonl: duplicate id ${c.id}`)
		seen.add(c.id)
		if (c.id && !/^C\d+$/.test(c.id)) errors.push(`${label}: claim ids are C<number> so the report can cite them as [C<number>]`)
		for (const id of c.source_ids ?? []) if (!sourcesById.has(id)) errors.push(`${label}: source ${id} is not in sources.jsonl`)
		for (const ev of c.evidence ?? []) {
			if (!(c.source_ids ?? []).includes(ev.source_id)) errors.push(`${label}: evidence source ${ev.source_id} is not one of its source_ids`)
		}
		for (const url of parseCounter(c).urls) if (!urls.has(url)) errors.push(`${label}: counter-search url ${url} is not registered in sources.jsonl`)
	}
	return { errors, sourcesById }
}

/**
 * Run the gate over parsed records.
 * @param {{ claims: object[], sources: object[], readSnapshot: (src: object) => { body: string | null, why?: string }, maxUnresolvedRatio?: number }} input
 */
export function runGate({ claims, sources, readSnapshot, maxUnresolvedRatio = DEFAULT_MAX_UNRESOLVED_RATIO }) {
	const { errors, sourcesById } = ledgerErrors(claims, sources)
	if (errors.length) return { exitCode: 2, errors, records: [], violations: [], verified: [], warnings: [] }
	const cache = new Map()
	const snapshotText = (id) => {
		if (!cache.has(id)) cache.set(id, readSnapshot(sourcesById.get(id)))
		return cache.get(id)
	}
	const records = claims.map((c) => ({ id: c.id, ...classifyClaim(c, sourcesById, snapshotText) }))
	const violations = records.filter((r) => r.violation).map((r) => `${r.id}: ${r.reason}`)
	const verified = claims.filter((c, i) => records[i].status === "verified")
	const unresolved = records.filter((r) => r.status === "unresolved").length
	const ratio = records.length ? unresolved / records.length : 0
	const warnings = ratio > maxUnresolvedRatio ? [`unresolved ratio ${ratio.toFixed(2)} > ${maxUnresolvedRatio}: the evidence base is thin`] : []
	return { exitCode: violations.length ? 1 : 0, errors, records, violations, verified, warnings, unresolvedRatio: ratio }
}

function annexMask(lines) {
	const mask = []
	let annexLevel = 0
	for (const line of lines) {
		const heading = /^(#{1,6})\s+(.*)$/.exec(line)
		if (heading) {
			const level = heading[1].length
			if (annexLevel && level <= annexLevel) annexLevel = 0
			if (!annexLevel && ANNEX_HEADING.test(heading[2])) annexLevel = level
		}
		mask.push(annexLevel > 0)
	}
	return mask
}

/**
 * Check a Markdown report against the gate result: [C<n>] citations of unresolved or refuted
 * claims are allowed only under an annex heading, unknown ids are ghosts, and the report must
 * cite at least one verified claim (and minCoverage of them when set).
 */
export function verifyReport(reportText, records, { minCoverage = 0 } = {}) {
	const status = new Map(records.map((r) => [r.id, r.status]))
	const lines = String(reportText).split(/\r?\n/)
	const mask = annexMask(lines)
	const defects = []
	const citedVerified = new Set()
	lines.forEach((line, i) => {
		for (const m of line.matchAll(CLAIM_CITE)) {
			const id = m[1]
			const st = status.get(id)
			if (!st) defects.push({ code: "ghost_claim", message: `line ${i + 1}: [${id}] is not in the ledger` })
			else if (st === "verified") citedVerified.add(id)
			else if (!mask[i]) defects.push({ code: "unverified_claim_in_body", message: `line ${i + 1}: [${id}] is ${st}; cite it only under an Unresolved/Refuted annex` })
		}
	})
	const totalVerified = records.filter((r) => r.status === "verified").length
	if (citedVerified.size === 0) defects.push({ code: "no_verified_citation", message: totalVerified ? "the report cites no verified claim" : "no claim passed the gate; the report has nothing verified to rest on" })
	const coverage = totalVerified ? citedVerified.size / totalVerified : 0
	if (minCoverage > 0 && coverage < minCoverage) defects.push({ code: "low_coverage", message: `verified coverage ${coverage.toFixed(2)} < ${minCoverage}` })
	return { exitCode: defects.length ? 1 : 0, defects, coverage, citedVerified: [...citedVerified].sort() }
}
