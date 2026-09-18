/**
 * Switch the OS input source to English.
 *
 * macOS: drives `im-select` (https://github.com/daipeihust/im-select), the
 * de-facto tool for this job. It is a plain CLI, so we never need native
 * bindings or Accessibility permissions.
 *
 * Other platforms have no portable API. Users can provide their own command
 * via `PI_IME_SLASH_SWITCH_CMD`, with `{source}` interpolated if they want the
 * configured id passed through. That covers the common Linux setups
 * (`fcitx5-remote`, `ibus engine`) without adding platform-specific code.
 *
 * Every failure is swallowed on purpose: switching input methods is a
 * convenience, and a missing tool must never break typing.
 */

import { execFile } from "node:child_process";
/** English input sources tried in order when none is configured. */
export const ENGLISH_SOURCE_CANDIDATES = ["com.apple.keylayout.ABC", "com.apple.keylayout.US"];

export type SwitchOutcome = "switched" | "unavailable";

export interface SwitcherOptions {
	/** Explicit input source id. When set, the fallback list is not probed. */
	englishSource?: string;
	/** Custom shell command. `{source}` is replaced with the input source id. */
	switchCommand?: string;
	/** Injectable for tests. */
	run?: (command: string, args: string[]) => Promise<boolean>;
	/** Injectable for tests. */
	platform?: NodeJS.Platform;
}

function defaultRun(command: string, args: string[]): Promise<boolean> {
	return new Promise((resolve) => {
		execFile(command, args, (error) => resolve(!error));
	});
}

/**
 * Owns the (stateful) knowledge of which English source works on this machine,
 * so the fallback probes only happen until one succeeds.
 */
export class InputSourceSwitcher {
	private readonly run: (command: string, args: string[]) => Promise<boolean>;
	private readonly platform: NodeJS.Platform;
	private readonly englishSource?: string;
	private readonly switchCommand?: string;

	/** Resolved working source id for the default macOS backend. */
	private resolvedSource?: string;
	/** Set once probing proves there is nothing usable, to stop retrying. */
	private unavailable = false;
	/** In-flight probe, so rapid keystrokes don't spawn duplicate processes. */
	private pending?: Promise<SwitchOutcome>;

	constructor(options: SwitcherOptions = {}) {
		this.run = options.run ?? defaultRun;
		this.platform = options.platform ?? process.platform;
		this.englishSource = options.englishSource;
		this.switchCommand = options.switchCommand;
	}

	/** True when this platform/backend combination can plausibly switch. */
	get supported(): boolean {
		if (this.switchCommand) return true;
		return this.platform === "darwin";
	}

	private async runCommand(source: string): Promise<boolean> {
		const template = this.switchCommand;
		if (!template) return false;
		const args = template
			.split(/\s+/)
			.filter(Boolean)
			.map((part) => part.replace("{source}", source));
		const [command, ...rest] = args;
		if (!command) return false;
		return this.run(command, rest);
	}

	private async probeCandidates(): Promise<SwitchOutcome> {
		for (const candidate of ENGLISH_SOURCE_CANDIDATES) {
			if (await this.run("im-select", [candidate])) {
				this.resolvedSource = candidate;
				return "switched";
			}
		}
		this.unavailable = true;
		return "unavailable";
	}

	/**
	 * Switch to English. Safe to call on every keystroke: concurrent calls share
	 * one probe, and a machine without `im-select` is only probed once.
	 */
	async switchToEnglish(): Promise<SwitchOutcome> {
		if (!this.supported || this.unavailable) return "unavailable";

		// A custom command is user-supplied and cheap to trust; no probing needed.
		if (this.switchCommand) {
			const source = this.englishSource ?? ENGLISH_SOURCE_CANDIDATES[0]!;
			return (await this.runCommand(source)) ? "switched" : "unavailable";
		}

		if (this.englishSource) {
			const ok = await this.run("im-select", [this.englishSource]);
			return ok ? "switched" : "unavailable";
		}

		if (this.resolvedSource) {
			if (await this.run("im-select", [this.resolvedSource])) return "switched";
			// The cached source disappeared (layout removed); re-probe once.
			this.resolvedSource = undefined;
		}

		this.pending ??= this.probeCandidates().finally(() => {
			this.pending = undefined;
		});
		return this.pending;
	}

	/** Check whether the backend exists at all, for the startup warning. */
	async probeAvailable(): Promise<boolean> {
		if (!this.supported) return true;
		if (this.switchCommand) return true;
		// `im-select` with no arguments prints the current source and exits 0.
		const ok = await this.run("im-select", []);
		if (!ok) this.unavailable = true;
		return ok;
	}
}
