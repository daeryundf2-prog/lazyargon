import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { runClaimGate, runClaimReport, runSnapshot } from "../skills/ulw-research/scripts/claims-cli.mjs";
import { classifyClaim, normText, orgOf, runGate, verifyReport } from "../skills/ulw-research/scripts/claims-gate.mjs";

const PAGE_A = "<html><body><h1>Notice</h1><p>The fine was raised to 3,000,000 won on 1 March 2026 under Article 12.</p></body></html>";
const PAGE_B = "Statute text: Article 12 sets the fine at 3,000,000 won from 1 March 2026.";

const SOURCES = [
	{ id: "S1", url: "https://www.law.go.kr/statute/12", type: "statute" },
	{ id: "S2", url: "https://news.example.com/fine", type: "news" },
	{ id: "S3", url: "https://news.example.com/counter", type: "news" },
];

function highClaim(overrides = {}) {
	return {
		id: "C1",
		text: "The fine is 3,000,000 won since 1 March 2026.",
		risk: "high",
		claim_type: "numeric",
		source_ids: ["S1", "S2"],
		evidence: [{ source_id: "S1", quote: "Article 12 sets the fine at 3,000,000 won" }],
		counter_search: { query: "fine Article 12 amended 2026", urls: ["https://news.example.com/counter"], summary: "no later change found" },
		...overrides,
	};
}

const snapshots = { S1: PAGE_B, S2: "The fine was raised to 3,000,000 won", S3: "nothing" };
const reader = (src) => ({ body: normText(snapshots[src.id]) });

test("orgOf counts subdomains of one organization once and keeps co.kr / hosting labels", () => {
	assert.equal(orgOf({ url: "https://docs.python.org/x" }), orgOf({ url: "https://peps.python.org/y" }));
	assert.equal(orgOf({ url: "https://www.law.go.kr/a" }), "law.go.kr");
	assert.notEqual(orgOf({ url: "https://a.github.io" }), orgOf({ url: "https://b.github.io" }));
});

test("high-risk numeric claim with a verbatim quote from a primary source is verified", () => {
	const byId = new Map(SOURCES.map((s) => [s.id, s]));
	const r = classifyClaim(highClaim(), byId, (id) => reader(byId.get(id)));
	assert.equal(r.status, "verified", r.reason);
});

test("a quote that is not in the stored source keeps the claim unresolved", () => {
	const byId = new Map(SOURCES.map((s) => [s.id, s]));
	const r = classifyClaim(highClaim({ evidence: [{ source_id: "S1", quote: "Article 12 sets the fine at 5,000,000 won" }] }), byId, (id) => reader(byId.get(id)));
	assert.equal(r.status, "unresolved");
	assert.match(r.reason, /not in the source/);
});

test("a numeric claim whose only matched quote lacks the number stays unresolved", () => {
	const byId = new Map(SOURCES.map((s) => [s.id, s]));
	const r = classifyClaim(highClaim({ evidence: [{ source_id: "S1", quote: "Statute text: Article 12 sets the fine" }] }), byId, (id) => reader(byId.get(id)));
	assert.equal(r.status, "unresolved");
	assert.match(r.reason, /numeric/);
});

test("two pages from the same organization are not two independent sources", () => {
	const byId = new Map(SOURCES.map((s) => [s.id, s]));
	const r = classifyClaim(highClaim({ source_ids: ["S2", "S3"], evidence: [] }), byId, (id) => reader(byId.get(id)));
	assert.equal(r.status, "unresolved");
	assert.match(r.reason, /independent organization/);
});

test("a missing or free-text counter-search is a procedure violation that fails the gate", () => {
	const noCounter = runGate({ claims: [highClaim({ counter_search: undefined })], sources: SOURCES, readSnapshot: reader });
	assert.equal(noCounter.exitCode, 1);
	const freeText = runGate({ claims: [highClaim({ counter_search: "searched, nothing" })], sources: SOURCES, readSnapshot: reader });
	assert.equal(freeText.exitCode, 1);
	assert.match(freeText.violations[0], /not free text/);
});

test("unregistered counter-search urls and unknown source ids are ledger errors", () => {
	const r = runGate({ claims: [highClaim({ source_ids: ["S1", "S9"], counter_search: { query: "q", urls: ["https://x.test/"] } })], sources: SOURCES, readSnapshot: reader });
	assert.equal(r.exitCode, 2);
	assert.equal(r.errors.length, 2);
});

test("verifyReport allows unverified claims only under an annex heading and flags ghosts", () => {
	const records = [
		{ id: "C1", status: "verified" },
		{ id: "C2", status: "unresolved" },
	];
	const ok = verifyReport("# Findings\nThe fine is 3,000,000 won [C1].\n\n## 미확정 (Unresolved)\n- [C2] still open\n", records);
	assert.equal(ok.exitCode, 0, JSON.stringify(ok.defects));
	const bad = verifyReport("# Findings\nThe fine is high [C2] and [C7].\n## Unresolved\n", records);
	assert.deepEqual(bad.defects.map((d) => d.code).sort(), ["ghost_claim", "no_verified_citation", "unverified_claim_in_body"]);
	const leaves = verifyReport("## Annex\n### Unresolved\n[C2]\n# Body again\n[C2] [C1]\n", records);
	assert.equal(leaves.defects.filter((d) => d.code === "unverified_claim_in_body").length, 1);
});

test("CLI: snapshot stores page text, gate passes, then a changed snapshot revokes the allowlist", async () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "claims-gate-"));
	try {
		const claims = [highClaim(), { id: "C2", text: "Normal claim", risk: "normal", source_ids: ["S2"] }];
		fs.writeFileSync(path.join(dir, "claims.jsonl"), claims.map((c) => JSON.stringify(c)).join("\n"));
		fs.writeFileSync(path.join(dir, "sources.jsonl"), SOURCES.map((s) => JSON.stringify(s)).join("\n"));
		const pages = { "https://www.law.go.kr/statute/12": ["text/html", PAGE_A.replace("raised to 3,000,000 won", "x") + `<p>${PAGE_B}</p>`] };
		const fetchImpl = async (url) => {
			const [type, body] = pages[url] ?? ["text/plain", ""];
			return new Response(body, { status: pages[url] ? 200 : 404, headers: { "content-type": type } });
		};
		const snap = await runSnapshot(["--session-dir", dir], { fetchImpl, now: () => "2026-11-15T00:00:00Z" });
		assert.equal(snap.exitCode, 0, JSON.stringify(snap.json));
		const stored = fs.readFileSync(path.join(dir, "sources", "snapshots", "S1.txt"), "utf8");
		assert.ok(stored.includes("Article 12 sets the fine at 3,000,000 won") && !stored.includes("<p>"));

		const pass = runClaimGate(["--session-dir", dir]);
		assert.equal(pass.exitCode, 0, pass.summary);
		assert.equal(pass.json.verified, 1);
		assert.equal(pass.json.unresolved, 1);
		assert.ok(fs.existsSync(path.join(dir, "verified-claims.json")));

		const report = path.join(dir, "SYNTHESIS.md");
		fs.writeFileSync(report, "# Fine\nIt is 3,000,000 won [C1].\n## Unresolved\n[C2]\n");
		assert.equal(runClaimReport(["--session-dir", dir, "--report", report]).exitCode, 0);

		fs.appendFileSync(path.join(dir, "sources", "snapshots", "S1.txt"), " edited");
		const tampered = runClaimGate(["--session-dir", dir]);
		assert.equal(tampered.json.verified, 0);
		assert.match(tampered.json.records.find((r) => r.id === "C1").reason, /sha256 mismatch/);
		fs.writeFileSync(path.join(dir, "claims.jsonl"), [highClaim({ counter_search: undefined })].map((c) => JSON.stringify(c)).join("\n"));
		const fail = runClaimGate(["--session-dir", dir]);
		assert.equal(fail.exitCode, 1);
		assert.ok(!fs.existsSync(path.join(dir, "verified-claims.json")), "stale allowlist removed");
		assert.ok(fs.existsSync(path.join(dir, "gate-failed.json")));
		assert.equal(runClaimReport(["--session-dir", dir, "--report", report]).exitCode, 1);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});
