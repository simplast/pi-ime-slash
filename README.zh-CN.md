# pi-ime-slash

[English](README.md) | **简体中文**

在 pi 里，开头打出一个 `、` 几乎总是个失误：中文输入法把你想输入的斜杠 `/` 上屏成了全角逗号，于是一条斜杠命令就这么静默失效了。这个扩展把问题**两头都修掉**：

- **`、` → `/`** —— 当它是空输入框的第一个字符时
- **把系统输入源切换成英文** —— 让你接着输入后半段命令

句子中间的 `、` 永远不会被动到，所以正常的中文写作不受任何影响。

```
之前：  、model              ← 什么都不会发生，"、" 不是命令
之后：  /model              ← 斜杠自动补全弹出，输入法已切到英文
```

## 安装

```bash
pi install npm:pi-ime-slash
```

或者不安装，先试用一次：

```bash
pi -e npm:pi-ime-slash
```

## 依赖

字符替换在所有平台上都开箱可用，**零依赖**。切换输入源是另一件事，且是可选的：

| 平台 | 后端 |
| --- | --- |
| macOS | [`im-select`](https://github.com/daipeihust/im-select) —— `brew install im-select` |
| Linux | 设置 `PI_IME_SLASH_SWITCH_CMD`（例如 `fcitx5-remote -s keyboard-us`，或 `ibus engine xkb:us::eng`） |
| Windows | 把 `PI_IME_SLASH_SWITCH_CMD` 设成你自己的切换命令 |

如果没有任何可用后端，扩展依然会正常替换字符，只会在启动时提示一次。不会有任何功能被破坏。

## 使用

在空输入框里直接打 `、` 即可。想临时开关这个功能：

```
/ime-slash
```

## 配置

全部通过环境变量配置，因此没有配置文件需要维护。

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PI_IME_SLASH` | `1` | 设为 `0` 则本次 pi 启动时该功能处于关闭状态。 |
| `PI_IME_SLASH_MAP` | `{"、":"/","／":"/"}` | JSON 对象，用于替换字符映射表。 |
| `PI_IME_SLASH_ENGLISH_SOURCE` | 自动 | 要切换到的输入源 id，例如 `com.apple.keylayout.US`。 |
| `PI_IME_SLASH_SWITCH_CMD` | — | 自定义切换命令，其中的 `{source}` 会被替换。 |

示例：

```bash
# 切到 US 而不是 ABC
PI_IME_SLASH_ENGLISH_SOURCE=com.apple.keylayout.US pi

# Linux + fcitx5
PI_IME_SLASH_SWITCH_CMD="fcitx5-remote -s keyboard-us" pi

# 顺便把全角逗号也转成半角
PI_IME_SLASH_MAP='{"、":"/","，":","}' pi

# 禁用
PI_IME_SLASH=0 pi
```

`PI_IME_ENGLISH_SOURCE` 作为 `PI_IME_SLASH_ENGLISH_SOURCE` 的旧名仍然可用。

## 实现原理

扩展通过 `ctx.ui.setEditorComponent()` 注册一个自定义编辑器。它继承 pi 的 `CustomEditor`，因此所有应用级快捷键（Esc 中断、Ctrl+D、切换模型……）都保持原样。只有当输入框为空时，它才会拦截这次按键、替换成 ASCII 字符，然后交回默认实现处理。

有两个细节值得说明：

- **它是通过 `super.handleInput()` 替换字符的**，而不是事后改写文本。所以撤销历史、斜杠自动补全、输入法候选框定位的表现，跟你直接按下那个 ASCII 键完全一致。
- **开启了 Kitty 键盘协议或 xterm `modifyOtherKeys` 的终端也能正常工作。** 这类终端会把上屏的字符报告成转义序列而非原始 UTF-8，所以两种编码都会在「首字符判断」之前被解码还原。

扩展只作用于 pi 自己的输入框。对话框类的输入（`/model` 的过滤、设置面板、扩展选择器）不走这个编辑器，因此永远不会受它影响。

## 这个扩展会动你系统里的什么

它不安装任何常驻服务，也没有开机自启：

- **没有后台进程／守护进程／定时器。** 扩展的生命周期就是 pi 本身，退出 pi 它就没了。不写 launchd / LaunchAgent / 登录项。
- **没有 postinstall 钩子。** `npm install` 不会在你机器上执行任何额外动作。
- **唯一的子进程调用是 `im-select`，而且只在你按 `、` 时触发。** 它是一次性命令：执行 → 切换输入源 → 立刻退出。
- **唯一的持久化副作用是「当前输入源」。** 它会把系统输入法切成英文，这跟你自己按一下 Ctrl+Space 是同一件事，不会写入任何配置文件。
- **环境变量不落盘。** `PI_IME_SLASH` 等变量只在当次 pi 进程内有效；想永久生效需要自己在 `~/.zshrc` 里 export。

如果你不希望它碰输入法，只保留字符替换，把切换命令指到一个空操作，或者干脆不装 `im-select`——此时它依然可以正常把 `、` 换成 `/`。

## 开发

```bash
npm install
npm test          # 37 个测试，跑在真实的 pi CustomEditor 上
npm run typecheck
```

测试套件刻意跑在**真实安装的 pi 包**上而非 mock，因此撤销行为、多行编辑、以及编辑器的提交处理都是真刀真枪被验证的。

## 许可证

MIT
