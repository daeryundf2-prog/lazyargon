// fetch-guard.mjs - the network side of `claims snapshot`: a fetch that refuses internal addresses
// (checked on every connection and every redirect hop, so a hostname cannot rebind to an internal IP
// between check and connect), prompt-injection signals for stored page text, and the opt-in
// insane-search fallback for pages that block plain requests.
// Ideas adapted from insane-search (fivetaku, MIT) engine/safety.py and engine/content_safety.py,
// with the stricter fail-closed resolver rule of the dbc-hbin Go port; the code is our own.
// Plain Node ESM, node: builtins only.

import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { lookup as dnsLookup } from "node:dns"
import http from "node:http"
import https from "node:https"
import { isIP } from "node:net"
import zlib from "node:zlib"
import { orgOf } from "./claims-gate.mjs"

export const MAX_REDIRECTS = 5
export const MAX_BYTES = 25 * 1024 * 1024

/** True for loopback, private, link-local (cloud metadata), CGNAT, multicast, unspecified and reserved ranges. */
export function isBlockedIp(ip) {
	const v = isIP(ip)
	if (v === 4) {
		const [a, b, c] = ip.split(".").map(Number)
		return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
			|| (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0 && (c === 0 || c === 2))
			|| (a === 198 && (b === 18 || b === 19)) || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113)
	}
	if (v === 6) {
		const x = ip.toLowerCase()
		if (x === "::" || x === "::1") return true
		const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(x)
		if (mapped) return isBlockedIp(mapped[1])
		return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(x)
	}
	return true
}

export class GuardError extends Error {
	constructor(code, message) {
		super(message)
		this.code = code
	}
}

/** dns.lookup replacement used at connect time: resolution failure or any internal answer fails closed. */
function guardedLookup(hostname, options, callback) {
	dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
		if (err) return callback(new GuardError("resolve_failed", `cannot resolve ${hostname}: ${err.code ?? err.message}`))
		const bad = addresses.find((a) => isBlockedIp(a.address))
		if (bad) return callback(new GuardError("ssrf_blocked", `${hostname} resolves to internal address ${bad.address}`))
		if (options.all) return callback(null, addresses)
		return callback(null, addresses[0].address, addresses[0].family)
	})
}

function requestOnce(url, { timeoutMs, maxBytes }) {
	return new Promise((resolve, reject) => {
		const u = new URL(url)
		if (u.protocol !== "http:" && u.protocol !== "https:") return reject(new GuardError("scheme_blocked", `scheme ${u.protocol} is not fetched`))
		const host = u.hostname.replace(/^\[|\]$/g, "")
		if (isIP(host) && isBlockedIp(host)) return reject(new GuardError("ssrf_blocked", `internal address ${host}`))
		const mod = u.protocol === "https:" ? https : http
		const req = mod.request(u, {
			method: "GET",
			lookup: guardedLookup,
			headers: { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) lazyargon-claims-snapshot", "accept-encoding": "gzip, deflate, br" },
			timeout: timeoutMs,
		}, (res) => {
			const chunks = []
			let size = 0
			res.on("data", (c) => {
				size += c.length
				if (size > maxBytes) { req.destroy(new GuardError("too_large", `response over ${maxBytes} bytes`)); return }
				chunks.push(c)
			})
			res.on("end", () => {
				let body = Buffer.concat(chunks)
				const enc = String(res.headers["content-encoding"] ?? "").toLowerCase()
				try {
					if (enc === "gzip") body = zlib.gunzipSync(body)
					else if (enc === "deflate") body = zlib.inflateSync(body)
					else if (enc === "br") body = zlib.brotliDecompressSync(body)
				} catch (error) {
					return reject(new GuardError("decode_failed", `cannot decode ${enc} body: ${error.message}`))
				}
				resolve({ status: res.statusCode ?? 0, headers: res.headers, body })
			})
			res.on("error", reject)
		})
		req.on("timeout", () => req.destroy(new GuardError("timeout", `no response within ${timeoutMs} ms`)))
		req.on("error", reject)
		req.end()
	})
}

/**
 * fetch-compatible (url) -> Response, following up to MAX_REDIRECTS redirects and checking every hop.
 * Throws GuardError for internal targets, unresolvable hosts, oversized bodies and timeouts.
 */
export async function guardedFetch(url, { timeoutMs = 20_000, maxBytes = MAX_BYTES } = {}) {
	let current = url
	for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
		const res = await requestOnce(current, { timeoutMs, maxBytes })
		const location = res.headers.location
		if (res.status >= 300 && res.status < 400 && location) {
			current = new URL(location, current).href
			continue
		}
		const headers = new Headers()
		for (const [k, v] of Object.entries(res.headers)) if (v !== undefined && k !== "content-encoding") headers.set(k, Array.isArray(v) ? v.join(", ") : String(v))
		const response = new Response(res.status === 204 || res.status === 304 ? null : res.body, { status: res.status, headers })
		Object.defineProperty(response, "url", { value: current })
		return response
	}
	throw new GuardError("too_many_redirects", `more than ${MAX_REDIRECTS} redirects from ${url}`)
}

const SIGNAL_RULES = [
	["instruction_override", /\b(ignore|disregard|forget|override)\b[\s\S]{0,80}\b(previous|prior|above|earlier|all)\b[\s\S]{0,40}\b(instructions?|prompt|messages?)\b/i],
	["system_prompt_access", /\b(system|developer)\s+(prompt|message|instruction)s?\b|\breveal\b[\s\S]{0,40}\b(system prompt|developer message)\b/i],
	["tool_execution", /\b(run|execute|call)\b[\s\S]{0,40}\b(shell|bash|curl|python|rm -rf)\b/i],
	["data_exfiltration", /\b(send|upload|exfiltrate|post|leak)\b[\s\S]{0,80}\b(token|api[-_ ]?key|secret|credential|password|system prompt|id_rsa)\b/i],
	["korean_instruction_override", /(이전|위의|앞의|모든)\s*(지시|명령|지침|프롬프트)[^.\n]{0,20}(무시|잊어|따르지)/],
]

/** Prompt-injection signals in fetched text. The text is still stored verbatim; the signals tell the orchestrator to treat it as data only. */
export function injectionSignals(text) {
	return SIGNAL_RULES.filter(([, re]) => re.test(text)).map(([name]) => name)
}

/** 401 is a login wall: the page wants an account, so it is never a bypass target. */
export const LOGIN_REQUIRED_STATUS = 401

/** Status codes and bodies that mean "this page refuses plain requests" (the case the opt-in fallback is for). */
export function looksBlocked(status, text = "") {
	if ([401, 403, 406, 429, 451, 503].includes(status)) return true
	return /cf-chl|challenge-platform|captcha|access denied|attention required|just a moment/i.test(text.slice(0, 4000))
}

/**
 * Opt-in fallback: run an installed insane-search engine (https://github.com/fivetaku/insane-search, MIT) on a page that
 * blocked the plain request. It imitates browsers to get past bot walls, which can breach a site's terms, so callers must
 * pass --allow-bypass and point ULW_INSANE_SEARCH_DIR at the engine's skill folder. Never used for case material.
 */
/** Default install location (~/.local/share/insane-search); ULW_INSANE_SEARCH_DIR / ULW_INSANE_SEARCH_PYTHON override it. */
export function insaneSearchPaths(env = process.env, home = homedir()) {
	const base = join(home, ".local", "share", "insane-search")
	const engineDir = env.ULW_INSANE_SEARCH_DIR || (existsSync(join(base, "skills", "insane-search", "engine")) ? join(base, "skills", "insane-search") : "")
	const python = env.ULW_INSANE_SEARCH_PYTHON || (existsSync(join(base, ".venv", "bin", "python")) ? join(base, ".venv", "bin", "python") : "python3")
	// A STANDING_CONSENT file next to the engine records the user's standing consent for public web research.
	const consentFile = join(base, "STANDING_CONSENT")
	return { engineDir, python, standingConsent: existsSync(consentFile) }
}

/** Shorter engine output is a stub, an error page or a login prompt, not the article. */
const MIN_BYPASS_TEXT = 200

export function insaneSearchFetch(url, engineDir, { timeoutSec = 45, python = insaneSearchPaths().python } = {}) {
	const run = spawnSync(python, ["-m", "engine", url, "--json-content", "--timeout", String(timeoutSec)], {
		cwd: engineDir, encoding: "utf8", timeout: (timeoutSec + 30) * 1000, maxBuffer: MAX_BYTES * 2,
	})
	if (run.error) return { status: "error", why: `insane-search did not run: ${run.error.message}` }
	let payload
	try {
		payload = JSON.parse(run.stdout)
	} catch {
		return { status: "error", why: `insane-search output was not JSON (exit ${run.status}): ${String(run.stderr).slice(-200)}` }
	}
	// --json-content wraps the page in the engine's untrusted-content boundary; keep only what is inside it.
	const { begin = "", end = "" } = payload.untrusted_content_boundary ?? {}
	const wrapped = String(payload.untrusted_text ?? "")
	const from = begin ? wrapped.indexOf(begin) : -1
	const to = end ? wrapped.lastIndexOf(end) : -1
	const text = from >= 0 && to > from ? wrapped.slice(from + begin.length, to).trim() : ""
	if (!payload.ok || !text) return { status: "blocked", why: `insane-search gave up: ${payload.verdict || payload.stop_reason || "no content"}` }
	const finalUrl = String(payload.final_url || url)
	// Same organization (kr.indeed.com for www.indeed.com, co.kr aware) is a normal geo or www redirect; another one is a login, paywall or error host.
	if (orgOf({ url: finalUrl }) !== orgOf({ url })) return { status: "blocked", why: `insane-search landed on ${finalUrl}, not the requested site; not stored`, finalUrl }
	if (text.length < MIN_BYPASS_TEXT || looksBlocked(200, text)) return { status: "blocked", why: `insane-search returned a wall or an empty page (${text.length} chars); not stored`, finalUrl }
	return { status: "ok", text, finalUrl, verdict: payload.verdict }
}
