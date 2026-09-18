import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { EditorTheme, TUI } from "@earendil-works/pi-tui";
import { loadConfig } from "./src/config.ts";
import { ImeSlashEditor } from "./src/editor.ts";
import { InputSourceSwitcher } from "./src/input-source.ts";

/**
 * pi-ime-slash — a leading `、` becomes `/`, and the OS switches to English.
 *
 * When a CJK input method is active, pressing `/` commits `、` instead. If the
 * prompt is still empty the user almost certainly meant a slash command, so we
 * substitute `/` (which also lets pi's slash autocomplete trigger) and switch
 * the input source to English for the rest of the command.
 *
 * Typing in the middle of a sentence is never altered, and so are the
 * extension's own dialogs, which do not route through the prompt editor.
 *
 * Requires `im-select` on macOS, or `PI_IME_SLASH_SWITCH_CMD` elsewhere.
 * The replacement works on its own if no switcher is available.
 */
export default function piImeSlash(pi: ExtensionAPI) {
	const config = loadConfig();
	const switcher = new InputSourceSwitcher({
		englishSource: config.englishSource,
		switchCommand: config.switchCommand,
	});

	pi.registerCommand("ime-slash", {
		description: "Toggle automatic 、→/ replacement (pi-ime-slash)",
		handler: async (_args, ctx) => {
			config.enabled = !config.enabled;
			ctx.ui.notify(`IME→/ replacement: ${config.enabled ? "on" : "off"}`, "info");
		},
	});

	pi.on("session_start", async (_event, ctx) => {
		if (!ctx.hasUI) return;

		ctx.ui.setEditorComponent((tui: TUI, theme: EditorTheme, keybindings) =>
			new ImeSlashEditor(tui, theme, keybindings, config, switcher),
		);

		if (config.enabled && !(await switcher.probeAvailable())) {
			ctx.ui.notify(
				"pi-ime-slash: im-select not found — 、→/ still works, input source will not switch. " +
					"Install with `brew install im-select`.",
				"warning",
			);
		}
	});
}
