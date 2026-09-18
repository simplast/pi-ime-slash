/**
 * The editor that performs the replacement.
 *
 * We extend pi's `CustomEditor` rather than the base `Editor` so all app-level
 * keybindings (Escape to abort, Ctrl+D, model switching, …) keep working.
 */

import { CustomEditor } from "@earendil-works/pi-coding-agent";
import type { EditorTheme, TUI } from "@earendil-works/pi-tui";
import type { Config } from "./config.ts";
import { decodeInputChar } from "./decode.ts";
import type { InputSourceSwitcher } from "./input-source.ts";

/**
 * `KeybindingsManager` is defined separately in pi-tui and in pi-coding-agent,
 * and `CustomEditor` requires the latter. Deriving it from the constructor
 * keeps us correct without depending on the exact module it lives in.
 */
type AppKeybindings = ConstructorParameters<typeof CustomEditor>[2];

export class ImeSlashEditor extends CustomEditor {
	private readonly config: Config;
	private readonly switcher: InputSourceSwitcher;

	constructor(
		tui: TUI,
		theme: EditorTheme,
		keybindings: AppKeybindings,
		config: Config,
		switcher: InputSourceSwitcher,
	) {
		super(tui, theme, keybindings);
		this.config = config;
		this.switcher = switcher;
	}

	/**
	 * The rule: only rewrite when the editor is still empty, so a `、` typed in
	 * the middle of prose is always left alone.
	 */
	private replacementFor(data: string): string | undefined {
		if (!this.config.enabled || this.getText().length > 0) return undefined;
		const char = decodeInputChar(data);
		return char === undefined ? undefined : this.config.map[char];
	}

	override handleInput(data: string): void {
		const replacement = this.replacementFor(data);
		if (replacement !== undefined) {
			// Fire-and-forget: switching must never delay rendering the character.
			void this.switcher.switchToEnglish();
			// Delegate so undo history, autocomplete, and IME cursor placement all
			// behave exactly as they would for a keypress of the ASCII character.
			super.handleInput(replacement);
			return;
		}
		super.handleInput(data);
	}
}
