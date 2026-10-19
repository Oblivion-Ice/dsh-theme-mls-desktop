# 设置页与调参位置

> 这一页原本是 README 里的一节，为公开仓库拆出来独立成页；内容与主线一致，
> 交叉引用已改成文件链接。返回 [README](../README.md)。

### 「主题设置」页（设置对话框里那一个 nav cell）

| 控件 | 语义 |
| --- | --- |
| **启用主题** 开关 | **总开关，默认开启**（0.4.4 新增）—— 关掉 = 界面立刻回到 DSH 官方外观：撤掉 token 覆盖层与 `body.theme-marathon`、摘掉背景点阵与两个动画覆盖层、停掉 Token 结算与轮询，并把主题顺手改掉的 DSH 主题偏好还回去；**不卸载、不改 bundles、不重启**。重新打开即恢复。设置页本身**不受它影响**（否则关掉之后就没地方再打开它了，旧版浮动齿轮开关正是死在这里） |
| **每轮 Token 结算** 开关 | 独立开关，**默认开启** —— 关掉就不再贴结算纸条、已有的立刻摘掉、也停止轮询计费接口（见 [docs/BILLING.md](BILLING.md)） |
| **任务完成动画** 开关 | 独立开关，**默认开启** —— 一轮正常结束时播放四拍收尾动画（见下）；关掉即不订阅会话快照、不建节点、不留定时器 |
| **完成文案** + 预览 | 绿色横幅上那行字，默认 `//RUN_COMPLETE`，可改成任意文本（≤48 字）；「预览」立刻重播一次（忽略开关本身，但仍尊重系统「减少动态效果」，并把原因写在那行小字里）。下面一行小字是**触发状态**：已挂上会话订阅 / 等待 sessions 服务 / 已关闭 |
| **背景动画** 开关 | 独立开关，**默认关闭** —— 点阵场是可选效果。它不碰配色：关掉只收起场，配色（也就是整个 UI）停在原地 |
| **主白 + 绿 / 主黑 + 绿** | 单选，二者恒有且只有一个被选中；不论场开不开都会换配色。换另一对时重放 0.341s 马赛克「灌注」 |
| 点阵密度 / 呼吸速度 | 只描述点阵场，场关闭时变暗且 `disabled`，数值保留 |
| **启动动画** 三选一 | 冷启动放哪一套（0.4.10 新增，自己的键 `mar.boot.source.v1`）。**自动**（默认）= 谁先抢到启动帧谁放 —— dsh-splash 的注入行比客户端插件早跑，所以实际总是它，只有它不在时主题才放鲸鱼；**马拉松** = 主题抢帧（宿主半边在 splash 的那些注入行之前 `claim`，它的覆盖层被压掉、退场）；**dsh-splash** = 主题明确让位，splash 不在时这一档就等于"没有启动动画"。**只在下一次冷启动生效**：覆盖层是启动期的东西，站内改不了已经过去的那一帧 |

控件结构与文案与网页版 `dsh-theme-marathon` **完全一致**（`buildPane` 两个文件逐字节相同），
存储键也共用 `dsh-theme-marathon.bg.v1`。0.2.0 起存的形状从 `{mode, scheme, cell, speed}`
变为 `{anim, scheme, cell, speed}`；旧形状读取时自动迁移（`mode: off` → `anim: false` 并保留
它的 `scheme`，`mode: light|dark|green` → `anim: true` + 那一对配色）。
「每轮 Token 结算」与「任务完成动画」是后加的两个独立开关，各有自己的存储键
（`mar.billing.v1` / `mar.done.v1`），与配色那一对互不影响。
「启用主题」总开关是 0.4.4 加的，自己一个键 `mar.on.v1`（`{"on":false}` 才是关；键不存在
或坏值一律按**开**处理，所以升级上来的老用户看到的仍然是从前那套行为）。

### 总开关关掉之后，哪些东西还在

关掉的是**外观**，留下的是**控制面**：

| 关掉后消失 | 关掉后仍在 |
| --- | --- |
| `body.theme-marathon`（整套主题 CSS 都挂在这个类下面） | 主题样式表本身（设置页要靠它） |
| `theme.overrideTokens` 叠上去的那一层 `--dsw` 覆盖 | `html` 上那一份 `--mar-*` 调色板（设置页的控件色） |
| 冷启动启动动画、任务完成动画覆盖层 | 「主题设置」页签与页内所有开关（关着也能改，重开才生效） |
| 背景点阵画布与 `mar-bg-*` 类 | 挂页签用的巡扫 / 观察器 |
| 每轮 Token 结算纸条与计费轮询 | localStorage 里的全部设置 |

关掉时还会：把 `html[data-mar-boot]` 摘掉、把原生窗口按钮叫回来（`dshDesktopBootChrome`），
并把 DSH 自己的主题偏好 `setTheme(...)` 还回主题接管之前的那一档 —— 主题会按配色对把它改成
light/dark，不还回去的话"关掉主题"会把用户的 通用设置 › 主题 永久改掉。
`html,body` 上那行 void 底色（宿主半边 `index.js` 的 `NATIVE_BOOT_CSS`）压不住，
所以关闭态会临时注入 `body{background:var(--dsw-alias-bg-base,#fff)!important}`，
打开主题时撤掉。**冷启动动画按契约只在下一次冷启动时才会放** —— 重新打开主题不会在会话中途
插一段全屏动画。

## 设置页与调参位置

**设置页（设置 ›「主题设置」）按功能分成六组**，每组一个带色块与横线的大标题
（用户 2026-10-10："需要有一个大标题来区分功能"，并参考了同类的 endfield 主题）：

| 分组 | 里面有什么 |
| --- | --- |
| **主题** | **启用主题** 总开关 + 一行状态小字（0.4.4）；关掉时其余五组压暗到 50%，但不禁用 |
| **外观** | 配色（主黑 + 绿 / 主白 + 绿 单选） |
| **启动动画** | 冷启动放哪一套：自动 / 马拉松 / dsh-splash（0.4.10），下面一行状态小字说明这一档当前意味着什么（splash 没加载时会直说） |
| **背景动画** | 启用开关 + **它自己的两项参数（点阵密度 / 呼吸速度）紧跟在下面** —— 关掉时这两行会变暗并禁用（以前开关和参数之间隔着整个"任务完成动画"分组，用户反馈"离得太远"） |
| **任务完成动画** | 启用开关 + 完成文案 + 预览按钮 + 两行小字（预览反馈 / 触发状态与最近一次判定） |
| **每轮 Token 结算** | 启用开关 |

组内行距 10px、组间 24px；小字与输入框左对齐（124px = 标签列 + 间隙）。
改结构就改 `src/client.template.js` 的 `buildPane()` 与 `.mar-set-*` / `.mar-set-head` 那组 CSS；
开发期的自检里有三条断言盯着"分组标题的顺序"与"开关紧贴它的参数行"，改顺序时别把它们改乱。

| 想改什么 | 改哪里 |
| --- | --- |
| 揭幕顺序与时长 | `src/boot/boot.css` 顶部的 `--mb-t-*` 变量（keyframes 与 JS 都读它） |
| 绿鲸鱼的光晕/尺寸 | `src/boot/boot.css` 的 `.mb-logo-top` |
| 蓝色板块停留时长 | `src/boot/engine-intro.js` 的 `HOLD_MS` |
| 动画只在冷启动播放 | `src/client.template.js` 的 `buildBoot()` 开头门控 |
| **启动动画放哪一套** | 设置页「启动动画」三选一；存储键 `mar.boot.source.v1`。归属仲裁在 `src/client.template.js` 的 `buildBoot()`（三档分流）与 `index.js` 的 `BOOT_SOURCE_SCRIPT`（抢帧脚本，作为第一条注入行）。**两处都要读同一把键**，改字面量必须两半一起改 |
| 看门狗兜底时长 | `src/client.template.js` 的 `watchdog`（当前 18s）；抢帧脚本自己还有一条 8s 的"没人画就把帧还回去" |
| 完成动画的四拍时长 / 文案默认值 | `src/boot/engine-done.js` 的 `CFG`（改完必须 `node scripts/build.cjs`；④ 的旋钮都叫 `REVEAL_*`，别与 ① 的 `TILE_SIZE` 撞名） |
| 完成动画的晶格 / 符号尺寸 | `src/boot/engine-done.js` 的 `CFG.UI_CELL`（晶格间距，24px）与 `CFG.UI_GLYPH_SCALE`（符号边长 = 格距 × 该值，0.34 → 8.16px，**与启动动画标记同尺寸**）。想让它再小/再大就只改这两个（线宽会按 `UI_LINE_MIN` / `UI_LINE_SCALE` 自动跟着缩放） |
| 完成动画的线宽 / 线帽 | `CFG.UI_LINE_MIN` / `UI_LINE_SCALE`（线宽 = `max(UI_LINE_MIN, 符号边长 × UI_LINE_SCALE)`，与启动动画标记同一条公式）与 `UI_LINE_CAP` / `UI_LINE_JOIN` |
| 完成动画的黑屏时长 | `src/boot/engine-done.js` 的 `CFG.BLACK_FADE`（矩阵淡出）与 `CFG.BLACK_HOLD`（纯黑静置） |
| 完成动画的开关与文案 | 设置页「任务完成动画」那两行；存储键 `mar.done.v1` |
| 总开关的关/开（拆掉什么、留下什么） | `src/client.template.js` 的 `marSuspend()` / `marResume()` / `marSetEnabled()`；状态键 `mar.on.v1` |
| 总开关在设置页里的样子 | 同一个文件的 `buildPane()` 第一组与 `.mar-set-main` / `.mar-set-pane.mar-off` 那两条 CSS |
| 完成动画的触发判据 | `src/client.template.js` 的 `/* ---- task-completion animation ---- */` 段（DOM 判据 `doneDomPoll` / `doneSameTranscript` / `doneDomInterrupted`，会话面与列表判据 `doneOnFace` / `doneOnList`，收尾复查 `doneSchedule`） |
| 主题配色/组件 | `src/client.template.js`（改完必须 `npm run build`） |
| 背景点阵"谁算底板"的判定 | `src/client.template.js` 的 `bgPaintWalker()` 与它那四个闸：`bgModal()`（浮层/对话框）、`bgLayer()`（absolute/fixed）、`bgComposerSeat()`（作曲区座位，`[data-composer-seat]`）、`bgConversationBody()`（会话本体 `[data-conversation-scroll]`）；再加两条按节点点的豁免 `[data-mlsb-turn]` / `[data-question-reply]`。**加一个"不许清"的节点就加一条 `data-*` 豁免；加一整片区域才用闸** —— 见 CHANGELOG 0.4.5 / 0.4.6 |
| 结算块的宽度/行高/色 | `src/client.template.js` 的 `/* ---- per-turn token settlement ---- */` 段（见 [docs/BILLING.md](BILLING.md)） |
| 价目表 / 峰谷规则 / 法定节假日 | `billing/pricing.mjs` |
