# 光遇日历订阅 — 主页重构 + 功能增强 Plan

> 给 Codex 的实施指引。本项目是 `mosyoyo/mo-sky-stones`（Sky:CoL ICS 日历订阅服务）。
> 本次改造涉及：主页重构、统计功能、UI 改进、iOS 提醒修复、提醒时间调整、自定义先祖订阅、安全加固。

---

## 1. 主页重构（核心需求）

### 1.1 现状问题

当前 `index.html` 是「自选订阅页面」：用户需要自己勾选 6 类事件、决定是否「仅结束提醒」、复制链接——**决策成本太高**，新用户不知道选什么。

### 1.2 新设计方案

**风格**：苹果官网风（大留白、极简、一张卡片贯穿页面）

**新主页布局**（`index.html` 改为新设计）：

```
┌─────────────────────────────────┐
│                             │
│        光遇日历订阅             │  ← 大标题（hero）
│      你的天空王国日程           │  ← 副标题
│                             │
│   ┌─────────────────────┐    │
│   │  📅 订阅光遇日历    │    │  ← 唯一按钮（大、蓝、圆角）
│   └─────────────────────┘    │
│     一键订阅全部提醒           │  ← 小字推荐理由
│                             │
│   ┌─────────────────────┐    │
│   │ 高级选项：自定义订阅  │    │  ← 底部小链接（次要）
│   └─────────────────────┘    │
│                             │
│   © 2026 mo-sky-stones      │  ← 页脚
└─────────────────────────────────┘
```

**「一键订阅」的行为**：
- 默认订阅全部 6 类事件
- 其中 `traveling_spirit / season / activity` 默认「仅结束提醒」（减少打扰）
- `bonus / candle_heap / maintenance` 默认「全程提醒」
- 点击后直接跳到 `webcal://sky-stones-bni.pages.dev/calendar.ics?types=traveling_spirit,season,activity,bonus,candle_heap,maintenance&endOnly=traveling_spirit,season,activity`

**「高级选项」的行为**：
- 跳转到 `/subscribe`（原 `index.html` 迁移过来）
- URL 改了，但功能完全不变

### 1.3 文件改动

| 文件 | 改动 |
|---|---|
| `index.html` | **重写**：新极简主页 |
| `subscribe.html`（新建）| 从原 `index.html` 完整迁移过来 |
| `functions/_shared.js` 或 `functions/calendar.ics.js` | 支持 `/calendar.ics` 路由（原 `/events.ics`）|

> **注意**：原 `index.html` 功能不能丢，只是变成二级页面 `/subscribe`。

### 1.4 新主页交互细节

- 点击「订阅光遇日历」→ 尝试直接订阅（`webcal://` 协议）
  - iOS：唤起日历 App，直接添加订阅
  - 桌面浏览器：复制链接 + toast 提示「已复制，请粘贴到日历 App」
- 按钮下方小字：「包含复刻、季节、活动、双倍、大蜡烛、维护全部提醒，可在高级选项里自定义」

---

## 2. 统计功能

### 2.1 需求

1. **访问统计**：多少用户访问了订阅链接（`/calendar.ics` 或 `/events.ics`）
2. **订阅类型统计**：哪类事件的订阅量最高（通过 URL 参数 `types=` 分析）
3. **后台页面**：admin 能登录看统计数据（不只是去 Cloudflare Dashboard）

### 2.2 技术方案

CF Pages Functions **无状态**，不能用本地文件存计数。统计分两层：

**第一层：Cloudflare Web Analytics（基础访问数据）**
- 免费、无需改代码
- 在 `index.html` 和 `subscribe.html` 加一段 Cloudflare Web Analytics 的 `<script>`
- 能看到 PV/UV、设备类型、国家
- **作用**：总访问量

**第二层：自建简易统计 Endpoint（订阅类型细分）**
- 新增 `/api/stats-log`：
  - 接受 GET/POST，记录 `{ event: 'ics_access', types: 'traveling_spirit,bonus', ts: ... }`
  - 写入 Cloudflare KV（绑定一个免费 KV Namespace，5 分钟 TTL 累计）
- `functions/events.ics.js` 里，每次返回 ICS 前**非阻塞**打点：
  ```js
  const types = new URL(context.request.url).searchParams.get('types') || 'all';
  context.waitUntil(
    fetch(`https://sky-stones-bni.pages.dev/api/stats-log?event=ics_access&types=${encodeURIComponent(types)}`).catch(() => {})
  );
  ```
- **缺点**：CF Pages Functions 默认 KV 是只读的，写入需要 `wrangler.toml` 配 KV binding；或者用 Workers Analytics Engine（更专业但复杂）

**结论（第一期）**：
- 先用 **Cloudflare Web Analytics** 做访问统计
- **不做**类型细分（等第二期加 KV 再做）

### 2.3 统计后台页面（第一期不做）

> 这是用户新提的需求：希望 admin 后台能直接看数据，**不是**只看 Cloudflare Dashboard。

**本期范围内**：
- 在 admin 端加一个「📊 访问统计」入口（`/admin/stats/`）
- 第一期：直接 iframe 嵌 Cloudflare Web Analytics 公开链接（如果在 Cloudflare Dashboard 能拿到 share URL）
- 或者只放一个外链按钮：「查看访问统计（Cloudflare Dashboard）」

**第二期**（订阅类型细分做完后再加）：
- 后台拉 `/api/stats-summary` 接口
- 展示折线图：每日访问量
- 展示柱状图：哪类订阅最多

### 2.4 实施步骤（第一期）

1. 在 Cloudflare Dashboard 给 `sky-stones-bni.pages.dev` 开启 Web Analytics
2. 拿到 Analytics 的 `<script>` 代码片段
3. 插入 `index.html` 和 `subscribe.html` 的 `<head>` 里
4. 新建 `src/admin/stats/index.html`（统计后台页面）—— 见 2.5 节

### 2.5 统计后台页面设计

**文件**：`src/admin/stats/index.html`（新建）

**页面布局**（苹果极简风，跟其他 admin 页统一）：
```
┌─────────────────────────────────┐
│  ← 返回    访问统计        ⚙  │  ← 顶部导航
│                              │
│   ┌─────────────────────┐   │
│   │ 今日访问              │   │  ← 数字大卡片
│   │   128 次            │   │
│   └─────────────────────┘   │
│                              │
│   ┌─────────────────────┐   │
│   │  实时访问来源         │   │
│   │  跳转查看 →          │   │  ← 跳 Cloudflare Dashboard
│   └─────────────────────┘   │
│                              │
│   📊 类型细分（第二期）       │  ← 灰底，表示未上线
│                              │
└─────────────────────────────────┘
```

**数据来源**：
- 第一期：数字写死「请前往 Cloudflare Dashboard 查看」+ 外链
- 不用 API，admin 自己也方便直接看 Dashboard

**具体实现**（第一期）：
```html
<a href="https://dash.cloudflare.com/..." target="_blank" class="stats-link">
  前往 Cloudflare Dashboard →
</a>
```

> 决定不在第一期自建数据展示的原因：CF Pages Functions 没 KV binding，做不了状态统计。
> Cloudflare Web Analytics 本身没有公开 API 拉数据（只能看 Dashboard）。
> 如果想第一期就有数字，**必须**配 KV Namespace，超出本 plan 范围。

---

## 3. UI 改进：复选框 → 开关

### 3.1 现状

`index.html`（原自选页面）用的是 `<input type="checkbox">`，样式靠 `accent-color` 控制，不好看。

### 3.2 改进方案

用 **CSS 实现的 iOS 风格开关**（不需要 JS 库）：

```css
.switch {
  position: relative;
  width: 51px;
  height: 31px;
  -webkit-appearance: none;
  appearance: none;
  background: #e9e9eb;
  border-radius: 16px;
  transition: background .2s;
  cursor: pointer;
}
.switch:checked {
  background: #34c759;  /* 绿色，iOS 风格 */
}
.switch::before {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 27px;
  height: 27px;
  background: #fff;
  border-radius: 50%;
  transition: transform .2s;
  box-shadow: 0 1px 3px rgba(0,0,0,.15);
}
.switch:checked::before {
  transform: translateX(20px);
}
```

把 `subscribe.html` 里所有 `input[type="checkbox"]` 替换成这个样式。

---

## 4. iOS 提醒问题

### 4.1 现象

用户反馈：iOS 订阅后**没有提醒**，但安卓有。

### 4.2 可能原因

1. **VALARM 的 `TRIGGER` 值 iOS 不支持**
   - 当前代码用的是 `-PT10M`（提前 10 分钟）
   - iOS 支持的格式：`-PT10M`、`-P1D`（天数）
   - **`-PT10M` 应该是支持的**——之前踩坑记录里也写了「VALARM TRIGGER 用 `-PT10M`」

2. **iOS 日历 App 的「提醒」开关没开**
   - iOS 设置 → 日历 → 默认提醒时间
   - 这个跟 ICS 无关，是用户侧设置

3. **ICS 的 `TRANSP:OPAQUE` vs `TRANSP:TRANSPARENT`**
   - 当前全天事件用 `TRANSP:TRANSPARENT`（正确，不会挡住用户其他事件）
   - 但 iOS 可能不会给 `TRANSPARENT` 的事件弹提醒
   - **这个可能是根因**

### 4.3 修复方案

把全天事件的 `TRANSP` 改成 `OPAQUE`，让 iOS 一定弹提醒：

```js
// createAllDayEvent() 里：
// 原：
'TRANSP:TRANSPARENT',   // ← 改成 OPAQUE
// 改：
'TRANSP:OPAQUE',
```

**验证**：
1. 本地生成新 ICS
2. iOS 日历重新订阅
3. 看「复刻先祖」事件是否有提醒

---

## 5. 提醒时间调整（先祖离开）

### 5.1 现状

先祖离开提醒：`end-reminder` 是「结束前 1 小时」（`-PT1H`），即 **11:00 北京**。

用户反馈：11 点有些人在上课，来不及看。

### 5.2 方案讨论

两个选项：
- **A：提前到前一天晚上 20:00**（学生放学、上班族下班，有空看手机）
- **B：当天早上 08:00**（起床后能看到）

**推荐 A**：前一天晚上 20:00 更符合玩家习惯（光遇活跃时间通常是晚上）。

### 5.3 修复方案

`src/event-utils.js` 的 `REMINDERS` 对象：

```js
// 原：
traveling_spirit: { start: '-PT10M', end: '-PT1H', ... },

// 改（end 提醒提前到前一天 20:00 = 北京时间 20:00，UTC 12:00，即 end 前 16 小时）：
traveling_spirit: { start: '-PT10M', end: '-P16H', ... },
```

> 注意：`-P16H` = 结束前 16 小时。先祖 12:00 结束 → 12 - 16 = 前一天 20:00 ✓

---

## 6. 自定义先祖订阅

### 6.1 需求

玩家痛点：只能订阅「当周复刻先祖」，不能订阅「某特定先祖」（比如「致敬钢琴家」下次返场）。

### 6.2 技术方案

**数据源**：网易大神有「先祖图鉴」类接口，或者直接爬 `spirit-items.json`（项目里已有这个文件！）

看项目里已有 `data/spirit-items.json`（25583 字节，应该是先祖列表）。

**实施步骤**：

1. **`/admin/spirits/` 页面**（新建）：
   - 展示 `data/spirit-items.json` 里所有先祖
   - 每个先祖旁边有个「订阅」开关
   - 开关状态存到 `data/spirit-subscriptions.json`（新文件）

2. **`functions/spirit-events.ics.js`**（新建）：
   - 读 `data/spirit-subscriptions.json`
   - 当有先祖返场时（wiki 抓到），生成对应的 ICS

3. **主页「高级选项」里加一个「订阅特定先祖」入口**

### 6.3 文件改动

| 文件 | 改动 |
|---|---|
| `data/spirit-subscriptions.json` | 新建，存储用户订阅的先祖列表 |
| `src/admin/spirits/index.html` | 新建，先祖订阅管理页面 |
| `functions/spirit-events.ics.js` | 新建，生成先祖订阅 ICS |

> **注意**：这个需求比较大，建议**拆成独立一期**再做。本期 Plan 先列出，但不强制要求 codex 一期做完。

---

## 7. 安全加固

### 7.1 问题 1：登录后永不过期

当前 `functions/_middleware.js` 的 Auth 逻辑：

```js
async function hasAuth(request, env) {
  const secret = appConfig(env).adminPassword;
  if (!secret) return false;
  return getCookie(request) === await sign('mo-sky-stones', secret);
}
```

Cookie 是永久有效的（没有过期时间）。

**修复方案**：

在 `/api/admin-login` 里，给 Cookie 加 `Max-Age` 或 `Expires`：

```js
// /api/admin-login 的 Response 里：
return new Response(JSON.stringify({ ok: true }), {
  headers: {
    'Set-Cookie': `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${60 * 60 * 24 * 7}`,  // 7 天过期
  },
});
```

同时，`_middleware.js` 的 `hasAuth()` 里要**解析 Cookie 里的时间戳**（如果加了时间戳字段的话），判断是否已经过期。

> 最简单的做法：`sign()` 的时候把过期时间也 sign 进去，比如 `sign('mo-sky-stones:' + (Date.now() + 7 * 86400 * 1000), secret)`。

### 7.2 问题 2：没有暴力破解保护

当前输错密码直接返回 `{ error: 'wrong password' }`，没有次数限制。

**修复方案**：

用 Cloudflare Workers 的 **Rate Limiting**（免费版有基础保护），或者在 `/api/admin-login` 里加一个简单的内存计数器：

```js
// 注意：CF Pages Functions 是多实例的，内存不共享。
// 所以需要用外部存储（Cloudflare KV）才能做真正的 Rate Limit。
// 暂时先加一个「输错 5 次后 sleep 2 秒再返回」的简单防护：
let failCount = 0;
export async function onRequestPost(context) {
  // ...
  if (!correct) {
    failCount++;
    if (failCount > 5) await new Promise(r => setTimeout(r, 2000));
    return new Response(JSON.stringify({ ok: false, error: '密码错误' }), { status: 401 });
  }
  failCount = 0;
  // ...
}
```

> **更好的方案**：用 Cloudflare KV 存 `failCount:key=IP`，实现跨实例的 Rate Limit。但这个需要绑定 KV Namespace，配置稍复杂。本期先加简单防护。

---

## 8. 实施步骤（给 Codex）

按优先级排序：

### Step 1：主页重构（不影响现有功能）
1. 把当前 `index.html` 完整复制到 `subscribe.html`
2. 重写 `index.html` 为新极简设计（参考 1.2 节布局）
3. 验证：访问 `/` 看到新主页；访问 `/subscribe` 看到原自选页面

### Step 2：统计功能
1. 在 Cloudflare Dashboard 开启 Web Analytics
2. 把 Analytics `<script>` 插入 `index.html` 的 `<head>`

### Step 3：UI 改进
1. 在 `subscribe.html` 里加 `.switch` CSS
2. 把所有 `input[type="checkbox"]` 改成 `.switch` 样式

### Step 4：iOS 提醒修复
1. 把 `createAllDayEvent()` 的 `TRANSP:TRANSPARENT` 改成 `TRANSP:OPAQUE`
2. 本地生成 ICS，iOS 订阅验证

### Step 5：提醒时间调整
1. 把 `REMINDERS.traveling_spirit.end` 从 `-PT1H` 改成 `-P16H`
2. 验证：「希望之种」离开提醒应该是 6/21 20:00 北京

### Step 6：安全加固
1. `/api/admin-login` 的 `Set-Cookie` 加 `Max-Age=604800`（7 天）
2. `_middleware.js` 的 `hasAuth()` 支持过期检查
3. `/api/admin-login` 加简单暴力破解防护（sleep 2s after 5 fails）

### Step 7（可选，拆到下一期）：自定义先祖订阅
1. 新建 `src/admin/spirits/index.html`
2. 新建 `functions/spirit-events.ics.js`
3. 新建 `data/spirit-subscriptions.json`

---

## 9. 验收清单

- [ ] 访问 `/` 看到新极简主页（苹果风格）
- [ ] 点击「订阅光遇日历」能正确唤起日历 App 或复制链接
- [ ] 点击「高级选项」跳转到 `/subscribe`，功能跟原 `index.html` 完全一致
- [ ] `/subscribe` 里的复选框都变成 iOS 风格开关
- [ ] Cloudflare Dashboard 能看到访问统计
- [ ] iOS 日历订阅后能收到提醒（修复 `TRANSP` 后）
- [ ] 「希望之种」离开提醒时间改成前一天 20:00 北京
- [ ] Admin 登录后 7 天过期，需要重新登录
- [ ] 输错 5 次密码后，第 6 次请求会 sleep 2 秒

---

## 10. 不在本期范围

- 自定义先祖订阅（太大，拆到下一期）
- 订阅类型细分统计（需要后端状态，成本太高）
- 移动端样式大改（当前已经 mobile-friendly，本期只改主页）

---

> 完成后告诉我，我会 review + 部署。
