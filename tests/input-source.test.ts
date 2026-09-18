import assert from "node:assert/strict";
import test from "node:test";
import { ENGLISH_SOURCE_CANDIDATES, InputSourceSwitcher } from "../src/input-source.ts";

/** Build a fake runner that records calls and returns scripted results. */
function makeRunner(script: Record<string, boolean> = {}) {
	const calls: Array<{ command: string; args: string[] }> = [];
	const run = async (command: string, args: string[]) => {
		calls.push({ command, args });
		const key = `${command} ${args.join(" ")}`;
		return script[key] ?? true;
	};
	return { run, calls };
}

test("macOS default probes ABC first and caches the result", async () => {
	const { run, calls } = makeRunner();
	const switcher = new InputSourceSwitcher({ run, platform: "darwin" });

	assert.equal(await switcher.switchToEnglish(), "switched");
	assert.equal(await switcher.switchToEnglish(), "switched");

	// First call probes ABC; second reuses the cached source.
	assert.deepEqual(calls, [
		{ command: "im-select", args: [ENGLISH_SOURCE_CANDIDATES[0]] },
		{ command: "im-select", args: [ENGLISH_SOURCE_CANDIDATES[0]] },
	]);
});

test("falls back to the next candidate when ABC is unavailable", async () => {
	const { run, calls } = makeRunner({
		[`im-select ${ENGLISH_SOURCE_CANDIDATES[0]}`]: false,
	});
	const switcher = new InputSourceSwitcher({ run, platform: "darwin" });

	assert.equal(await switcher.switchToEnglish(), "switched");
	assert.deepEqual(
		calls.map((c) => c.args[0]),
		[ENGLISH_SOURCE_CANDIDATES[0], ENGLISH_SOURCE_CANDIDATES[1]],
	);
});

test("stops probing once no candidate works", async () => {
	const { run, calls } = makeRunner({
		[`im-select ${ENGLISH_SOURCE_CANDIDATES[0]}`]: false,
		[`im-select ${ENGLISH_SOURCE_CANDIDATES[1]}`]: false,
	});
	const switcher = new InputSourceSwitcher({ run, platform: "darwin" });

	assert.equal(await switcher.switchToEnglish(), "unavailable");
	assert.equal(await switcher.switchToEnglish(), "unavailable");
	// Exactly one probe pass: 2 calls, not 4.
	assert.equal(calls.length, 2);
});

test("concurrent keystrokes share a single probe", async () => {
	let release: (() => void) | undefined;
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	const calls: string[] = [];
	const run = async (_command: string, args: string[]) => {
		calls.push(args[0]!);
		await gate;
		return true;
	};
	const switcher = new InputSourceSwitcher({ run, platform: "darwin" });

	const inFlight = [switcher.switchToEnglish(), switcher.switchToEnglish(), switcher.switchToEnglish()];
	release?.();
	const results = await Promise.all(inFlight);

	assert.deepEqual(results, ["switched", "switched", "switched"]);
	assert.equal(calls.length, 1);
});

test("re-probes when the cached source disappears", async () => {
	let abcWorks = true;
	const calls: string[] = [];
	const run = async (_command: string, args: string[]) => {
		const source = args[0]!;
		calls.push(source);
		if (source === ENGLISH_SOURCE_CANDIDATES[0]) return abcWorks;
		return true;
	};
	const switcher = new InputSourceSwitcher({ run, platform: "darwin" });

	assert.equal(await switcher.switchToEnglish(), "switched");
	abcWorks = false; // e.g. the ABC layout was removed from the system
	assert.equal(await switcher.switchToEnglish(), "switched");
	// ...ABC (probe) -> ABC (cached, fails) -> ABC (re-probe) -> US
	assert.deepEqual(calls, [
		ENGLISH_SOURCE_CANDIDATES[0],
		ENGLISH_SOURCE_CANDIDATES[0],
		ENGLISH_SOURCE_CANDIDATES[0],
		ENGLISH_SOURCE_CANDIDATES[1],
	]);
});

test("explicit source is used directly without probing", async () => {
	const { run, calls } = makeRunner();
	const switcher = new InputSourceSwitcher({ run, platform: "darwin", englishSource: "com.apple.keylayout.US" });

	assert.equal(await switcher.switchToEnglish(), "switched");
	assert.deepEqual(calls, [{ command: "im-select", args: ["com.apple.keylayout.US"] }]);
});

test("non-macOS without a custom command is unsupported and does no work", async () => {
	const { run, calls } = makeRunner();
	const switcher = new InputSourceSwitcher({ run, platform: "linux" });

	assert.equal(await switcher.switchToEnglish(), "unavailable");
	assert.equal(calls.length, 0);
});

test("custom command enables other platforms and interpolates {source}", async () => {
	const { run, calls } = makeRunner();
	const switcher = new InputSourceSwitcher({
		run,
		platform: "linux",
		switchCommand: "fcitx5-remote -s {source}",
		englishSource: "keyboard-us",
	});

	assert.equal(await switcher.switchToEnglish(), "switched");
	assert.deepEqual(calls, [{ command: "fcitx5-remote", args: ["-s", "keyboard-us"] }]);
});

test("custom command without {source} still runs", async () => {
	const { run, calls } = makeRunner();
	const switcher = new InputSourceSwitcher({
		run,
		platform: "linux",
		switchCommand: "ibus engine xkb:us::eng",
	});

	assert.equal(await switcher.switchToEnglish(), "switched");
	assert.deepEqual(calls, [{ command: "ibus", args: ["engine", "xkb:us::eng"] }]);
});

test("probeAvailable reports a missing backend", async () => {
	const present = new InputSourceSwitcher({ run: async () => true, platform: "darwin" });
	assert.equal(await present.probeAvailable(), true);

	const missing = new InputSourceSwitcher({ run: async () => false, platform: "darwin" });
	assert.equal(await missing.probeAvailable(), false);
	// A failed probe also disables later switching attempts.
	assert.equal(await missing.switchToEnglish(), "unavailable");
});
