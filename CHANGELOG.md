# Changelog

所有显著改动都列在这。版本号遵循 [SemVer](https://semver.org/)：
主版本号 = 不兼容的 API/视觉变更；
次版本号 = 向后兼容的新功能；
修订号 = 向后兼容的 bug 修复。

## [0.4.12] - 2026-10-31

**「外观」新增第三档「高对比度」——纯黑底、纯白字、2px 描边。**

这次不是"再加一套配色"，而是把"配色恰好两档"这个隐含假设拆掉：
`BG_STATE.scheme` 从二值变三值（`light | dark | hc`），`ui.light` 布尔判定换成
`marSchemeIsLight()`，`mar-bg-light` 那张单类名换成 `marSchemeClass()` 类名表，
高对比度只是又一层 `--mar-*` 覆盖。

### 新增
- **设置 › 主题设置 › 外观** 第三枚互斥单选「高对比度」，存 `scheme:"hc"`（键仍是
  `dsh-theme-marathon.bg.v1`）。旧值 `light` / `dark` 与 v1/v2 的 `mode` 迁移照旧；
  坏值一律降级主黑，不报错、不白屏。
- **`body.theme-marathon.mar-bg-hc`** 调色板（22 条变量）：纯黑 `#000000` 的页面 / 侧栏 /
  代码块底，抬升面 `#101320`，文字纯白，强调填充 `#000066`，强调文字与切档马赛克
  `#9DB2FF`（10.25:1）。背景点阵跟着变白（`BG_MODES.hc`）；任务完成动画横幅改深蓝
  `#000066` 底 + 白字；对话列不画底盘，滚动容器透明、底板由列的 `*_root` 提供，点阵开着时
  露出的是画布（底色 = `--mar-bg-void`），所以仍与左侧工作区同一块板（修「白色对话列 +
  黑色侧栏」的接缝）；品牌 lockup（鲸鱼 + deepseek 词标）在 HC 下纯白、
  无描边（用户 2026-10-31 最终指定：不要深蓝填充、不要描边，和白字对齐）；HARNESS 徽章
  保留 `--mar-accent` 深蓝底 + 白字（否则 `fill:currentColor` 会把白底和白字叠在一起）。
  输入光标（caret）在 HC 下强制白色，黑底上的默认灰光标看不清。对话区里"上传的文件"
  的引用 chip 与文件卡图标也强制白色（用户 2026-10-31；chip 原本走 business-primary，
  在这一层是深蓝、几乎看不见），卡片底板仍是 `--mar-bg-panel`。
- **`--mar-rule`**：所有可见描边的新出口（基值 = `--mar-line-faint`，两个旧档观感不变）。
  `MAR_TOKENS` 里 7 条纯边框 token 改指向它。`--mar-line-faint/strong` 继续只当底色
  （inline code / skeleton / citation），不会被抬成中灰块。
- 高对比度下 `#root *` 的 `border-width` 统一 2px（启动 / 完成覆盖层在 `#root` 外，
  保持自己的 1.5px / 3px 几何，所以"启动动画不动"）。

### 修复：点阵只在对话区最上方一条
第一版为了"对话列和侧栏同色"，把转录的滚动容器 `[data-conversation-scroll]` 整块刷成了
`--mar-bg-void`。颜色是对了，可它是一块**不透明底板**：画布在 `#root` 之下，从 header
往下整块被盖住，呼吸点阵只剩 header 那一条还在动 —— 用户 2026-10-31 报的
「背景动画只在对话区最上方显示」。现在这个容器只声明 `background-color:transparent`，
底板交还给对话列的 `*_root`：点阵开着时它挂 `.mar-bg-clear`，露出画布（`--mar-bg-field`
= `--mar-bg-void`，三档都是）；点阵关着时它自己画 `--dsw-alias-bg-base`（同样是
`--mar-bg-void`）。两种状态都和侧栏同色，而且不再有任何东西挡在画布前面。
验收：`pack/field-full.cjs` 在真实 Chromium 里跑**真实 client.js**（真实画布 + 真实
`.mar-bg-clear` 标记），对转录 20% / 50% / 80% 三处做像素计数，并复现旧规则被挡住的情形。

### 设计决定：强调靠描边，不靠颜色
`#000066` 压在纯黑上只有 **1.19:1**，`#101320` 只有 1.14:1 —— 这套配色的"高对比"实际由
三样东西撑起来：纯白字（21:1）、`#6E7590` 的 2px 描边（4.61:1）、`#9DB2FF` 的浅蓝强调
文字（10.25:1）。所以 `--mar-accent` 只做填充、永不做文字；凡是"靠填充变色表达状态"的
控件都补了可见边界：侧栏选中行 / 新会话（左侧 2px 浅蓝条）、设置页选中段按钮（2px 边框）、
结算纸条头部（内描边）、`focus-visible`（2px）、`::selection`（浅蓝底黑字）、开关与滑杆的
选中态。`--mar-solid-ink` 在这一层被重声明为白色 —— 它是
`--dsw-alias-label-primary-foreground/-inverted` 的源，不重声明就是黑字压深蓝（1.19:1）。

### 已知边界
- 高对比度只有深色一套，没有浅色变体；它**不挂** `.mar-bg-light`，所以完成动画的
  `--md-ink` 与 HARNESS 徽章 rect 不会被误翻。
- 2px 描边会让真正有边框的盒子每边 +1px；设置页行距 / 列表行高 / 作曲区按截图复核过，
  没有错位。
- 网页版 `dsh-theme-marathon` 未同步：两边 `buildPane()` 从这一版开始分叉。

## [0.4.11] - 2026-10-31

**修「桌面端更新后第一次启动一定不透明」——把补丁的落地时机从"下次启动"挪到"重启之前"。**

背景（44.7.0 实测）：`transparent: true` 是 `new BrowserWindow(...)` 的创建参数，只存在于
壳的 `app.asar` 里。桌面端一更新，安装器就把这个包换掉，于是它紧跟着重启的那个窗口必然是
原版壳 = 不透明。插件对此无能为力：它是窗口建好之后才被加载的（实测 11:06:49 启动、
11:06:52 才探测到 stock），原来那条路要 `apply.cjs` 抽出 16.6k 个文件再重打包，实测 85 s，
窗口早就画完了。CHANGELOG 0.4.9 里把这写成"补丁固有的下一次启动生效"，这次不再接受。

### 新增
- **`shell-patch/fast.cjs`** —— 同样的三条改动，只换打包方式：读头部 → 内存里改三个文件 →
  按偏移顺序流式复制数据区、把新内容就地拼进去 → 重建头部 → 校验 → 原子 rename。
  实测 **~1.0–1.3 s**（`apply.cjs` 同机 85 s）。产物与 `apply.cjs` **逐字节一致**
  （`tools/verify-fast-patch.cjs`：三个文件 byte-identical + 抽样 6 个未改动条目相同 +
  条目数相同 + `probeShell` 报 `current`，ALL PASS）。
  - 校验不打折：同一套锚点/唯一命中/stale 拒绝，新正文必须带 marker、必须 `node --check`
    通过、revision 注释必须读成 `current`，staged 包必须能重新解析且抽样条目与源逐字节相等。
  - 顺带丢掉 18.2k 条 `integrity` 元数据 —— `asar.createPackage` 本来也不写，壳能正常加载；
    留着反而会让头部声明一个改过的文件不再具备的哈希。
  - 备份改成**硬链接**：提交是 rename，链接仍指向原 inode，170 MiB 不必抄一遍；
    只有 rename 被占用而退回就地重写时，才先把它实体化。
- **`shell-patch/sentinel.cjs`** —— 插件宿主每次加载时拉起、detached、随应用退出后多活
  180 s 的看守进程：宿主没了（= 正在安装更新）就进入守卫，每隔 250 ms 看一次 `app.asar`，
  一变就补；补不上（文件还在写）就每 200 ms 重试，最多 8 s。只有一个实现（锁文件），
  不改快捷方式、不写注册表、不装计划任务。
  - 它同时负责"现在就是 stock"的那种情况（安装器跳过生命周期脚本、或上一次没补上）：
    启动即补，于是最坏也只是"这一次启动不透明"，而不是"一直不透明直到你想起来重启"。
  - 只认自己所在的那个安装（`insideApp`），`dsh web` 不会去改桌面端的包；
    `DSH_THEME_AUTO_PATCH=0` 依旧总开关；stale 修订只记日志、绝不 `--repair`。
- `index.js` 的钩子改为**始终**拉起 sentinel（不再只在 stock 时拉起 `auto.cjs`）：
  stock 时它立刻补，patched 时它守着下一次更新。

### 已知边界
- 补丁窗口 = 安装器写完 `app.asar` 到它 `CreateProcess` 之间。本机模拟
  （把 stock 包覆盖上去）从覆盖开始到 `probeShell` 读成 `current` 约 **1.5 s**。
  若某天安装器把这个间隔压到 1 s 以内，那一次启动仍会不透明 —— 兜底是下一次启动正常，
  以及 sentinel 在加载时已经补好。要彻底消掉这最后一段，只能改系统级启动入口，
  那是用户明确排除的方案。
- 不解决"更新换掉了壳的 IPC 结构"（锚点失配）：那种情况 `fast.cjs` 会整条拒绝、什么都不写，
  sentinel 只记一行日志，需要人来更新 `patches.cjs`。

## [0.4.10] - 2026-10-18

**「启动动画」变成可选的：自动 / 马拉松 / dsh-splash。**

背景：装上 dsh-splash 之后，两套启动动画谁该出场一直是**竞速**决定的 ——
splash 的覆盖层和它的 `claim("dsh-splash")` 都是注入行，比任何客户端插件都早跑，
所以永远是它赢，主题的鲸鱼连建都不建（0.4.8 就是这么"让位"的）。用户要的是自己选。

### 新增
- 设置页 **「启动动画」** 分组（第三个分组，紧跟「外观」），三选一单选：
  - **自动**（默认）—— 历史行为，谁先抢到启动帧谁放（实际是 dsh-splash；它不在时马拉松放）；
  - **马拉松** —— 主题抢帧：`index.js` 新注入的 `BOOT_SOURCE_SCRIPT`（行表里的第一条
    `script` 行，排在 splash 的行之前）先 `claim('dsh-theme-mls-desktop')`，splash 的
    claim 于是被拒（它只在 owner 为 `'legacy'` 时才抢占），它的覆盖层也被壳补丁那条
    `html[data-dsh-boot-overlay] body > *` 规则藏住；
  - **dsh-splash** —— 主题明确让位：自己不放、也不接管（splash 不在时这一档就是
    "没有启动动画"，这是选择本身的意思）。
- 存储键 `mar.boot.source.v1`（`'auto' | 'marathon' | 'splash'`），客户端与宿主半边
  **读同一把键**。**只在下一次冷启动生效**，设置页那行小字会直说。

### 安全网（帧被抢走却没人画，等于应用整层隐藏）
- 抢帧脚本过与客户端同一套闸：主题关着 / 不是冷启动（`navigation.type !== 'navigate'`）/
  `mar.boot.played` 已写 / 系统「减少动态效果」—— 任何一条命中都不抢帧。
- 8s 看门狗：`#dshMarBootHost` 没被建起来（主题没激活 / payload 缺失）就把帧还回去，
  绝不留给壳补丁那条 120s 硬释放。
- 客户端每一条"不放了"的出口（`reduce` / 已播过 / 非冷启动 / `!BOOT_PAYLOAD`）都
  `bootReleaseFrame()`；`teardown()` 与 `dispose()` 也还帧。
- 交还帧之前先把页面上残留的 splash 覆盖层收成"已退场 + `display:none`"：壳补丁只在
  占帧期间隐藏 body 子节点，帧还回去的那一刻它会重新可见（否则就是"球体接在鲸鱼后面"）。
- splash 已经用 `[data-dsh-boot-overlay-host]` 豁免了自己时，把那个标记摘掉 ——
  那是壳补丁唯一会放行的例外。

### 实测
- `tools/ms-master-switch/verify-boot-source.js` 新增 **45 项**：三档归属（含
  "marathon 遇到别的 API 占主不抢"）、非冷启动/卸载还帧、设置页三选一与持久化、
  配色单选组不受影响、以及宿主脚本本身在 jsdom 里的 12 条行为。
- 原 `verify-master-switch.js` **85/85** 不变（默认 `auto` 即历史行为）。

## [0.4.9] - 2026-10-18

**启动覆盖层期间，应用不再有元素漏在动画外面（工作区标题与那两个按钮）。**

splash 透到壁纸之后才看得见这一层：`#root` 明明已经是 `visibility: hidden`，
工作区的 `sectionLabel` 文案和右侧的 icon 按钮却还画在动画上。原因是 `visibility`
虽然继承，**后代可以自己再声明 `visibility: visible` 顶穿它**（实测 14 个元素：
`span._9lTDKa_sectionLabel`、`div._9lTDKa_headerActions`、两个 `button._9lTDKa_iconButton`
和它们的 svg 子节点）。

### 修复
- 新增 `marOverlayHideCssOn()`：只在外层有人 claim 启动帧时生效的一张样式表 ——
  `html[data-dsh-boot-overlay] body *{visibility:hidden!important}`，再显式放行覆盖层
  宿主（`[data-dsh-boot-overlay-host]` 与 `#dshMarBootHost` 及其整棵子树）。
  与主题总开关无关（平时是一条空转的规则），`dispose()` 里撤掉。
- 它刻意**不走 `insertCss()`**：那个函数会先删掉所有 `style[data-plugin=PLUGIN_ID]`，
  第二张表走它会把主题自己的样式表一起带走 —— jsdom 套件里 “host content column
  hidden” 当场变红，就是这条抓到的。
- 壳补丁里那条 `body > *` 保持原样、**revision 不变**：改它会让安装副本变 STALE，
  得在应用停止时 `--repair` 才能落地，收益与风险不划算；客户端这张表覆盖同样的场景。

### 实测
- 主题 **85/85**（新增 H 节 8 项：样式表注入、无 claim 时为空转、claim 时后代被压住、
  覆盖层宿主与画布仍可见、release 后恢复、dispose 撤干净）。
- splash claim **35/35**、共享壳首帧 **27/27** 不变；壳补丁 `--check` 仍是 `PATCHED`。

## [0.4.8] - 2026-10-18

**修「dsh-splash 开着却什么都没出现」：主题的启动动画给 splash 让路。**

实测原因两层：
1. 主题的客户端 bundle 比 splash 的注入行先跑，给 `<html>` 打了 `data-mar-boot`；
2. 主题 boot payload 里的 `html[data-mar-boot] body > *{visibility:hidden}` **把 splash 的
   覆盖层整个藏掉了**；同时共享壳的 `owner()` 报 `legacy`，splash 的 `claim()` 被拒 →
   它的 `data-transparent` 永远加不上。用户看到的是鲸鱼，或者干脆什么都没有。

### 修复
- **主题主动让位**：`buildBoot()` 发现页面上有 `[data-dsh-splash]` 就不再建覆盖层（除了
  原来的 `dshBootOverlay.owner()` 判据）。两层判据一起用，谁先跑都不会两套动画同时放。
- **splash 侧接管**（改在 dist/host/index.js 的 claim 脚本）：`claim('dsh-splash')` 若因为
  `legacy` owner 被拒，就先拆掉 `#dshMarBootHost`、清 `data-mar-boot`、调
  `__mbMarathon.stop()` / `__mbIntroStop()`，然后重新 claim → 自己拿到帧并设置
  `data-dsh-boot-overlay-host` + `data-transparent`。**别人通过 API 占着帧时不抢**。

### 实测
- splash claim 脚本 **19/19**（新增接管路径：legacy owner → 拆主题层 → 停引擎 → 拿到帧 →
  退出仍 release；api owner 场景必须放弃）。
- 主题 **77/77**（G 节新增"页面上有 `[data-dsh-splash]` → 不建覆盖层、不写 `data-mar-boot`"）。
- 共享壳首帧脚本 **27/27** 不变。

## [0.4.7] - 2026-10-18

**壳补丁升级到 revision 2：把「透明启动帧」做成可共享的能力，主题让位给别的启动覆盖层。**

起因：桌面端 10-17 更新后第一次启动白底 —— 更新换掉了 `app.asar`，插件在窗口建好 9 秒后才把补丁
打回去，所以那个窗口是原版壳（不透明）。这是补丁"下一次启动生效"的固有节奏，顺带说明这层能力
只属于壳；这一版把它扩成**共享**的，让 `dsh-splash` 这类启动覆盖层也能用同一份补丁。

### 新增（壳补丁 revision 2）
- **`window.dshBootOverlay`**：`{ version: 2, available, owner(), claim(id), release(id) }`，
  在首帧脚本里实现，页面侧直接可用：
  - `claim(id)` 先到先得；成功后 `<html data-dsh-boot-overlay="id">`，窗口保持透明、原生按钮保持隐藏；
  - `release(id)` 交回帧；应用上屏后由首帧脚本恢复原生按钮；
  - **任何时刻都能 claim**（"把应用藏起来"正是启动覆盖层的语义），每次 claim 自带 **120s 兜底释放**
    —— 插件在动画中途崩了也不会留下"窗口透明 + 应用被藏"的假死状态；
  - 旧的私有信号 `data-mar-boot` 继续被认（`owner()` 报 `legacy`），老主题不需要改。
- **首帧样式多两条**：`html[data-dsh-boot-overlay] …{background:transparent!important}`，以及
  `body > *:not([data-dsh-boot-overlay-host]):not(#dshMarBootHost){visibility:hidden!important}`
  —— 覆盖层占着帧时，应用即使已经挂载也不会从透明覆盖层背后透出来。

### 变更
- **主题的启动动画会让位**：`buildBoot()` 开头发现 `dshBootOverlay.owner()` 是别人时不建鲸鱼覆盖层
  （否则两套动画抢同一个 `html` 属性和原生按钮）。`owner()` 为 `null` 或 `legacy` 时行为与从前一致。

### 实测
- 首帧脚本（从补丁后的 `app.asar` 里抠出来的真字节）jsdom 状态机 **27/27**：首帧透明、claim /
  重复 claim / 错误 release、退出、legacy 通道、两条新 CSS 规则。
- 主题侧新增 G 节 **4/4**：别人占着帧 → 不建覆盖层、不留 `data-mar-boot`；没人占 / 老壳 → 照旧建。
- 全量回归 **75/75**。
- 补丁流程：改完 `--check` 报 `STALE`（只有 dist 文件的 revision 变了）→ `--repair`（先还原 `.bak`
  里的**同版本**原版再打）→ `PATCHED`，三个文件 `ok`。

## [0.4.6] - 2026-10-14

**把转录区从"清底板"走查里整体摘出去 —— 那一类隐患一次收口（用户 2026-10-14 选的做法）。**

0.4.5 只豁免了两个节点（提问卡片、已答气泡）。这一版换成一条**边界**：`bgPaintWalker` 不再
进入**会话本体**（`[data-conversation-scroll]`，类名 `*_scrollBody` 兜底）—— 那块滚动区里除了
内容什么都没有。

为什么可以整块摘出去（按随包样式表逐条核过，不是猜的）：
- 点阵要透出来的那块底板是**面板 root**：`.Dc7zOa_root{background:var(--dsw-alias-bg-base)}`。
  它既是锚点（`bgAnchorTargets`：`centerCol > *_root`），也仍能被 PASS 2 从中列认出来 ——
  这条 prune 不依赖锚点继续匹配。
- `.Dc7zOa_body` / `.Dc7zOa_scrollBody` **根本没有 background**。
- 作曲区座位那条溶解渐变声明在**座位自己**身上（`.Dc7zOa_composerSeat{background:linear-gradient(…)}`
  的那条 `[data-phase=active]` 规则），座位是锚点，照样被清。
- 把两个 bundle 里声明 `--dsw-alias-bg-base` 的规则全扫了一遍：`dsh-client-ui-conversation`
  两处（面板 root + 一个 24x24 缩略图），`dsh-client-ui-chat` 两处，都是**小尺寸的 sticky 行头**
  （高度 < 200，本来就够不着 bgPaints 的门槛）。也就是说：转录区里没有任何"必须透明"的东西。

### 修复
- `bgPaintWalker` 新增 `bgConversationBody()` 边界。它挡住的是一整类，而不是又一个节点：
  又大又不透明的**内容**块 —— 很高的代码块（`--mar-bg-deep`）、大张工具结果卡、展开的长气泡、
  以及截图里那张提问卡片，都曾被清成透明（0.4.3 的产物在测试里正是这样）。
- 0.4.5 那两条 `data-*` 豁免（`data-mlsb-turn` / `data-question-reply`）保留：别的布局下它们
  也可能落在滚动区之外，同时也把"这是内容"写在节点上。

### 实测
- 同一份 jsdom 会话骨架扩到 12 项断言，**红/绿对照**：旧产物上「转录底板 / 代码块 / 工具卡 /
  已答气泡 / 提问卡片被清」五条**全红**（`marked=transcriptPlate | codeBlock | toolCard |
  replyBubble | questionCard | composerSeat`）；新产物 12/12 全过，且不变量写得明确 ——
  被清的只剩**四个锚点**（frame / 中列 / 面板 root / 座位）+ 中列里另一块页面底板（PASS 2 仍工作），
  转录滚动区内**只有座位**（它是锚点）。
- 总开关那套 59 项一起回归：**71/71 全过**。

## [0.4.5] - 2026-10-14

**修「用户提问」卡片在背景点阵开着时变成透明 —— 卡片上的字和底下的转录字叠在一起。**

### 修复
- **提问卡片被背景点阵的"清底板"清掉了。** 用户 2026-10-14 截图：点阵开着时，AI 提问的那张
  卡片没有底板，选项文字与底下的转录文字叠成一片，读不了。
  根因在 `bgPaintWalker` 的 PASS 2 —— 它按「自己画底 + 尺寸 ≥ 200x200」挑页面底板清成透明，
  而那张卡片是**浮在转录之上的内容**：`conversation.composer` 是 `overlay: true` 的 chain
  槽，谁赢谁就挂在**作曲区座位**（`[data-composer-seat]`）里面；卡片自己
  `background:var(--dsw-specific-input-major)`（= 主题的 `--mar-bg-panel`，不透明），
  最高 `min(60vh,520px)`，轻松越过 200x200 的门槛 → 被当成底板清成透明；座位又正压在转录
  尾巴上，于是两张字叠在一起。
  修法：走查**不进作曲区座位**（`bgComposerSeat()`：先认 `[data-composer-seat]` 属性，
  类名 `*_composerSeat` 兜底）。座位本身照旧由 `bgAnchorTargets` 标记（它的溶解渐变靠这个
  才消掉），只是不再往它里面走 —— 里面全是"浮在页面上的面板"，不是页面底板。
- **顺带补上同一类东西：转录里「提问已答」气泡。** 它的根节点带 `data-question-reply`
  （`QuestionReplyBubble`），展开后会超过 200x200；和主题自己的结算纸条（`data-mlsb-turn`）
  一个道理，它是**内容**，不许清 —— 少了这一条，展开的气泡会变透明、回答文字浮在网格上。

### 实测
- 在会话骨架（`#root > app > frame > centerCol > _root > body[data-conversation-content]
  > scrollBody > [转录底板, 已答气泡, composerSeat > 提问卡片]`）上跑 PASS 2 的真实代码，
  几何与底色钉成内联值。**红/绿对照**：改动前的产物上，「提问卡片被清」「已答气泡被清」
  两条断言**失败**（正是截图里那个状态）；改完之后 8/8 全过，同时确认中列 `_root`、
  作曲区座位、转录底板**照旧**被清（点阵没被挡住）。
- 总开关那套 59 项断言一起回归，**67/67 全过**。

## [0.4.4] - 2026-10-14

**加「启用主题」总开关：主题可以关掉了。** 一个开关把整个主题停掉、界面回到 DSH 官方外观，
**不卸载、不改 bundles、不重启**；设置页本身不受影响，随时能再打开。

### 新功能
- **设置页新增第一组「主题」+「启用主题」开关**（用户 2026-10-14："修改为可关闭的"）。
  关掉 = 只拆**外观**那一半：撤掉 `theme.overrideTokens` 叠上去的 `--dsw` 覆盖层（撤层即回
  官方配色）、摘掉 `body.theme-marathon`、停掉冷启动启动动画 / 任务完成动画 / 背景点阵 /
  每轮 Token 结算与轮询、把 DSH 自己的主题偏好 `setTheme(...)` 还回主题接管前的那一档，
  再压掉宿主那行 void 底色。打开 = 就地装回去（`marResume()`），**刻意不重播冷启动动画** ——
  它按契约只在冷启动播一次。状态存 `mar.on.v1`，**默认开**（键不存在或坏值一律按开），
  所以升级上来的用户看到的行为与从前完全一样。
- **控制面（「主题设置」页签 + 页内所有开关）不跟着关。** 这是与旧版浮动齿轮开关的关键差别：
  那次把开关挂在 `body.theme-marathon` 的样式里，一关就把"用来打开的按钮"自己也弄没样式了。
  现在：pane 的 CSS 本来就不依赖主题类；`--mar-*` 调色板同时声明在 `html` 上；
  页签高亮新增 `[data-mar-nav].mar-nav-on`，`.mar-tab-on ...` 那两条也不再挂在
  `body.theme-marathon` 下面（它们都带本插件自己的状态类，误伤不到宿主界面）；
  挂页签用的巡扫与观察器永不拆除。
- 关掉时其余四组**压暗到 50%，但不禁用** —— 关着也能改，重新打开才生效。

### 修复
- **`billingEnabled()` 的顺序隐患**（改总开关时被 jsdom 顺手抓出来）：它读 `BILLING_STATE`，
  而 `BILLING_STATE` 在源码里比"设置页第一次建造"更晚初始化。只要 `apply()` 跑的那一刻设置
  对话框正好开着（刷新时开着设置、或宿主在插件激活前就把对话框挂回来），
  `buildPane → syncPane → billingEnabled()` 就会读到 `undefined.on`，异常顺着 apply 的线性体
  往上抛，把后面所有东西（body 类、启动动画、背景、结算）整段带走 —— 表现就是"主题莫名其妙
  地半死"。读到未初始化时按文档的默认值（开）回答。
- **dispose 漏撤关闭态那条底色补丁**（同上，jsdom 实测）：走 `styles.insert` 时宿主会随插件
  卸载一起撤，走兜底 `<style>` 时没人撤，于是插件都卸了 body 底色还被它压着。现在是 dispose
  的一步。

### 实测
- jsdom 里跑完整状态机，**58 项断言全过**：`apply`（默认开）→ 打开设置 → 点页签 →
  关总开关 → 关着的时候动其他开关（不许把外观漏回来）→ 再打开 → 关着启动 →
  从"关着启动"的状态就地打开 → dispose。覆盖 token 层的叠/撤、body 类、画布、两个覆盖层、
  `data-mar-boot`、localStorage、DSH 主题偏好、pane 与页签的存活性。
- 关闭态那一页单独渲染 + 无头 Edge 截图复核：白底与深底宿主下都读得清，页签高亮仍在，
  其余四组是"压暗"而不是"消失" —— 这正是旧开关死掉的那一类问题，所以必须看一眼像素。
- 验证脚本放在包外（`D:\Develop\tools\mls-master-switch\`），不进发布物。

### 已知边界
- 宿主半边 `index.js` 往文档里塞的那行 `html,body{background:#0B0D0B}` 是**无条件**的 ——
  它跑在宿主进程里，读不到渲染进程的 localStorage。关闭态只用一条
  `body{background:var(--dsw-alias-bg-base,#fff)!important}` 把 body 压回去；
  `html` 那层画布色仍是 void（被 body 盖着，看不见）。原生启动板被它隐藏的那一瞬也照旧。
- 开关是**每个渲染进程各自的 localStorage**，不是全局状态：另一个窗口 / 浏览器要看到
  同一状态，得自己刷新一次。
- 关闭态不重放启动动画；下一次冷启动才会按新状态决定放不放。

## [0.4.3] - 2026-10-11

**安装与卸载文档按实测补墙。只改文档与版本号，运行时行为一个字节没动。**

### 文档
- **README 安装节重写。** `dsh plugin --profile desktop add …` 从"第 ① 步"降级为
  "**别用**" —— 它在桌面端自带的 0.2.0-rc.2 与 npm 全局的 0.1.5-rc.1 上**都是**死路
  （前者靠无人置 `true` 的 `manageDesktopProfile`，后者无条件拒绝），且报错不提任何替代
  路径。替换为不依赖 CLI 的三步：**node 抓 codeload tarball → 解进 `node_modules` →
  补 `bundles`**。
- **README 新增「卸载」节。** 卸载会把磁盘清干净，但**不会把主题从正在运行的窗口里拔掉**，
  详见下面那条实测结论。
- **`docs/INSTALL.md` 新增第〇节「如果你让 AI 代装（在 DSH 会话里）」。** 把"把链接丢给自己
  的 AI 让它装"这条路实测会撞的五道关列成表：github 直连不通 / PowerShell 执行策略挡
  `dsh.ps1`（`npm.ps1` 同理）/ `desktop` 闸门 / 会话沙箱写 `$DSH_HOME` 报 `EPERM` /
  `git clone` 的 schannel 建不起 TLS。并给出**唯一走得通的取包通道**：node 抓 `codeload`
  的 `tar.gz`（实测 454,892 字节，`tar -xzf` 解出 44 文件 / 1,188,203 字节，与仓库一致）。
  同一节还点明 `web_fetch` 顶不上这条路 —— 它只返回文本，`.png` / `.otf` 拿不到。顺带记下
  本地开发用 `link:` 的注意事项（不跑生命周期脚本）。
- **`docs/INSTALL.md` 新增第八节「卸载与残留」。**
- **`docs/INSTALL.md` 第五节补上壳补丁的确切改动面。** 用游标逐文件比对补丁前后的
  `app.asar`，改动**只有三处**：`dsh-web-frontend/dist/index.html`（825 → 3328 字节，
  首帧脚本 + 把透明移交给主题的 `data-mar-boot`）、`lib/main.js`、`lib/preload-app.cjs`。
- **`docs/INSTALL.md` 第二节补一句**：`allowBuilds` 里若留下 `set this to true or false`
  占位符，说明 `pnpm approve-builds` 从没走完、`postinstall` 一次都没跑过。

### 实测结论（本轮新增两条）
- **卸载后动画还在放，不是残留配置。** 2026-10-11 实测：卸载后
  `package.json` 的 `dependencies` / `bundles`、`cordis.yml`、`node_modules/` 三处全部干净，
  宿主半的计费账本 `storages/mls-billing-ledger.json` 最后一次写入停在卸载之前且不再更新
  —— **但「任务完成动画」仍然照放**。原因是**已经注入页面的客户端半活在渲染进程里**，
  卸载只改磁盘配置，不会把它从 DOM/JS 里摘走；**刷新页面 / 重启桌面端即消失**。
  以后遇到"卸载了还有动静"先按这条判，别去翻 `bundles`。
- **别把这个 tarball URL 当 pnpm 依赖 spec。** 插件管理器把依赖写成
  `dsh-theme-mls-desktop@https://gh-proxy.com/…/tar.gz/refs/heads/main` 之后，pnpm 反复报
  `ERR_PNPM_TARBALL_INTEGRITY`（镜像来回重打包，字节不稳定 → 校验和对不上），最后
  `dsh: pnpm printed nothing for 600000ms and was terminated`。要装 tarball 就自己
  `tar -xzf` 解进 `node_modules`。

---

## [0.4.2] - 2026-10-11

**修「任务完成动画」一次都播不出来，以及计费便签认错会话。** 同一个根因：客户端读了
一个**宿主根本没有的字段** —— 会话列表快照的 `current`。源码里它被**三处各自独立**
读取，全部恒为 null。

### 修复
- **`snap.current` 不存在。** 宿主 0.2.0-rc.2 的列表快照
  （`@deepseek-ai/dsh-api-session-controller` 的 `createSnapshotStore`）只有
  `ids` / `byId` / `phase` / `projectionsBySession` 四项。三处读取分别是：
  - `doneCurrentId()`：原先 `(snap && snap.current) ? ... : null` 恒为 null，于是
    会话面 `doneWatchFace(current)` 从不执行（**会话面永不订阅**）、
    `doneWrapCancel()` 从不包装。
  - `doneOnList()` 里**另有一份独立副本** `var current = snap.current ? ... : null`，
    它不调用 `doneCurrentId()` —— 列表的下降沿被
    `if (!current || id !== current) continue` 全数吞掉，`doneEndedRound()` 一次都
    调不到。**这是动画播不出来的直接原因。**
  - `billingDisplayedSessionId()`（每轮 token 结算便签认「当前显示的会话」）：
    `billingTick()` 因此退到「最近有账的那个会话」，会把别的会话的数字贴到当前会话
    的尾巴上；`billingFetch()` 也不再带 `?session=`，宿主不会为当前这段对话回填
    历史账，重启后旧轮次贴不上便签。

  2026-10-11 在真实安装上取 `__marDoneDebug()` 实测：`face: null`、
  `faceSubscribed: false`、`facePublishes: 0`、`lastEnds: []`，而
  `stopped: {<本会话>: false}` 恰好证明列表**看到了**开跑——结束那一步全被吞掉。

  三处统一改为宿主自己的算法：`byId` 里 `retainedBy.mainView > 0` 的那一个
  （DSH 客户端自身有 8 处这么写）。保留 `snap.current` 以兼容真给了该字段的老宿主。
- **顺带去掉 `billingDisplayedSessionId()` 里那次性的 `ctx.get('sessions')` 抓取。**
  服务的注册顺序不保证，抓到 null 就永久失效 —— 完成动画那半边 2026-10-10 已经踩过
  同一个坑。现在每次现取。
- **`doneStateText()` 报假绿灯。** 原先只要有列表订阅就显示"会话面已盯住"，并不检查
  `doneFaceId`；正是这句话把排查往"触发链没问题"的方向带偏了一整轮。现在如实区分
  "会话面未订上 —— 当前会话认不出来"。
- **纯 DOM 兜底判据在虚拟滚动下恒失灵。** 老判据只看上一个尾巴节点的 `isConnected`，
  而 `dsh-client-ui-chat` 的 virtualizer 会回收/重建尾巴节点，`isConnected` 就无规律
  地翻假——实测 `domRenders` 涨 23 次而 `domHits` 恒为 0。改为「容器没变 + 基线当时
  的会话身份没变」，切会话仍能被识别为换转录；容器认不出来时才退回那条老判据。
- **`src/client.template.js` 里一处换行被吃掉的损坏。** `__marDoneDebug()` 的
  `listPublishes:` 整行被并进了上一行注释里，于是诊断输出里一直没有这个字段
  （对照实测输出：其它字段按字母序齐全，唯独缺它）。已修复。

### 诊断
- `__marDoneDebug()` 新增 `domSession`（转录基线建立时的"当前会话" id）。

### 教训
- 同一个事实在源码里被读了三遍（`doneCurrentId()` / `doneOnList()` / 计费半边），
  修一处不够。发版前应当直接 `grep` 那个字段名，而不是只顺着调用链看。

## [0.4.1] - 2026-10-11

**安装文档按实测重写。只改文档与版本号，运行时行为一个字节没动。**

2026-10-11 在一台真实机器上照公开 README 走了一遍完整的第三方安装，发现原文档里三处
与实际不符，逐条改掉，并把可复现的证据写进 [docs/INSTALL.md](docs/INSTALL.md)。

### 修复
- **文档：闸门的真实范围。** 原文说「只有 `dsh plugin` 一条路放行」，实测不成立 ——
  `rejectElectronProfile()` 同样挡在 `plugin` 子命令前。桌面端自带 0.2.0-rc.2 写的是
  `if (!manageDesktopProfile) rejectElectronProfile(plugin, options.profile)`，而
  `manageDesktopProfile` 是 `runCli()` 的函数参数、默认 `false`，随包发布的代码里
  **没有任何地方把它设成 `true`**（扫过 `app.asar` 里 296 个非 `node_modules` 的 JS，
  无命中）；npm 全局 0.1.5-rc.1 则是无条件拒绝。新增按构建分列的可用性对照表，
  并给出**不依赖 CLI 的全手工装法**。
- **文档：pnpm 会把 `postinstall` 判成 ignored build。** pnpm 11 对未列入 profile 的
  `pnpm-workspace.yaml` → `allowBuilds` 白名单的依赖不跑生命周期脚本，报
  `ERR_PNPM_IGNORED_BUILDS` 并让 `dsh plugin … add` **以退出码 1 结束** —— 而依赖其实
  已经装好，症状极具误导性。文档里"装完下一次启动就有全部效果"因此要先放行白名单；
  放行不了的，说明 `shell-patch` 的第二条钩子路径会兜底。
- **文档：人工打补丁找不到非标准安装目录。** 在普通 shell 里跑 `node shell-patch/auto.cjs`
  时，自动发现只覆盖「桌面端子进程环境 / `process.execPath` / 上次缓存 / 平台常规目录」，
  装在别的盘（例如 `D:\Software\DeepSeek_Desktop`）会直接报 `state: unresolved`；
  必须 `--app <安装目录>`。已把解析顺序与这条实测补进 README 的安装步骤与本文档。
- **文档：顺手修掉 `docs/INSTALL.md` 里指向自己的链接**（README 拆页时留下的残留），
  并去掉一处把两代 dsh 机制混写的解释 —— `reconcilePlugins` 只存在于 0.1.1-rc.2 的
  `plugin-9h8shc4d.js`，`runProfilePnpm` / `runPluginCommand` 只存在于 0.2.0-rc.2。
  现在改成按当前构建的源码说话，并保留「不管哪一代，desktop 都不会被写 `bundles`」
  这个实测结论。

## [0.4.0] - 2026-10-10

**新增「任务完成动画」**：一轮任务正常结束时，在正常界面之上叠一层四拍收尾动画 ——
反向红 S 扫屏 → 矩阵像素定格 → 渐变为黑 → 纯黑方块逐块硬切、露出正常界面并衔接墨色点阵、
绿色横幅展开；最后那一屏必须**点一下鼠标或按任意键**才消失。

### 新增
- **覆盖层 payload**（`src/boot/done.html` + `done.css` + `engine-done.js`，由
  `scripts/build.cjs` 内嵌成 `client.js` 的 `DONE_PAYLOAD`）：与启动覆盖层同一套注入契约，
  独立 host `#dshMarDoneHost`（z-index 比 `#dshMarBootHost` 低一档）、独立 id 前缀 `md-`。
- **四拍时间线**（`engine-done.js` 的 `CFG`）：
  ① 反向红色 S 扫屏 —— 与启动动画同一条 S 路径**倒过来**（zone2 R→L → zone1 R→L 反向 →
  zone1 L→R → zone0 R→L，右下起、左上收），分块粒度与 `RED_RISE/RED_HOLD/RED_EXIT` 系数
  与启动动画逐字一致；
  ② 矩阵像素定格 —— **参数取自用户的 `网格符号测试.html`**：晶格 **24px**、符号 **12px**
  （`GLYPH_SCALE 0.50`）、线宽 **1.4px**、圆头圆角、**符号不贴边**；**判的是「格位」**
  （整格落在哪块地盘才算它的），四块地盘互相让出整整一格空档。四种符号只换形状：
  侧栏红十字、输入框红方框、输出文本区墨方框、其余空白墨实心圆。
  **矩阵跟着红扫逐块亮起**：某一块的红一开始溶解，那一块的矩阵就在它底下淡入；
  ③ 渐变为纯黑；
  ④ 80px **纯黑硬切方块**（与「配色切换」同一尺寸、同一套 `mosaicOrder` 乱序、JS 驱动）
  逐块消失，露出来的就是底下的正常界面；随后墨色点阵（`任务完成动画.html` 那片会漂移会
  闪灭的点阵，去掉了原稿的 `#04060a` 底色与暗角/扫描线，因为它要浮在界面之上）接上，
  再约 1s 绿色横幅自左向右展开。
- **触发**：`ctx.get('sessions').list` 快照里**当前会话**的 `running`（与应用的回合状态、
  停止按钮、侧栏绿点同一权威位），只认 `true → false` 边沿，每个会话第一个读到的值只作
  基线；**用户按停止**、**收尾 assistant 节点带 `interrupted: true`**、**失败收尾
  （`turn-error`）**都不播；落点后 350ms 再复查一次（连续追问 / 队列续跑让位），播放期间
  又开一轮则整段收掉。
- **关闭**：`document` 捕获阶段的 `pointerdown` / `keydown`，任意时刻按下即整段跳过。
  这一层始终 `pointer-events:none` —— 那一次按下不会被吞掉，它同时抵达用户真正瞄准的元素
  （与 `dsh-theme-endfield` 的雷霆大字同款做法）。
- **设置**：浮动抽屉新增「任务完成动画」开关（默认开）、「完成文案」（默认
  `//RUN_COMPLETE`，可改任意文本）、「预览」按钮，以及一行**触发状态**小字（已挂上会话
  订阅 / 等待服务 / 已关闭）；存储键 `mar.done.v1`。尊重系统「减少动态效果」：整段跳过。
- **两套配色都适配**：④ 那一拍浮在**正常界面**上，墨色由 `done.css` 的 `--md-ink` 给出，
  并在 `body.mar-bg-light`（主白 + 绿）下翻成 `#0B0D0B` —— 否则白点阵会画在白色界面上。
  ② 那一拍不吃这个变量：它底下是自铺的黑幕，两套配色下都是"黑幕 + 红十字/红方框/墨符号"。

### 修复
- **触发链根本没挂上**（用户首测："预览能播、真触发不播"）：客户端服务是各插件自己
  `register` 的，`apply()` 那一刻 `ctx.get('sessions')` 还是空的，而原实现只取一次 ——
  订阅于是永远没建立。现在首选 `ctx.inject(['sessions'], …)`（宿主半边挂 `webServer` 用的
  是同一个写法），并保留"现取 + 每 400ms 补挂（约 30s）"这条兜底；`connection/reset` 后
  再补一次。`document` 上还留了一个 `__marDoneDebug()`，一眼能看出订阅在不在。
- **用户按停止不播**：不再只靠收尾节点上的 `interrupted` 标记（那是 projection 的产物，
  这一代构建未必带上），而是就地包一层会话面的 `cancel()`（DSH 停止按钮唯一调用的取消
  动词）—— 直取用户意图；`interrupted` 与 `turn-error` 两条判据都保留。标记只在本轮有效，
  下一轮开始即清。
- **CFG 名字撞车**：④ 的方块尺寸最初也叫 `TILE_SIZE`，把 ① 的迷宫 tile 边长（5）覆盖成
  80 —— 面板划分整个塌成 3 条整幅横带（角度对不上启动动画）。已改名 `REVEAL_TILE` 并加
  check 守卫。真机复现与定位靠 `.generated/probe-done-regions.cjs`。
- **设置页排版**：`标签`槽位 88px 会把「每轮 Token 结算」折成两行（现在 112px +
  `white-space:nowrap`）；开关行的「开/关」也不再被推进那个 58px 的定宽槽、而是紧贴开关。

### 变更（第五轮真机反馈，2026-10-10）
- **矩阵缩小到与启动动画的标记同尺寸**（用户："矩阵似乎有些太大了…与启动动画里蓝扫的大小
  类似"）：符号从 12px 改到 **8.16px** —— 正是启动动画收尾那套标记自己的取值（它的格子是
  `CELL_SIZE 12 × UI_CROSS_STEP 2 = 24px`、缩放取 0.34），线宽也换成它那条公式
  `max(0.9, size × 0.20)`（于是 8.16px 的符号配 1.63px 线）。晶格仍是同一个 24px、相位不变，
  启动动画的收尾标记与任务完成动画的矩阵因此读起来是同一套像素。守卫加了两条：一侧的参数
  变了、或启动动画那侧的 0.34 / 步长 2 变了，都会立刻报红。
- **设置页重新分组、加大标题**（用户："需要有一个大标题来区分功能"，参考同类 endfield 主题的
  分法）：主题设置（大标题）+ 一句话副标题，下面四组 —— **外观 / 背景动画 / 任务完成动画 /
  每轮 Token 结算**，每组一个带色块与横线的大标题；开关行的文案统一成「启用」（分组标题即
  功能名）。组内行距 10px、组间 24px，小字与输入框左对齐（124px）。
- **背景动画的开关与它的参数归位**（用户："背景设置的开关与点阵密度和呼吸速度离得太远"）：
  这三行现在是同一组里紧挨着的连续三行（以前开关和参数之间隔着整个"任务完成动画"分组与配色
  单选），关掉时下面两行照旧变暗禁用。
- 回归：`selftest`（`test/plugin.test.cjs`）新增三条 —— 分区标题必须按
  `外观|背景动画|任务完成动画|每轮 Token 结算` 排列、背景开关必须**紧贴**它的密度/呼吸两行、
  面板必须保留大标题与副标题。

### 修复（第三轮真机实测，2026-10-10）
- **真凶：客户端 `sessions` 服务面没有 `list`**（用户第三次反馈"还是无法触发"）。用 Cordis
  Inspect 向运行中的客户端核实：真机服务面是
  `{ retain, using, retainInfo, refreshProjections, search, fork, scope, binding }` ——
  **根本没有 `list`**。而 `installDone()` 要求 `sessions.list.subscribe` 是函数，否则直接
  `return false`，于是整条触发链**从来没装上**（`pokeDone` 空转 30s 后放弃）——"预览能播
  （预览不需要服务）、真任务永远不播"就是这么来的。现在只要服务面可用就装上，`list` 有就
  顺带订阅。
- **触发主判据换成不依赖会话 id 的 DOM 锚点**：`[data-turn-tail]` 新增一个节点 = 刚结束一轮
  （**计费纸条就是贴这个锚点的，所以它在真机上已经被验证可用**），加上
  `[class*="_turnStatus"]` 从有到无。没有会话面可用时，收尾节点里的"已中断 / 已停止"字样由
  DOM 读出，照样抑制中断收尾。会话面的 `turnEnds` 单调计数器与两条 `running` 边沿都保留为
  额外判据。
- **按了停止不再吞掉正常完成**：`cancel()` 包装只在那**一刻真的在跑**时记"用户按过停止"
  （有些收尾路径自己也会调 `cancel`，原来会把正常完成一起吞掉）；新一轮的上升沿会清掉它。
- **诊断升级**：设置页那行小字会写清用了哪条判据、最近一次判定的结果；每次判定往 console 打
  一行 `[theme-mls] 任务完成动画：…`；`__marDoneDebug()` 多了 `listPublishes /
  facePublishes / faceEdges / domTails / domStatus / lastEnds`。预览按钮也会顺带把触发状态
  贴在下面 —— 一次点击就能读出"为什么没播"。
- **矩阵填满整屏**（用户："矩阵之间有明显的分界线，这些分界线也需要填充上去"）：去掉"符号放
  不下就留空"的判定（它会在 UI 边界上连成一条条空档），改成**按格心归属、每格都有符号**；
  格位与相位不变。像素复核新增"四块地盘加起来的符号数 = 视口内格位数"的断言（实测 480 /
  132 / 1925 / 143，一个不差）。
- **空白区的实心圆缩小一档**（用户："白色圆形实心小点，缩小一点"）：半径 = 符号边长 ×
  `UI_DOT_SCALE`（0.30，即 3.6px，原先是 6px）；方框与十字不变。
- **DOM 判据把"转录挂载"误判成"刚结束一轮"**（用户第四轮：启动动画一结束自己播了一次；
  切回已经播过的会话又重复播）：上一版一看到"回合尾巴数量变多"就触发，而转录**首次挂载 /
  切换会话 / 整屏重绘**都会把历史里的尾巴一次铺出来。现在加两道闸 ——
  ① **同一个转录**：上次看到的尾巴节点还在文档里（说明没人换过转录），或（还没有尾巴时）
  容器还是同一个且仍在文档里；② **先看见回合在跑**（`[class*="_turnStatus"]` 出现过一次）
  之后多出来的尾巴才算结束。挂载 / 切会话只更新基线，并在 console 记一行"转录换了…不触发"。
  回归测试：挂载历史不播、之后真的结束一轮照播、切会话不重复播。
- **回归测试**：`test/done-engine.test.cjs` 新增"服务面没有 `list`"的两条（触发照播 / 中断照
  抑制）与 DOM 判据路径（含上面那三条挂载/切换的用例）；`check.cjs` 为 `installDone` 可用
  服务面的形状、以及 DOM 判据的"同一个转录 + 回合在跑"两道闸加了专门守卫（各带
  `MLS_CLIENT_JS` 变异证明可证伪）。

### 修复（第二轮真机实测，2026-10-10）
- **短任务还是不播**（用户："是不是因为任务时间太短了？"）：上一版只认列表 `running` 的
  `true → false` 边沿，而一轮很短时完全可能**在两次快照推送之间就把整个翻转走完**
  （快照批量推送时更看不到边沿）—— 于是整轮被漏掉。现在盯**会话面**
  （`sessions.binding(id).session`，应用自己的回合状态标签读的那一份视图）的快照里那个
  **单调计数器** `ConversationSnapshot.turnEnds`：**它涨了就是"刚结束一轮"**，中间态有没有
  被看到都不影响；列表的 `running` 边沿降级为兜底（老宿主照样能触发）。会话面订阅随
  "当前显示的会话"切换而重挂，每会话第一次读到的计数器只作基线。jsdom 里新增两条测试：
  "列表一次 `running=true` 都没推、只有计数器涨了 —— 必须照播"、"第二轮也得各有一次"。
- **矩阵改成跟着红扫逐块亮起**（用户："红扫后应该就可以逐渐看到背景了，而不是红扫完成了过
  一会才显示矩阵"）：原来是"红扫整个走完 → 等 40ms → 整屏矩阵同时淡入"，中间那一段是死的
  黑屏。现在 `paint()` 把画布按 **黑底 → 矩阵 → 红块** 三层重画，矩阵的每一格按**它所在那
  一块红扫面板**的进度淡入（`regionMarkAlpha` 读 `r.holdEnd`）：红扫走到哪一块，那一块的
  矩阵就在它底下亮起来，红块仍然盖在上面。`MARK_AT` 因此提前到第一块的 `holdEnd`，
  `MARK_DONE` = 最后一块铺满。像素复核里加了可证伪的一条：红扫还在跑时矩阵已出现，
  且**只出现在下半屏**（最先被扫过的地带）。
- **矩阵参数与"格位"重做**（用户："现在的矩阵密集，且排列不规范"，并给了
  `网格符号测试.html`）：换成参考页的 **24px 晶格 / 12px 符号 / 1.4px 线宽 / 圆头圆角**，
  并把判定从"符号实体"改成**「格位」**—— 整格（24px 见方）落在哪块地盘里才算它的，
  于是四块地盘互相让出整整一格空档、符号永不贴边也永不互相咬，放不下的格**留空**而不内缩
  网格。实测四块地盘 pitch 全 24、phase 全 0，符号数 380 / 93 / 1782 / 84。
- **黑屏时间加长**（用户："矩阵后逐渐变黑的时间可以再延长一点，多留一点'黑屏'的时间"）：
  `BLACK_FADE` 600 → **900ms**，并新增 `BLACK_HOLD` **700ms** 的**纯黑静置**再开始逐块揭示
  （`TILES_AT = BLACK_AT + BLACK_FADE + BLACK_HOLD`）。
- **触发链再加一层可见性**：设置页那行小字现在会带上**最近一次的判定结果**（已播放 /
  新一轮已经开跑，跳过 / 那轮是停止·中断·报错收尾 / 刚结束的那轮不在当前显示的会话里 / …），
  `__marDoneDebug()` 也多了 `faceSubscribed` / `turnSeen` / `last`。以后再"没触发"，
  页面上直接写着原因。

### 工程质量
- `test/done-engine.test.cjs`（jsdom，`npm run test:done`）：基线静默、边沿触发、
  **订阅迟到**（`ctx.inject` 回调 与 无 inject 时的补挂轮询，两条路各测一遍）、
  **短任务**（列表一次 `running=true` 都没推、只有会话面 `turnEnds` 涨一轮 —— 必须照播）、
  每一轮各有一次、列表边沿单独也能触发（兜底）、
  用户按停止（`session.cancel`）抑制且不泄漏到下一轮、中断/报错抑制、中途 interrupted 但
  收尾正常的那一轮照播、新一轮让位、点按关闭、开关关掉 / `prefers-reduced-motion` 都不挂载、
  无 sessions 服务也能 apply、dispose 退订并摘掉覆盖层，以及"24px 晶格 + 矩阵跟着红扫 +
  反向 S 顺序与启动动画同系数 + CFG 不撞名"的结构断言。
- `.generated/verify-done.cjs`（无头 Chromium + 假 DSH DOM + 像素读回，按 `.gitignore`
  不入库）：1600x952 下按真机几何搭 rail 276 / `RlGAzG_card` 780x94 贴底 /
  `[data-conversation-scroll]`，然后逐拍断言 ——
  红扫 150ms 时只有右下那一块是红的、结束前 200ms 只有左上那一块是红的（方向可证伪）；
  **矩阵跟着红扫亮起**（红扫还在跑时矩阵已出现 250 个十字，且最上面的十字 y=335 —— 只在
  下半屏，即最先被扫过的地带）；
  四块地盘的符号**都在 24px 晶格、同一相位**（pitch 全 24、phase 全 0；侧栏 10 列 / 输入框
  31 列 / 输出区 54 列 / 空白 21 列），十字 380 + 红方框 93 + 墨方框 1782 + 墨点 84，
  全部零越界、空白点零侵入任何一块地盘；黑幕那一拍 1523200/1523200 像素全黑；硬切方块
  240 块（中途 120 开 / 120 未开，同一帧里既有黑块也有界面本色）；绿色横幅 96448px
  完全展开、不透（点阵不穿透）、下方界面仍可读（107 万像素是界面本色）；切到主白 + 绿后
  墨色翻成 `#0B0D0B`、墨点仍在（195 个暗点）且白点归零。
  ①②③ 与方块揭示都是时间的纯函数（方块由 JS 驱动，不是 CSS 动画），用 `__mbDone.seek()`
  （测试专用 hook）按 16ms 小步重放抓帧；只有横幅的 CSS 展开走墙钟，必须实时采样 ——
  截图会晚到 300-600ms，那是唯一能把"最后一拍"拍准的办法。
- `check.cjs` 新增一组完成动画守卫（payload 内嵌 + 反向循环 + 红扫系数 +
  网格符号测试页的三档矩阵参数（`UI_CELL` 24 / `UI_GLYPH_SCALE` 0.50 / `UI_LINE_WIDTH` 1.4）
  + 格位判定 + 矩阵跟着红扫 + 四块地盘配色 + 三层绘制顺序（黑底→矩阵→红块）+ 渐黑与纯黑静置 +
  硬切方块（并禁止 `backdrop-filter`/玻璃回归）+ `--md-ink` 双配色 + 捕获阶段关闭 +
  迟到挂载 + **`turnEnds` 单调计数器**），`.generated/falsify-check.cjs` 用 **15 个变异**
  逐个证明它们**真能变红**（走 check.cjs 自己的 `MLS_CLIENT_JS` 临时副本通道，
  不再改写 client.js）。
- 诊断工具（`.generated/`，不入库）：`probe-done-regions.cjs`（把面板/晶格的真实几何打出来
  —— 上面那条撞名就是这么抓到的）、`dump-done-engine.cjs`（从 client.js 里抽出内嵌 payload
  源码）、`scan-asar.cjs`（按字节扫 `app.asar` 里的 token，用来确认 `interrupted` 的真实
  写法与来源）。

## [0.3.1] - 2026-10-10

**修启动动画末尾的两块红色标记**：方框点阵不再压在左侧栏的十字上，也不再铺到输入框之外。

### 修复
- **输入框方框点阵改用真卡片**：`uV2eYG_card` / `uV2eYG_root` 这两个锚点在当前
  `app.asar` 里**一个字节都不存在**（全量扫描 0 命中），所以方框一直落在
  `composerStack` / `composerHero` 上 —— 那是**整段条带**：hero 相位实测 903x264，
  而卡片只有 780x118。现在由 `composerRect()` 按"类名 token 以 `_card` 结尾"
  （现役构建 `RlGAzG_card`，`fileCard` / `cardWorkspaceTrigger` 因此被排除）
  在 composer 栈里就地量出真卡片，旧的整段条带只作兜底。
- **方框不再进侧栏**：落点先与侧栏矩形对一次，**连符号实体（含线宽）碰到侧栏的整格
  直接丢弃** —— 只判中心点不够：中心差一格时方框的边仍会压住十字臂尖（实测这种
  漏网的有 3 格）。窄窗口（<1024）下把侧栏展开压在中栏上时，条带会伸到侧栏底下，
  实测这一条能拦下 48 个越界格；十字保住自己的地盘，两块标记不再重叠。
- **方框不再探出卡片**：只有整格（含线宽）都在卡片矩形内的点才画，方框网格变成
  卡片内一圈整齐的内缩点阵（780x118 卡片 → 31x4 格），「超出应有的区域」消失。

### 工程质量
- `check.cjs` 新增 3 条守卫（`cardIn` / `composerRect` 存在、按符号实体对侧栏做减法、
  `drawComposerBox(alpha, rect, avoid)` 参数形状），复现旧行为即变红。
- 判定依据可复核（都在 `.generated/`，按 `.gitignore` 不入库）：
  - `png-scan.cjs` / `png-profile.cjs` / `png-map.cjs` / `png-decode.cjs`：把启动帧
    解码成像素分布与文本布局 —— 真机帧 `boot3-frame-029` 即"侧栏十字 x[0..276] 满高
    + 方框铺到 x=1381、高 264"的那一帧；
  - `asar-ls.cjs` / `cls-find.cjs` / `css-find.cjs` / `css-dump.cjs`：在 `app.asar`
    里反查真实类名与布局 CSS（`uV2eYG` 正是这样确认 0 命中的）；
  - `verify-marks.cjs`：无头浏览器里按真机几何搭一套 DSH DOM（rail 276 宽、hero 条带
    903x264 里放 780x118 卡片、active 卡片贴底、以及"卡片类名不可得 + 侧栏压住中栏"
    三种场景），跑完启动动画末尾那一拍，把像素按**连通域**分类成十字/方框（靠四角
    是否着色区分），断言：十字都在侧栏内、方框都在卡片内、两者零重叠。
    修复前（`--old`，把两处修改还原）必须变红，实测：hero 232/360 个方框探出卡片、
    active 63/159 个探出、overlay 48 个压在侧栏上；修复后三种场景全部 PASS。


## [0.3.0] - 2026-10-09

**内置「每轮 token 结算」**：每一轮任务结束后，在它的轮次尾巴上贴一张结算小纸条
（`TOKEN USAGE` 绿条 + 八行明细 + 灰色「任务用时」条）。计费不再是独立插件。

### 新增
- **计费半侧**（`billing/`，ESM，由 `index.js` 动态 import）：逐笔 token 折叠
  （`fold.mjs`）、DeepSeek 官方分时价目表与峰谷判定（`pricing.mjs`）、日账/会账
  与原子写（`ledger.mjs`）、装配与只读接口（`host.mjs`）。
- **结算块**（客户端）：贴在 `[data-turn-tail="<轮次号>"]` 的动作行之前 ——
  跟着转录滚动、切会话随转录销毁，没有跨会话状态。
- **接口**：`GET /dsh-mls-billing/state`、`/health`、`POST /balance/refresh`、
  `GET /backfill?session=<id>`（同源/回环栅栏，凭据不下发浏览器）。

### 计费口径
- 四桶互不重叠：未命中（`inputTokens`）、命中（`cacheReadTokens`）、缓存写入
  （按**未命中**价）、输出（**已含** reasoning）；命中率 = `hit / (hit + miss)`。
- 高峰 = 周一至周五（不含中国法定节假日）北京 09:00–12:00、14:00–18:00；
  周末与法定节假日全天为谷价（生效分界：周末 2026-08-23、节假日 2026-09-19）。
- 定档时刻用 `step/end.time`；钱在**读取时**按当前价目表算，历史峰谷档不被篡改；
  未定价模型单列（`UNPRICED`，走告警色），不静默算进总额。
- 「任务用时」= `turn/end − turn/start`，`turn/end` 之后**冻住**（DSH 自己的页脚两种模式都不显示耗时）。

### 交互与外观
- 尺寸只有一个旋钮 `--mlsb-s:1.5`；居中；绿条只有 `TOKEN USAGE` + 左右两个黑色十字；
  圆角 6px×缩放（展开时绿条下方直角接面板、面板下方圆角）；绿条与灰条之间留 5px；
  字体回到宿主默认栈（数字仍走等宽栈）。
- 动效：落地时**从中间向两端展开**（`clip-path`，`.18s`）；展开/收起走
  `grid-template-rows:0fr → 1fr` + 透明度（`.2s`）；`prefers-reduced-motion` 下全部关闭。
- **主题设置里多一个开关**「每轮 Token 结算」（`localStorage['mar.billing.v1']`，默认开）：
  关掉立即摘掉所有纸条并停止轮询。

### 修复
- **重启桌面端后当前这段对话没有纸条**：
  ① 账本新增**逐轮**数据（每会话最近 40 轮），启动时回填；
  ② 贴纸前用 `ctx.get('sessions').list.current` **精确**判断"客户端显示的是哪段对话"，
  避免把另一段对话的数字贴到本段尾巴上；
  ③ 本功能上线**之前**跑过的轮次按需回填：客户端带 `?session=` 来，宿主用
  `ctx.sessionPersistence.readFrom(id, 0)` 重放日志补出逐轮数据（走 DSH 自己的服务，
  不碰磁盘格式；每会话一次、8s 超时、失败静默）。
- 余额失败只缓存 10s（原先 60s），避免"启动时账号服务还没就绪"导致界面上一分钟读不到余额。

### 工程质量
- 新增测试：`npm run test:billing`（43 项：价目表/峰谷、折叠含用时与空轮次、账本容错、
  宿主装配与栅栏、回填）+ `npm run test:billing-ui`（35 项 jsdom：落位、八行口径、
  用时冻结、圆角/间隙/尺寸、动画、开关、会话精确匹配）；`npm test` 113 → 116 项
  （新增主题设置面板里的开关回归）。
- `check.cjs` 全绿（含 accent-as-text、直角豁免、背景清场放行结算块等既有断言）。
- `docs/COMPATIBILITY.md` 与 `docs/ASSET_POLICY.md` 改为中文，并补上计费半侧的宿主契约。

## [0.2.0] - 2026-10-08

「主题设置」页与网页版对齐：点阵动画变成独立开关，两组配色成为互斥单选。

### 变更
- **背景动画** 从原来的三段式 `关闭背景动画 / 主白 + 绿 / 主黑 + 绿` 里拆出来，成为
  **独立开关**，**默认关闭**（新装 / 清空 `localStorage` 后不播放点阵场）。
- **主白 + 绿 / 主黑 + 绿** 变成单选组：恒有且只有一个被选中，与动画开关互不影响 ——
  关掉动画不会把配色弹回主黑 + 绿，换配色也不会顺带把动画打开。
- 状态模型由 `BG_STATE.mode (off|light|dark)` 拆成 `BG_STATE.anim`（布尔）+
  `BG_STATE.scheme`（light|dark）；`bgApplyMode` / `bgDraw` / `bgStart` / `bgKick` /
  `sweepReveals` 全部改读新字段。
- 存储形状 `dsh-theme-marathon.bg.v1` 从 `{mode, scheme, cell, speed}` 变为
  `{anim, scheme, cell, speed}`；旧形状读取时按语义迁移（`mode: off` → `anim: false` 且
  保留 `scheme`，`mode: light|dark|green` → `anim: true` + 对应配色）。
- 点阵密度 / 呼吸速度在场关闭时变暗且 `disabled`；面板在挂载时就同步当前状态（不再等到
  第一次点击 tab）。
- 换配色只在真的换了另一对时重放马赛克灌注。
- 面板结构与文案与网页版 `dsh-theme-marathon` 的 `buildPane` **逐字节一致**（顺带补上了
  桌面版缺的 `.mar-val` 数值样式）。

### 工程质量
- `check.cjs` 与 `test/plugin.test.cjs`（113 项）增加与网页版相同的断言：
  默认关闭、四种存储形状迁移、配色单选组、旧 `data-bg=` / `aria-pressed` 不得回来、
  以及通过真实面板控件驱动的「开关不影响配色 / 配色不影响开关」交互回归。

## [0.1.0] - 2026-10-02

首次正式发布（GitHub 上传前的整理快照）。

### 视觉与启动
- 启动背景真透明（依赖 `shell-patch/` 改 `lib/main.js` 的 `transparentWindowOptions()`）。
- 启动即最大化，规避 alpha 窗口被合成器拒绝最大化（`setBounds()` 后异步 `maximize()` 重试）。
- 原生 caption 按钮在动画期间隐藏、动画结束后恢复；`windows-appearance` handler 被加闸，被它复位的覆盖层重新保存/恢复。
- 冷启动流程：绿鲸鱼先行 → 五个绿框依次出现 → 蓝色像素块逐个释放 → S 路径红色横扫 → 蓝色"LOADING..."字幕带 → 揭幕。
- 切换动画：与网页版 `dsh-theme-marathon` 对齐 —— 9×5 网格 + 路径遮罩，`clip-path: path()` 路径坐标按 `devicePixelRatio` 缩放。
- 反转蓝 logo 闪烁：1.20s 起 0.25s 内单次出现，复用 `assets/boot/invert-blue-pixel.png`。

### 主题与组件
- `client.js` 覆盖 `theme` 服务的 `overrideTokens`（仅改 token，不动 DOM/路由）。
- 发送按钮 (`button._primary`) 取同款绿（`--mar-accent`）作为底色 + 边框，禁用态同样生效。
- 左侧栏的新会话项：hover 时绿色块亮起，选中态取 `--mar-accent`，未选中项不染色。
- 设置面板：进入瞬间 5×5 马赛克铺设 + 2px 边框；任务板：每选项板 + 4 个 reticle + 2px 边框 1-2-4-3 顺序登场。
- 菜单板项：`--mar-bg-void` 矩形与 `--dsw-default-tab` 对比鲜明。

### 工程质量
- `npm run build` → `npm run check`（103 项静态断言）+ `npm test`（101 项 jsdom）+ `npm run verify:*`（patch 23 / auto 47）全过。
- `shell-patch/` 的所有路径都做 SHA256 校验、Pickle 头字段、`process.noAsar` 兜底，verbatim 字节比对。
- `lib/asar.cjs` 自己解包/重打包，结果与源文件**逐字节相同**。
- 升级路径：`revert.cjs` + `apply.cjs`，**不再就地升级阶梯**（旧版会留下重复的 handler）。
- `.gitignore` 屏蔽 5 个 .bak 调试快照、`preview.html`、`auto-apply.log`、`assets/screenshots/` 等开发期遗留。
- `package.json` 加 `repository` / `bugs` / `homepage` 指向 `github.com/ALPDM00/dsh-theme-mls-desktop`。

### 与网页版的边界
- 本包是 `dsh-theme-marathon`（网页版）的桌面专版；视觉一致，差异在启动那一刻。
- 不同时启用两者 —— 同时挂载会重复注入启动覆盖层。
- 共享同一套 `mar-` 命名空间。