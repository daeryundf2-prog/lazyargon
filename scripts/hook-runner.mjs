import { spawn } from "node:child_process";
import { StringDecoder } from "node:string_decoder";

async function readAllStdin() {
	return new Promise((resolve) => {
		let data = "";
		process.stdin.setEncoding("utf8");
		process.stdin.on("data", (chunk) => {
			data += chunk;
		});
		process.stdin.once("end", () => resolve(data));
		process.stdin.once("error", () => resolve(""));
		if (process.stdin.isTTY) {
			resolve("");
		}
	});
}

async function main() {
	const args = process.argv.slice(2);
	if (args.length < 4) {
		console.error("Usage: hook-runner.mjs <policy> <fallbackPayloadJson> <hitlEventName> <command> [args...]");
		process.exit(1);
	}

	const policy = args[0];
	const fallbackPayloadRaw = args[1] === "none" ? null : args[1];
	const command = args[3];
	const commandArgs = args.slice(4);
	const stdinData = await readAllStdin();

	return new Promise((resolve) => {
		const child = spawn(command, commandArgs, {
			stdio: ["pipe", "pipe", "pipe"],
			shell: false,
		});

		let stdoutData = "";
		let stderrData = "";
		let stdoutBytes = 0;
		let stderrBytes = 0;
		const stdoutDecoder = new StringDecoder("utf8");
		const stderrDecoder = new StringDecoder("utf8");
		const MAX_CAPTURE_BYTES = 10 * 1024 * 1024;

		child.stdout.on("data", (chunk) => {
			const chunkBytes = Buffer.byteLength(chunk);
			if (stdoutBytes + chunkBytes <= MAX_CAPTURE_BYTES) {
				stdoutBytes += chunkBytes;
				stdoutData += stdoutDecoder.write(chunk);
			}
		});

		child.stderr.on("data", (chunk) => {
			const chunkBytes = Buffer.byteLength(chunk);
			if (stderrBytes + chunkBytes <= MAX_CAPTURE_BYTES) {
				stderrBytes += chunkBytes;
				stderrData += stderrDecoder.write(chunk);
			}
		});

		child.stdin.on("error", () => {});
		if (stdinData) {
			child.stdin.write(stdinData);
		}
		child.stdin.end();

		child.on("close", (code) => {
			stdoutData += stdoutDecoder.end();
			stderrData += stderrDecoder.end();
			const safeStdout = stdoutData.trim() ? stdoutData : "{}\n";
			if (code === 0) {
				process.stdout.write(safeStdout);
				process.stderr.write(stderrData);
				resolve(0);
				return;
			}
			if (policy === "FAIL_OPEN") {
				process.stdout.write(safeStdout);
				process.stderr.write(stderrData);
				resolve(0);
			} else if (policy === "FAIL_SAFE") {
				let written = false;
				if (fallbackPayloadRaw) {
					try {
						const decoded = Buffer.from(fallbackPayloadRaw, "base64").toString("utf8");
						if (decoded.trim()) {
							process.stdout.write(decoded);
							written = true;
						}
					} catch {}
				}
				if (!written) {
					process.stdout.write(safeStdout);
				}
				resolve(0);
			} else {
				process.stdout.write(safeStdout);
				process.stderr.write(stderrData);
				resolve(1);
			}
		});

		child.on("error", () => {
			if (policy === "FAIL_OPEN" || policy === "FAIL_SAFE") {
				process.stdout.write("{}\n");
				resolve(0);
			} else {
				process.stdout.write("{}\n");
				resolve(1);
			}
		});
	}).then((code) => {
		process.exit(code);
	});
}

main();
