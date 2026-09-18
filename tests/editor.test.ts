import assert from "node:assert/strict";
import test from "node:test";
import { ImeSlashEditor } from "../src/editor.ts";
import { InputSourceSwitcher } from "../src/input-source.ts";

/**
 * These tests exercise the real `ImeSlashEditor`, which extends pi's real
 * `CustomEditor`, so the suite depends on the installed pi packages. That is
 * deliberate: it is what makes these tests meaningful.
 */

const MAP = { "、": "/", "／": "/" };

/** Minimal TUI/theme/keybindings stand-ins; the editor only needs these shapes. */
const noop = () => {};
const tui = { requestRender: noop, requestImmediateRender: noop, addInputListener: () => noop };
const theme = { borderColor: (s: string) => s };
const keybindings = { matches: () => false, getKeys: () => [] };

function makeEditor({ enabled = true, engine = true } = {}) {
	const calls: string[][] = [];
	const switcher = new InputSourceSwitcher({
		platform: "darwin",
		run: async (command, args) => {
			calls.push([command, ...args]);
			return engine;
		},
	});
	const editor = new ImeSlashEditor(
		tui as never,
		theme as never,
		keybindings as never,
		{ enabled, map: MAP },
		switcher,
	);
	return { editor, calls };
}

/** Wait for the fire-and-forget switch promise to settle. */
const settle = () => new Promise((resolve) => setImmediate(resolve));

test("leading 、 becomes / and switches the input source", async () => {
	const { editor, calls } = makeEditor();
	editor.handleInput("、");
	await settle();

	assert.equal(editor.getText(), "/");
	assert.deepEqual(calls, [["im-select", "com.apple.keylayout.ABC"]]);
});

test("leading fullwidth solidus becomes /", async () => {
	const { editor, calls } = makeEditor();
	editor.handleInput("／");
	await settle();

	assert.equal(editor.getText(), "/");
	assert.equal(calls.length, 1);
});

test("、 typed after other text is preserved and does not switch", async () => {
	const { editor, calls } = makeEditor();
	editor.handleInput("hello");
	editor.handleInput("、");
	await settle();

	assert.equal(editor.getText(), "hello、");
	assert.equal(calls.length, 0);
});

test("only the first 、 is rewritten", async () => {
	const { editor, calls } = makeEditor();
	editor.handleInput("、");
	editor.handleInput("、");
	await settle();

	assert.equal(editor.getText(), "/、");
	assert.equal(calls.length, 1, "switch fires only for the leading character");
});

test("a plain ASCII slash passes through and does not switch", async () => {
	const { editor, calls } = makeEditor();
	editor.handleInput("/");
	await settle();

	assert.equal(editor.getText(), "/");
	assert.equal(calls.length, 0);
});

test("deleting back to empty re-enables the rule", async () => {
	const { editor, calls } = makeEditor();
	editor.handleInput("a");
	editor.handleInput("\x7f"); // backspace
	assert.equal(editor.getText(), "");
	editor.handleInput("、");
	await settle();

	assert.equal(editor.getText(), "/");
	assert.equal(calls.length, 1);
});

test("disabled config leaves the 、 untouched", async () => {
	const { editor, calls } = makeEditor({ enabled: false });
	editor.handleInput("、");
	await settle();

	assert.equal(editor.getText(), "、");
	assert.equal(calls.length, 0);
});

test("Kitty-encoded 、 is replaced too", async () => {
	const { editor, calls } = makeEditor();
	editor.handleInput("\x1b[12289u");
	await settle();

	assert.equal(editor.getText(), "/");
	assert.equal(calls.length, 1);
});

test("multi-line editing: 、 on a later line is preserved", async () => {
	const { editor, calls } = makeEditor();
	editor.setText("a\n");
	editor.handleInput("、");
	await settle();

	assert.equal(editor.getText(), "a\n、");
	assert.equal(calls.length, 0);
});

test("replacement still works when no switcher backend exists", async () => {
	const { editor, calls } = makeEditor({ engine: false });
	editor.handleInput("、");
	await settle();

	assert.equal(editor.getText(), "/", "replacement must not depend on im-select");
	assert.equal(calls.length, 2, "both candidates probed, then gave up");
});

test("undo removes the whole replacement in one step", async () => {
	const { editor } = makeEditor();
	editor.handleInput("、");
	await settle();
	assert.equal(editor.getText(), "/");
	editor.handleInput("\x1f"); // ctrl+- is bound to tui.editor.undo
	assert.equal(editor.getText(), "");
});
