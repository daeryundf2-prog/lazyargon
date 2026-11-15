import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const radarScript = join(root, "scripts", "upstream_radar.mjs");
const RECEIPT_COUNT = JSON.parse(readFileSync(join(root, "docs", "skill-source-receipts.json"), "utf8")).sources.length;
const binEntry = join(root, "bin", "lazyargon");

test("upstream_radar.mjs audit --json verifies every receipt source and closure target", () => {
	const res = spawnSync(process.execPath, [radarScript, "audit", "--json"], { encoding: "utf8" });
	assert.equal(res.status, 0, `stderr: ${res.stderr}`);
	const data = JSON.parse(res.stdout);
	assert.equal(data.schema, "skill_source_closure_audit/v1");
	assert.equal(data.ok, true);
	assert.equal(data.source_count, RECEIPT_COUNT);
	assert.equal(data.missing_targets.length, 0);
	assert.ok(data.verified_targets >= 15);
});

test("upstream_radar.mjs audit negative path detects missing target and fabricated pin, fails closed", () => {
	const tmp = mkdtempSync(join(tmpdir(), "radar-test-"));
	try {
		const badReceipts = join(tmp, "bad-receipts.json");
		writeFileSync(
			badReceipts,
			JSON.stringify({
				schema: "skill_source_closure_audit/v1",
				version: "1.0.0",
				updated_at: "2026-10-30T11:45:00Z",
				sources: [
					{
						repo: "example/missing-repo",
						url: "https://github.com/example/missing-repo",
						pinned_sha: null,
						status: "unverified",
						keyword: "missing",
						mapped_targets: ["scripts/does_not_exist_anywhere_999.mjs", "/etc/hosts"],
					},
					{
						repo: "example/fabricated-pin",
						url: "https://github.com/example/fabricated-pin",
						pinned_sha: "deadbeef",
						status: "verified",
						keyword: "fabricated",
						mapped_targets: ["scripts/doctor.mjs"],
					},
				],
			}),
		);
		const res = spawnSync(process.execPath, [radarScript, "audit", "--receipts", badReceipts, "--json"], { encoding: "utf8" });
		assert.equal(res.status, 1);
		const data = JSON.parse(res.stdout);
		assert.equal(data.ok, false);
		assert.ok(data.missing_targets.includes("scripts/does_not_exist_anywhere_999.mjs"));
		assert.deepEqual(data.invalid_sources, ["example/fabricated-pin"]);
		assert.ok(data.missing_targets.includes("example/missing-repo:<outside_plugins_dir:/etc/hosts>"));
	} finally {
		rmSync(tmp, { recursive: true, force: true });
	}
});

test("upstream_radar.mjs poll --offline --json returns every receipt source", () => {
	const res = spawnSync(process.execPath, [radarScript, "poll", "--offline", "--json"], { encoding: "utf8" });
	assert.equal(res.status, 0);
	const data = JSON.parse(res.stdout);
	assert.equal(data.mode, "offline");
	assert.equal(data.source_count, RECEIPT_COUNT);
	assert.equal(data.drift_count, 0);
});


test("bin/lazyargon routes active subcommands only and exits with code 2 on unknown or quarantined subcommand", () => {
	const tmp = mkdtempSync(join(tmpdir(), "bin-route-"));
	try {
		const validFile = join(tmp, "ok.mjs");
		writeFileSync(validFile, "export const ok = 1;\n", "utf8");

		const checks = [
			["doctor", "--json"],
			["radar", "audit", "--json"],
			["upstream", "list", "--json"],
			["codegraph", "build", "--root", tmp],
			["lsp", "check", "--files", validFile, "--root", tmp, "--json"],
		];

		for (const args of checks) {
			const res = spawnSync(process.execPath, [binEntry, ...args], { encoding: "utf8" });
			if (args[0] === "doctor") {
				assert.ok(res.status === 0 || res.status === 1, `Subcommand doctor failed with status ${res.status}: ${res.stderr}`);
				assert.ok(Array.isArray(JSON.parse(res.stdout).checks));
			} else {
				assert.equal(res.status, 0, `Subcommand ${args[0]} failed with status ${res.status}: ${res.stderr}`);
			}
		}

		for (const sub of ["unknown-subcmd-xyz", "tui", "dag", "memory", "rag", "slop", "calibrate", "autoresearch"]) {
			const bad = spawnSync(process.execPath, [binEntry, sub], { encoding: "utf8" });
			assert.equal(bad.status, 2, `${sub} should be rejected`);
		}
	} finally {
		rmSync(tmp, { recursive: true, force: true });
	}
});
