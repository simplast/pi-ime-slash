# Changelog

## 0.1.0

Initial release.

- Replace a leading `、` (and full-width `／`) with `/` when the prompt is empty.
- Switch the macOS input source to English via `im-select` after the replacement.
- Support Linux/Windows switchers through `PI_IME_SLASH_SWITCH_CMD`.
- Decode Kitty CSI-u and xterm `modifyOtherKeys` input so the rule works in
  Ghostty, Kitty, WezTerm, VS Code, and tmux with `extended-keys`.
- `/ime-slash` command to toggle at runtime.
