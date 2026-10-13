import { spawn } from "node:child_process";

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
		const MAX_CAPTURE_BYTES = 10 * 1024 * 1024;

		child.stdout.on("data", (chunk) => {
			if (stdoutData.length + chunk.length <= MAX_CAPTURE_BYTES) {
				stdoutData += chunk;
			}
		});

		child.stderr.on("data", (chunk) => {
			if (stderrData.length + chunk.length <= MAX_CAPTURE_BYTES) {
				stderrData += chunk;
			}
		});

		child.stdin.on("error", () => {});
		if (stdinData) {
			child.stdin.write(stdinData);
		}
		child.stdin.end();

		child.on("close", (code) => {
			if (code === 0) {
				process.stdout.write(stdoutData);
				process.stderr.write(stderrData);
				resolve(0);
				return;
			}
			if (policy === "FAIL_OPEN") {
				process.stderr.write(stderrData);
				resolve(0);
			} else if (policy === "FAIL_SAFE" && fallbackPayloadRaw) {
				try {
					process.stdout.write(Buffer.from(fallbackPayloadRaw, "base64").toString("utf8"));
				} catch {}
				resolve(0);
			} else {
				process.stdout.write(stdoutData);
				process.stderr.write(stderrData);
				resolve(1);
			}
		});

		child.on("error", () => {
			resolve(policy === "FAIL_OPEN" || policy === "FAIL_SAFE" ? 0 : 1);
		});
	}).then((code) => {
		process.exit(code);
	});
}

main();
