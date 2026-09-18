/**
 * Decode raw terminal input into the character the user actually typed.
 *
 * A CJK IME reports the committed character as a plain UTF-8 string, so in the
 * common case `data` is already a single character and we just return it.
 *
 * Terminals with the Kitty keyboard protocol (or xterm's modifyOtherKeys)
 * report the same character as an escape sequence. Those are decoded here so
 * the leading-character rule keeps working in Ghostty, Kitty, WezTerm,
 * VS Code's terminal, and tmux with `extended-keys`.
 *
 * This module is intentionally dependency-free so it can be unit tested
 * without installing pi.
 */

/** Kitty CSI-u: `CSI codepoint[:shifted[:base]] [;mod[:event]] u` */
const KITTY_CSI_U = /^\x1b\[(\d+)(?::(\d*))?(?::(\d+))?(?:;(\d+))?(?::(\d+))?u$/;

/** xterm modifyOtherKeys: `CSI 27 ; mods ; codepoint ~` (mods are 1-indexed) */
const MODIFY_OTHER_KEYS = /^\x1b\[27;(\d+);(\d+)~$/;

/** Kitty modifier bit for Shift. */
const SHIFT_BIT = 1;

function fromCodepoint(codepoint: number): string | undefined {
	if (!isPrintableCodepoint(codepoint)) return undefined;
	try {
		return String.fromCodePoint(codepoint);
	} catch {
		return undefined;
	}
}

/**
 * Printable text excludes C0 controls (0-31) and DEL (127). Everything else,
 * including CJK and emoji, is treated as a character the user typed.
 */
function isPrintableCodepoint(codepoint: number): boolean {
	return Number.isFinite(codepoint) && codepoint >= 32 && codepoint !== 127;
}

function decodeKitty(data: string): string | undefined {
	const match = data.match(KITTY_CSI_U);
	if (!match) return undefined;

	const codepoint = Number.parseInt(match[1] ?? "", 10);
	const shifted = match[2] ? Number.parseInt(match[2], 10) : undefined;
	const modifierValue = match[4] ? Number.parseInt(match[4], 10) : 1;
	const modifier = Number.isFinite(modifierValue) ? modifierValue - 1 : 0;

	// Only plain or Shift-modified text keys are relevant here. Rejecting
	// Ctrl/Alt/Super keeps us from mistaking a shortcut for committed text.
	if (modifier & ~SHIFT_BIT) return undefined;

	const effective = modifier & SHIFT_BIT && shifted !== undefined ? shifted : codepoint;
	return fromCodepoint(effective);
}

function decodeModifyOtherKeys(data: string): string | undefined {
	const match = data.match(MODIFY_OTHER_KEYS);
	if (!match) return undefined;
	// mods: 2=shift, 3=alt, 5=ctrl, ... We only accept unmodified or Shift.
	const modifierValue = Number.parseInt(match[1] ?? "", 10);
	const modifier = modifierValue - 1;
	if (modifier & ~SHIFT_BIT) return undefined;
	return fromCodepoint(Number.parseInt(match[2] ?? "", 10));
}

/**
 * Return the printable character for a raw input chunk, or `undefined` when
 * the chunk is not text (a control key, a multi-character sequence, etc.).
 */
export function decodeInputChar(data: string): string | undefined {
	if (data.length === 0) return undefined;
	// Fast path: a committed CJK character arrives as one code point. Control
	// characters (lone ESC, Ctrl+X, DEL, …) are not text, so exclude them.
	if (data.length === 1) return isPrintableCodepoint(data.charCodeAt(0)) ? data : undefined;
	// Anything else that does not start an escape sequence is not committed text.
	if (!data.startsWith("\x1b")) return undefined;
	return decodeKitty(data) ?? decodeModifyOtherKeys(data);
}
