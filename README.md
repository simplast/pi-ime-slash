# pi-ime-slash

Typing a leading `、` in pi is almost always a mistake: your CJK input method committed a full-width comma where you meant the `/` that starts a slash command. This extension fixes both halves of that problem.

- **`、` → `/`** when it is the first character of an empty prompt
- **switches the OS input source to English** so the rest of the command types normally

Text in the middle of a sentence is never touched, so normal Chinese prose is unaffected.

```
Before:  、model              ← nothing happens, "、" is not a command
After:   /model              ← slash autocomplete opens, IME is now English
```

## Install

```bash
pi install npm:pi-ime-slash
```

Or try it without installing:

```bash
pi -e npm:pi-ime-slash
```

## Requirements

The character replacement works everywhere with no dependencies. Switching the input source is separate and optional:

| Platform | Backend |
| --- | --- |
| macOS | [`im-select`](https://github.com/daipeihust/im-select) — `brew install im-select` |
| Linux | Set `PI_IME_SLASH_SWITCH_CMD` (e.g. `fcitx5-remote -s keyboard-us`, or `ibus engine xkb:us::eng`) |
| Windows | Set `PI_IME_SLASH_SWITCH_CMD` to your own switcher |

If no backend is available, the extension still rewrites the character and shows a one-time notice. Nothing breaks.

## Usage

Just type `、` at the start of an empty prompt. To toggle the feature off and on:

```
/ime-slash
```

## Configuration

All configuration is via environment variables, so there is no config file.

| Variable | Default | Description |
| --- | --- | --- |
| `PI_IME_SLASH` | `1` | Set to `0` to start disabled. |
| `PI_IME_SLASH_MAP` | `{"、":"/","／":"/"}` | JSON object replacing the character map. |
| `PI_IME_SLASH_ENGLISH_SOURCE` | auto | Input source id to switch to, e.g. `com.apple.keylayout.US`. |
| `PI_IME_SLASH_SWITCH_CMD` | — | Custom switch command. `{source}` is substituted. |

Examples:

```bash
# Switch to US instead of ABC
PI_IME_SLASH_ENGLISH_SOURCE=com.apple.keylayout.US pi

# Linux with fcitx5
PI_IME_SLASH_SWITCH_CMD="fcitx5-remote -s keyboard-us" pi

# Also convert the full-width comma to a regular one
PI_IME_SLASH_MAP='{"、":"/","，":","}' pi

# Disable
PI_IME_SLASH=0 pi
```

`PI_IME_ENGLISH_SOURCE` is accepted as a legacy alias for `PI_IME_SLASH_ENGLISH_SOURCE`.

## How it works

The extension registers a custom editor via `ctx.ui.setEditorComponent()`. It extends pi's `CustomEditor`, so every app-level keybinding (Escape to abort, Ctrl+D, model switching, …) keeps working. Only when the prompt is empty does it intercept the keystroke, substitute the ASCII character, and delegate to the default implementation.

Two details worth knowing:

- **It replaces the character via `super.handleInput()`** rather than rewriting the text afterwards. Undo history, slash autocomplete, and IME cursor placement therefore behave exactly as if you had pressed the ASCII key.
- **Terminals with the Kitty keyboard protocol or xterm `modifyOtherKeys` are handled too.** Those report committed text as escape sequences instead of raw UTF-8, so both encodings are decoded before the leading-character check.

The extension only affects pi's own prompt editor. Dialog inputs (`/model` filtering, settings, extension selectors) do not route through it, so they are never altered.

## Development

```bash
npm install
npm test          # 37 tests, uses the real pi CustomEditor
npm run typecheck
```

The test suite deliberately runs against the installed pi packages rather than a mock, so undo behaviour, multi-line editing, and the editor's submit handling are all exercised for real.

## License

MIT
