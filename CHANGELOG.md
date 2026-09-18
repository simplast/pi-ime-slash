# Changelog

## 0.1.1

- Clarify that `PI_IME_SLASH=0` disables the feature for that pi run; it is not
  a startup service. Document exactly what the extension does and does not
  touch on the host system.
- Add a Simplified Chinese README (`README.zh-CN.md`).

## 0.1.0

Initial release.

- Replace a leading `、` (and full-width `／`) with `/` when the prompt is empty.
- Switch the macOS input source to English via `im-select` after the replacement.
- Support Linux/Windows switchers through `PI_IME_SLASH_SWITCH_CMD`.
- Decode Kitty CSI-u and xterm `modifyOtherKeys` input so the rule works in
  Ghostty, Kitty, WezTerm, VS Code, and tmux with `extended-keys`.
- `/ime-slash` command to toggle at runtime.
