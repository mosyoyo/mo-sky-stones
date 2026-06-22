# Admin 页面重构 Plan

> 给 Codex 的实施指引。本项目是 `mosyoyo/mo-sky-stones`（Sky: CoL ICS 订阅服务），Admin 页面位于 `src/admin/`，所有页面共用 `src/admin/style.css`。
>
> **目标**：把 4 个 admin 页面统一到同一套视觉/交互范式，去掉各页面里散落的重复 CSS、冗余逻辑，让 admin 区一眼能看出「这是同一套东西」。

---

## 1. 当前资产清单

| 文件 | 行数 | 用途 | 主要内容 |
|---|---|---|---|
| `src/admin/style.css` | 265 | 共享样式 | CSS 变量、按钮、表单、面板 |
| `src/admin/events/index.html` | 147 | 事件浏览 | 列出 `events.json` 里的事件，可按类型筛选 |
| `src/admin/feed/index.html` | 363 | feed 审核 | 列出 `feeds.json` 里的原始公告，可编辑标题/日期，批量提交 |
| `src/admin/settings/index.html` | 205 | 数据源设置 | 切换 6 类事件数据源（3 类锁定） |
| `src/admin/sync/index.html` | 50 | 同步历史 | 显示 `sync.json` 的同步日志 |

每个页面顶部有相同的 nav（`shell-nav`）：

```html
<a href="/">订阅</a>
<a href="/src/admin/feed/">公告</a>
<a href="/src/admin/events/">事件</a>
<a href="/src/admin/sync/">同步</a>
<a href="/src/admin/settings/">数据源</a>
```

---

## 2. 重构目标

### 2.1 抽出共享布局到独立文件

**新增 `src/admin/_layout.html`**（或 `src/admin/layout.js` 用 JS 注入）—— 提供：
- 顶部 nav 栏（4 个页面共用）
- `<main>` 容器
- 页脚 / 版本号（可选）

考虑方案：
- **方案 A**：纯 HTML，每个 index.html 复制粘贴一段（最简单但仍重复）
- **方案 B**：用 `<script>` 注入 nav 片段（避免重复，但 SEO 不友好——admin 不需要 SEO）
- **方案 C**：用 `<iframe>`（不推荐，admin 内部链接会乱）

**推荐方案 B**：在 `style.css` 旁边新增 `src/admin/nav.js`，所有页面顶部加 `<script src="/src/admin/nav.js" defer></script>`，自动注入 nav。

### 2.2 抽出共享工具函数

`src/admin/common.js`（新增）—— 提供：
- `fetchJSON(url)`：统一 `fetch` + 错误处理
- `h(text)`：HTML escape（已在 settings 页用到）
- `formatDate(iso)`：ISO 时间 → 中文友好格式（`06-19 14:00`）
- `showToast(msg, type)`：右下角 toast 提示（替代 `alert()`）
- `confirmAction(msg)`：替代 `confirm()`

### 2.3 统一样式系统

`src/admin/style.css`（重构）：
- **统一使用 CSS 变量**（已部分建立）
- **新增**：
  - `--warning: #ff9500`
  - `--danger: #ff3b30`
  - `--success: #34c759`
  - 暗色模式（`@media (prefers-color-scheme: dark)`）—— 可选

- **统一组件类**：
  - `.card` 替代各页面里的 `.log-item` / `.event-card` / 各种盒子
  - `.tag` 替代各种 badge
  - `.btn-primary` / `.btn-secondary` / `.btn-danger` 替代散落的 button 样式

### 2.4 解决具体不一致点

| 问题 | 现状 | 重构后 |
|---|---|---|
| nav 重复 | 4 个页面顶部各有一段 | nav.js 注入 |
| 日期格式 | 3 处用 `e.start.slice(0,10)` 拼字符串 | 统一 `formatDate()` |
| HTML escape | settings 页有 `h()`，其他页没 | common.js 提供 |
| 错误提示 | `alert('错误: ' + msg)` | `showToast()` |
| 容器 | `.shell > .sidebar`（feed 用），其他页用 `.shell` 一种 | 统一 `.shell` 网格 |
| 字体大小 | 16px / 14px / 13px 混用 | 统一 4 个尺寸 token |
| 颜色 | 蓝色 `#0071e3` 多处直接写 | 全用 `var(--blue)` |

---

## 3. 页面级改动

### 3.1 `src/admin/events/index.html`（事件浏览）

**现状问题**：
- 没有按日期排序（直接用数组顺序）
- 没有「显示已过期」开关（会显示一堆历史事件）
- 「_source」列展示的是「wiki」字符串而不是「来自 Wiki 活动日历」

**建议改动**：
- 顶部加日期范围选择 / 排序
- 列表项加 `.card` 类
- 区分「即将到来 / 进行中 / 已过期」三档（用颜色或图标）

### 3.2 `src/admin/feed/index.html`（feed 审核）

**现状问题**：
- 363 行，逻辑复杂（type 判定、enabled 切换、批量提交），单文件过长
- 「待审核 / 已批准 / 已拒绝」三状态切换逻辑散落
- 编辑标题/日期的表单跟其他表单风格不一致

**建议拆分**：
- `src/admin/feed/index.html`：纯 HTML 结构
- `src/admin/feed/feed.js`：状态管理 + 渲染
- `src/admin/feed/api.js`：跟 `/api/feed-approve` 之类的接口通信
- 顶部 toolbar 用 `.card.toolbar` 统一样式

### 3.3 `src/admin/settings/index.html`（数据源设置）

**现状**：
- 已经有 3 类锁定样式（🔒 网易大神（固定））
- 但「首选源 / 兜底源」文字提示放在每行下方，挤

**建议改动**：
- 每行用 `.card` 容器
- 「锁定 / 可切换」用统一 badge 风格
- 顶部加「总览卡片」：6 类各几条数据，分别来自哪个源

### 3.4 `src/admin/sync/index.html`（同步历史）

**现状问题**：
- 50 行太薄，只有时间戳列表
- 没有过滤（看哪次成功/失败要看全部）

**建议改动**：
- 加状态过滤（success / failure / pending）
- 加来源过滤（fetch / parse / merge / commit）
- 列表项显示耗时（用 `.duration` 标签）

---

## 4. 实施步骤

按依赖关系排序：

### Step 1：基础设施（不破坏现有页面）
1. 新增 `src/admin/common.js`（`fetchJSON` / `h` / `formatDate` / `showToast` / `confirmAction`）
2. 新增 `src/admin/nav.js`（统一注入 nav）
3. 重构 `src/admin/style.css`：补全变量、抽出 `.card` / `.tag` / `.btn-*` 组件类
4. 4 个 index.html 顶部引入 common.js + nav.js

### Step 2：迁移工具函数
- 把 settings 页里的 `h()` 移到 common.js
- 把 feed 页里的日期格式逻辑移到 common.js
- 删除各页面里的局部 utility

### Step 3：统一样式
- 把所有 `<div class="log-item">` 改为 `<div class="card">`
- 验证 style.css 里 `.log-item` 没人用后删除

### Step 4：页面级优化
- events 页：加日期排序 + 状态分组
- feed 页：拆 JS 文件
- settings 页：加总览卡
- sync 页：加过滤器

### Step 5：测试 + 部署
1. 本地 `npm run sync` 生成最新 data
2. 4 个 admin 页面走一遍，截图对比前后
3. 触发 Actions，验证 CF Pages 部署后 admin 区能正常加载
4. 验证：手机日历订阅不受影响

---

## 5. 验收清单

- [ ] 4 个 admin 页面顶部 nav 完全一致（同一份 nav.js 生成）
- [ ] 所有页面用 `var(--blue)` 等 CSS 变量，无硬编码颜色
- [ ] 所有日期用 `formatDate()` 统一格式
- [ ] 所有用户提示用 `showToast()`，无 `alert()`
- [ ] 重复 utility 全部抽到 common.js
- [ ] `style.css` 缩减到 < 200 行（去重后）
- [ ] 移动端样式（< 600px 宽）正常
- [ ] ICS 订阅 URL 输出不受影响

---

## 6. 不在本次重构范围

- 后端 Functions 改动（`functions/api/settings.js` 等）
- `src/scripts/` 抓取脚本改动
- ICS 格式调整
- `data/*.json` 数据结构改动

Admin 纯前端重构，不动数据和后端逻辑。

---

## 7. 文件改动清单

**新增**：
- `src/admin/common.js`
- `src/admin/nav.js`

**修改**：
- `src/admin/style.css`
- `src/admin/events/index.html`
- `src/admin/feed/index.html`
- `src/admin/settings/index.html`
- `src/admin/sync/index.html`

**新增（可选拆分）**：
- `src/admin/feed/feed.js`
- `src/admin/feed/api.js`

---

## 8. Codex 执行提示

1. **不要动 `functions/` 和 `src/scripts/`**——这次是纯前端重构
2. **不要改 `data/*.json` 的字段**——admin 页面读的是这些字段
3. **保持 4 个 admin 页面 URL 不变**：`/src/admin/{feed,events,settings,sync}/`
4. **不要破坏现有的「🔒 网易大神（固定）」锁定逻辑**——这是用户核心决策
5. **本地验证方法**：`python -m http.server 8080`（或 `npx serve`）跑起来，浏览器开 4 个页面看效果
6. **保持 mobile-friendly**（< 600px 不能崩）

---

## 9. 已知 bug：复刻先祖时间错误（本期修）

> 这次顺手修一个**影响 ICS 输出**的 bug（虽然 plan 主体是 admin 重构，但这个 bug 跟时间规则相关，需要 codex 一并处理）

### 9.1 现象

用户反馈：

> 复刻先祖应该是**早上 6 点钟来、中午 12 点钟走**。现在 wiki 抓出来的全是「12:00 来、12:00 走」。

`data/events-wiki.json` 现状：

```json
{
  "type": "traveling_spirit",
  "title": "【复刻】希望之种",
  "start": "2026-06-18T04:00:00.000Z",  // ← 错（北京时间 12:00）
  "end":   "2026-06-22T04:00:00.000Z"   // ← 错（北京时间 12:00）
}
```

正确应该是：

```json
{
  "start": "2026-06-18T22:00:00.000Z",  // 周四 06:00 北京（UTC 22:00 前一天）
  "end":   "2026-06-22T04:00:00.000Z"   // 周一 12:00 北京（UTC 04:00 当天）
}
```

### 9.2 根因

`src/scripts/fetchWikiEvents.js` 的 `toUTCChina12()` 是个**统一的「开始日 12:00 → 结束日 12:00」函数**：

```js
function toUTCChina12(dateStr) {
  // 12:00 北京 = 04:00 UTC
  return new Date(Date.UTC(year, month - 1, day, 4, 0, 0, 0)).toISOString();
}
```

复刻先祖**沿用了这个函数**，但先祖的真实规则是「**周四早 6:00 来 → 周一中午 12:00 走**」——这是 Sky:CoL 游戏的固定机制。

### 9.3 正确规则（参考网易那边的写法）

网易大神的复刻先祖时间解析逻辑在 `src/event-utils.js` 的 `extractDateRange()` + `relativeWeekdayDate()` 里，**就是按这个规则做的**：

```js
// 匹配「本周/下周 + 周X + 时间点」
const match = text.match(/(本周|下周)([日天一二三四五六])(?:早上|上午|中午|下午|晚上)?\s*(\d{1,2})[:：](\d{2})/);

// 网易原文（节选）：
// "6月18日丨本周旅行先祖即将到临 ... 本周四早上6:00 - 本周一中午12:00"
```

规则总结：
- **start = 本周四 06:00 北京**（UTC 22:00 前一天）
- **end   = 本周一 12:00 北京**（UTC 04:00 当天）
- 网易公告里的「本周X」是指**公告所在那一周**（不是日历周），按 `now` 推算

### 9.4 修复方案（让 codex 改）

`src/scripts/fetchWikiEvents.js` 新增一个**复刻先祖专用**的转换函数，**不要改 `toUTCChina12`**（其他类型还在用）：

```js
/**
 * 复刻先祖专用：周四 06:00 北京 → 周一 12:00 北京
 * 输入是「start 日期」（MM-DD 或 YYYY-MM-DD）
 * 算法：
 *   1. 算出 start 是星期几
 *   2. 找到同一周的「周一」（往前推 1~6 天）和「周四」（往后推 0~6 天）
 *   3. startUTC = 周四 06:00 北京 = UTC 22:00 前一天
 *      endUTC   = 周一 12:00 北京 = UTC 04:00 当天
 * 注意：start 日期可能落在「周一~周三」或「周四~周日」两种情况，
 *       都要用「包含 start 那个周一 + 包含 start 那个周四」
 *       简单做法：end 永远 = start + (8 - weekday) % 7 天后的那个周一
 *                 start = end - 3 天 后的那个周四
 */
function toUTCSpiritWindow(startDateStr) {
  // ...
}
```

调用点替换（`fetchWikiEvents.js` 第 216-217 行附近）：

```js
// 原：
start: toUTCChina12(parseMonthDay(year, startMD)),
end:   toUTCChina12(parseMonthDay(year, endMD)),

// 改为（仅 traveling_spirit 类型）：
start: type === 'traveling_spirit' ? toUTCSpiritWindow(parseMonthDay(year, startMD)) : toUTCChina12(parseMonthDay(year, startMD)),
end:   type === 'traveling_spirit' ? toUTCSpiritWindow(parseMonthDay(year, endMD))   : toUTCChina12(parseMonthDay(year, endMD)),
```

### 9.5 验证清单

- [ ] 「希望之种」`start` 应该是 `2026-06-18T22:00:00.000Z`（不是 `04:00:00`）
- [ ] 「希望之种」`end` 应该是 `2026-06-22T04:00:00.000Z`（不是 `04:00:00`）
- [ ] 「致敬钢琴家」同样：`start = 2026-06-10T22:00:00.000Z`，`end = 2026-06-15T04:00:00.000Z`
- [ ] season / activity 类型的 `start/end` 保持 `toUTCChina12` 原行为
- [ ] 跑 `node src/scripts/fetchWikiEvents.js --mock` 看输出确认
- [ ] events.json 重新生成后，触发 Actions 验证 CF Pages ICS 输出

---

## 10. 已知 bug：「狂欢季 即将结束」跟 range 事件重复（本期修）

> 同步修的第二个 bug。

### 10.1 现象

`/events.ics` 输出里**季节**有两行：

```
1. 【季节】狂欢季               DTSTART;VALUE=DATE:20260423   DTEND;VALUE=DATE:20260709
2. 【季节】狂欢季 即将结束        DTSTART:20260707T040000Z     DTEND:20260708T040000Z
```

在 iOS 日历里看，**「狂欢季」会同时显示「狂欢季 7天 (全日)」+「狂欢季 即将结束 (1天前提醒)」两个事件**，看着像重复了。

### 10.2 用户决策

> 「end-reminder 改个不同的 SUMMARY」

**预期输出**：

```
1. 【季节】狂欢季                                DTSTART;VALUE=DATE:20260423   DTEND;VALUE=DATE:20260709
2. 【季节结束】狂欢季 明天就要结束了                 DTSTART:20260707T040000Z     DTEND:20260708T040000Z
```

SUMMARY 改个不一样的字符串，让 iOS 列表里能一眼分清。

### 10.3 修复方案

`src/event-utils.js` 第 478 行附近：

```js
// 原：
const endTitle = event.type === 'traveling_spirit'
  ? `${summary} 即将离开`
  : `${summary} 即将结束`;

// 改为：
const endTitle = event.type === 'traveling_spirit'
  ? `【先祖离开】${summary}`
  : event.type === 'season'
    ? `【季节结束】${summary}`
    : event.type === 'activity'
      ? `【活动结束】${summary}`
      : `${summary} 即将结束`;
```

> 关键点：SUMMARY 前缀要**跟 range 事件的 `【季节】`/`【复刻】`/`【活动】` 区分**，避免 iOS 列表把它们排在一起看起来像重复。

### 10.4 验证清单

- [ ] `/events.ics` 里季节的 end-reminder SUMMARY 变成「【季节结束】狂欢季 明天就要结束了」
- [ ] 复刻、活动、其他类型也按新规则命名
- [ ] 双倍/大蜡烛/维护维持原样
- [ ] iOS 日历订阅里同一季节只看到一行（range 整天事件），但能收到「明天就要结束」这个独立提醒

---

> 完成后告诉我，我会 review + 部署。
