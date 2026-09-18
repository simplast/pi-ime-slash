import assert from "node:assert/strict";
import test from "node:test";
import { decodeInputChar } from "../src/decode.ts";

test("plain committed characters pass through", () => {
	assert.equal(decodeInputChar("、"), "、");
	assert.equal(decodeInputChar("/"), "/");
	assert.equal(decodeInputChar("a"), "a");
	assert.equal(decodeInputChar("中"), "中");
});

test("multi-character input that is not an escape sequence is ignored", () => {
	assert.equal(decodeInputChar("abc"), undefined);
	assert.equal(decodeInputChar(""), undefined);
});

test("control characters are not text", () => {
	assert.equal(decodeInputChar("\r"), undefined); // enter
	assert.equal(decodeInputChar("\x7f"), undefined); // backspace
	assert.equal(decodeInputChar("\x1b"), undefined); // lone ESC
	assert.equal(decodeInputChar("\x01"), undefined); // ctrl+a
	assert.equal(decodeInputChar("\t"), undefined); // tab
});

test("Kitty CSI-u is decoded", () => {
	// U+3001 = 12289, no modifiers
	assert.equal(decodeInputChar("\x1b[12289u"), "、");
	// Slash with no modifiers
	assert.equal(decodeInputChar("\x1b[47u"), "/");
	// U+FF0F fullwidth solidus = 65295
	assert.equal(decodeInputChar("\x1b[65295u"), "／");
});

test("Kitty shifted alternate key is preferred", () => {
	// CSI 47:63;2u -> codepoint '/', shifted '?' with Shift held
	assert.equal(decodeInputChar("\x1b[47:63;2u"), "?");
});

test("Kitty control/alt modified keys are not treated as text", () => {
	// Ctrl+u (modifier value 5 => ctrl bit)
	assert.equal(decodeInputChar("\x1b[117;5u"), undefined);
	// Alt+u (modifier value 3 => alt bit)
	assert.equal(decodeInputChar("\x1b[117;3u"), undefined);
	// Super+u (modifier value 9 => super bit)
	assert.equal(decodeInputChar("\x1b[117;9u"), undefined);
});

test("Kitty functional keys are not treated as text", () => {
	assert.equal(decodeInputChar("\x1b[13u"), undefined); // enter (codepoint 13)
});

test("xterm modifyOtherKeys is decoded", () => {
	// CSI 27 ; 1 ; 12289 ~  (modifier 1 = none)
	assert.equal(decodeInputChar("\x1b[27;1;12289~"), "、");
	// CSI 27 ; 2 ; 12289 ~  (modifier 2 = shift, still text)
	assert.equal(decodeInputChar("\x1b[27;2;12289~"), "、");
});

test("modifyOtherKeys with ctrl/alt is not treated as text", () => {
	// modifier 5 = ctrl, modifier 3 = alt
	assert.equal(decodeInputChar("\x1b[27;5;12289~"), undefined);
	assert.equal(decodeInputChar("\x1b[27;3;12289~"), undefined);
});

test("malformed escape sequences are ignored", () => {
	assert.equal(decodeInputChar("\x1b"), undefined);
	assert.equal(decodeInputChar("\x1b["), undefined);
	assert.equal(decodeInputChar("\x1b[99999999999999999999u"), undefined);
});
