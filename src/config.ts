/**
 * Configuration for pi-ime-slash.
 *
 * Everything is read from the environment so there is no config file to manage.
 * The object is intentionally mutable: `/ime-slash` flips `enabled` at runtime
 * and the editor reads it on every keystroke.
 */

/** 中文输入法下按 `/` 通常上屏的字符 -> 期望替换成的 ASCII 字符 */
export const DEFAULT_MAP: Record<string, string> = {
	"、": "/", // U+3001 顿号（拼音输入法最常见）
	"／": "/", // U+FF0F 全角斜线
};

export interface Config {
	/** 是否启用。`PI_IME_SLASH=0` 可在启动时关闭，`/ime-slash` 可运行时切换。 */
	enabled: boolean;
	/** 字符映射表。`PI_IME_SLASH_MAP` 传入 JSON 可覆盖。 */
	map: Record<string, string>;
	/** 目标英文输入源 id。留空则自动探测。 */
	englishSource?: string;
	/** 自定义切换命令，`{source}` 会被替换成输入源 id。设置后跳过内置后端。 */
	switchCommand?: string;
}

function nonEmpty(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
}

/**
 * Parse `PI_IME_SLASH_MAP`.
 *
 * Accepts a JSON object of `{ "、": "/" }`. Invalid JSON or non-string values
 * are ignored so a typo can never break the extension at load time.
 */
export function parseMap(raw: string | undefined): Record<string, string> {
	const fallback = { ...DEFAULT_MAP };
	if (!raw) return fallback;
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return fallback;
		const entries = Object.entries(parsed as Record<string, unknown>).filter(
			([key, value]) => key.length > 0 && typeof value === "string",
		) as Array<[string, string]>;
		return entries.length > 0 ? Object.fromEntries(entries) : fallback;
	} catch {
		return fallback;
	}
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
	return {
		enabled: env.PI_IME_SLASH !== "0",
		map: parseMap(env.PI_IME_SLASH_MAP),
		// PI_IME_ENGLISH_SOURCE is the original name, kept for compatibility.
		englishSource: nonEmpty(env.PI_IME_SLASH_ENGLISH_SOURCE) ?? nonEmpty(env.PI_IME_ENGLISH_SOURCE),
		switchCommand: nonEmpty(env.PI_IME_SLASH_SWITCH_CMD),
	};
}
