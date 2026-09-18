import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_MAP, loadConfig, parseMap } from "../src/config.ts";

test("enabled by default, disabled via PI_IME_SLASH=0", () => {
	assert.equal(loadConfig({}).enabled, true);
	assert.equal(loadConfig({ PI_IME_SLASH: "0" }).enabled, false);
	assert.equal(loadConfig({ PI_IME_SLASH: "1" }).enabled, true);
});

test("default map covers the common IME substitutions", () => {
	const config = loadConfig({});
	assert.equal(config.map["、"], "/");
	assert.equal(config.map["／"], "/");
	assert.deepEqual(DEFAULT_MAP["、"], "/");
});

test("PI_IME_SLASH_MAP overrides the map", () => {
	const config = loadConfig({ PI_IME_SLASH_MAP: '{"，":","}' });
	assert.equal(config.map["，"], ",");
	assert.equal(config.map["、"], undefined);
});

test("invalid PI_IME_SLASH_MAP falls back to defaults instead of throwing", () => {
	for (const raw of ["not json", "[1,2]", "null", '"str"', '{"a":1}', "{}"]) {
		assert.deepEqual(parseMap(raw), DEFAULT_MAP, `input: ${raw}`);
	}
});

test("english source reads the new and legacy env names", () => {
	assert.equal(loadConfig({ PI_IME_SLASH_ENGLISH_SOURCE: "com.apple.keylayout.US" }).englishSource, "com.apple.keylayout.US");
	assert.equal(loadConfig({ PI_IME_ENGLISH_SOURCE: "com.apple.keylayout.US" }).englishSource, "com.apple.keylayout.US");
	// New name wins
	assert.equal(
		loadConfig({
			PI_IME_SLASH_ENGLISH_SOURCE: "new",
			PI_IME_ENGLISH_SOURCE: "legacy",
		}).englishSource,
		"new",
	);
	// Blank values are treated as unset
	assert.equal(loadConfig({ PI_IME_SLASH_ENGLISH_SOURCE: "   " }).englishSource, undefined);
});

test("switch command is read from the environment", () => {
	assert.equal(loadConfig({ PI_IME_SLASH_SWITCH_CMD: "fcitx5-remote -s keypad" }).switchCommand, "fcitx5-remote -s keypad");
});
