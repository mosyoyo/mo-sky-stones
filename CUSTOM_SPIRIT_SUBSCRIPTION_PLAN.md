# 自定义先祖订阅 - 第一期 Plan（v2 重写版）

> 给 Codex 的实施指引。
> 目标：**极简、零后端、决策成本低、视觉/交互简洁丝滑**。
>
> v2 改动：
> - ❌ 删除「我编的 8 个热门映射」（不实查 wiki 不准写）
> - ❌ 不用项目里旧的 `data/spirit-items.json`（早期手写，aliases 是编的）
> - ✅ 数据**让 codex 重新爬** wiki「旅行先祖回归记录」页面，生成纯净的 `data/soul-spirits.json`
> - ✅ 热门推荐数据 `data/spirit-hot.json`（admin 后台编辑）
> - ✅ admin 后台可编辑热门先祖的 title（展示名）和 searchKeys（搜索关键词）
> - ✅ 提醒时机**保留现状**：start 用 `-PT10M`（先祖到来前 10 分钟），end 用 `-PT16H`（周一中午离开前一天晚上 20:00）
> - ✅ 最多选 3 个，URL 参数传先祖真名，零后端
> - ✅ Step 0（必须最先做）= 爬 `soul-spirits.json` + verify + commit，才进 Step 1

---

## 设计原则（强制）

1. **零后端存储**：所有选择存浏览器 localStorage，订阅链接用 URL query 传递
2. **最多 3 个先祖**：从源头限制选择数量，减少决策成本
3. **单一职责页面**：每屏只做一件事
4. **丝滑交互**：
   - 点击先祖 → 即时反馈（卡片变色/缩放）
   - 选择上限达成 → 隐藏未选项或置灰
   - 无 loading 弹窗，全本地操作
5. **视觉简洁**：
   - 大留白、单色为主（黑/白/灰 + 一个强调色）
   - 卡片式布局，圆角 12px
   - 不用 emoji 当图标（用 SVG 或文字）
6. **快速返回**：选择完一键生成订阅链接，不要求注册
7. **热门配置**走 admin 后台，**不写死**——让用户/管理员自己改

---

## 1. 数据基础（**全部要 codex 从 wiki 重爬**）

### 1.1 ❌ 不用项目里旧的 `data/spirit-items.json`

- 旧的 `spirit-items.json`（62 条）是早期凭印象手写的，**字段不准、缺漏多、aliases 是编的**
- **本期方案：让 codex 重新爬 wiki「旅行先祖回归记录」页面**，生成一份纯净版
- 旧的 `spirit-items.json` 在本期中可以保留做兜底，**最终不依赖它**

### 1.2 ✅ `data/soul-spirits.json`（**新增，codex 爬出来**）

**爬取源**：
- **首选**：`https://wiki.biligame.com/sky/旅行先祖回归记录`（回归历史，60+ 行）
- **备用**：`https://wiki.biligame.com/sky/先祖图鉴` 或 `https://wiki.biligame.com/sky/光遇先祖大全`（如果回归记录页没收录部分先祖）

**纯净版目标结构**（**严格按 wiki 实际内容**）：
```json
{
  "_meta": {
    "source": "wiki.biligame.com/sky/旅行先祖回归记录",
    "fetchedAt": "2026-06-18T00:00:00.000Z",
    "spiritCount": 60
  },
  "spirits": [
    {
      "id": "hope_seed",                       // ← 拼音 slug（codex 生成）
      "spiritName": "希望之种",                 // ← wiki 表格里的官方中文名
      "season": "欧若拉季",                     // ← wiki 表格里的所属季节
      "lastRevisit": "2026-06-18",             // ← wiki 表格里的最新回归日期（去重时取最新）
      "visitCount": 1,                         // ← 出现次数（去重前）
      "items": ["斗篷", "面具", ...],            // ← 可选：从先祖图鉴页补全
      "wikiUrl": "https://wiki.biligame.com/sky/希望之种"  // ← 标准 wiki 链接
    },
    ...
  ]
}
```

**去重规则**（**重要，避免我之前犯的错**）：
- wiki 旅行先祖回归记录页面，**同一个先祖会出现多次**（不同次的回归）
- codex 去重时**只保留 `spiritName` 字段**的 unique，**`lastRevisit` 取最新一次**
- ❌ 不要把同一个先祖的不同俗名当作不同人
- ❌ 不要凭"玩家俗名"创建新条目
- ✅ **先以 wiki 表格里写出的"官方中文名"为准**，再去看有没有对应图鉴页

**实施脚本**（`src/scripts/fetchSoulSpirits.js`）：
- 用 `cheerio` 解析 wiki HTML
- 提取表格行：`<tr>` → `<td>` 里的 编号/名称/季节/日期
- dedup by `spiritName`，保留最新 `lastRevisit`
- 生成 `id` = `pinyin(spiritName, { style: 'slug' })`，去重防冲突
- 写入 `data/soul-spirits.json`
- **必须 commit 到仓库**（不走 CF Pages 临时文件）

**执行命令**：`node src/scripts/fetchSoulSpirits.js`
- 走 `src/scripts/syncEvents.js` 的 4 步流程，**第 5 步**：跑这个脚本
- 失败 exit 1（防止用旧数据）

**校验脚本**（`src/scripts/verify-soul-spirits.js`）：
- 检查 60+ 条数据
- 检查所有 `spiritName` 都在 wiki 页面实际出现过（去重查 wiki 页面源）
- 检查没有重复 `spiritName`
- 任何校验失败 → 阻塞 Action 跑完

### 1.3 `data/spirit-hot.json`（**新增**）

```json
// 热门推荐配置：可由 admin 后台编辑
// 每个热门项引用 soul-spirits.json 里的 spiritName
{
  "_meta": {
    "description": "热门先祖推荐列表（admin 后台可编辑）",
    "maxItems": 8,
    "sortBy": "manual"
  },
  "items": [
    {
      "id": "hot-1",                        // 内部 ID，用于编辑定位
      "spiritName": "火先知",                 // 引用 soul-spirits.json
      "title": "火先知（武士裤）",            // ← 展示给用户看的标题（可编辑）
      "searchKeys": ["武士裤", "火先知", "裤裤"],  // ← 额外搜索关键词（可编辑）
      "hotItem": "武士裤",                   // 热门物品名（展示用）
      "order": 1
    }
  ]
}
```

**初始值**：`{"items":[]}`（**不要预填任何"热门"**，让 admin 后台自己加）
- 旧 `data/spirit-items.json` 里我编的"热门 8 个"**全部删除**，等 admin 自己配置
- 旧 `data/spirit-items.json` 文件**可以保留**（其他功能可能用），但本期**不依赖它**

**字段语义**：
| 字段 | 来源 | 编辑方式 |
|------|------|---------|
| `id` | 内部生成 | 后台自动 |
| `spiritName` | admin 选 soul-spirits.json 里的先祖 | 后台下拉选择 |
| `title` | 自由文本，展示用 | **后台可编辑**（你要求的） |
| `searchKeys` | 数组，额外搜索词 | **后台可编辑**（你要求的） |
| `hotItem` | 自由文本，展示用 | 后台可编辑 |
| `order` | 数字，排序 | 后台拖拽或上下箭头 |

### 1.4 编辑保存机制

- admin 后台编辑 `data/spirit-hot.json`
- 走 `POST /api/spirit-hot` → 写入仓库（用 GitHub Contents API）
- 用 GitHub API + 已有的 admin 认证
- 写完后**下次访问 `/spirits.html` 即可看到效果**（CF Pages 是静态托管，文件变了会重新拉取）

### 1.5 与 wiki 端 events 匹配

- `events-wiki.json` 里的复刻事件标题格式：`【复刻】致敬钢琴家`
- 匹配逻辑：
  ```js
  const title = e.title.replace('【复刻】', '').replace('【', '').replace('】', '');
  return spiritNames.includes(title);
  ```
- `soul-spirits.json` 里的 `spiritName` 和 wiki events 标题**严格一致**（都是 wiki 真名），**匹配会成功**

---

## 2. 页面：先祖先祖选择页 `/spirits.html`

### 2.1 路由

- **入口**：`index.html`（主页）→「高级选项」分类下加一个「订阅特定先祖」入口
- **本页面**：`/spirits.html`（独立 HTML，不放 admin/）
- **输出 ICS**：`/spirit-events.ics?spirits=火先知,致敬钢琴家`（**用 wiki 真名**，不是 ID）

### 2.2 布局（移动端优先，单列）

```
┌─────────────────────────────────┐
│  ← 返回                 ⊕ 已选 2│  ← 顶部导航（sticky）
│                              │
│  选择你想要的先祖（最多 3 个） │  ← 标题
│                              │
│  ┌──────────────────────┐   │
│  │ 🔍 搜索先祖名字 / 拼音   │   │  ← 搜索框
│  └──────────────────────┘   │
│                              │
│  ⭐ 热门推荐（8 个，admin 配置） │  ← 热门区（横滑卡片）
│  ┌──────┐ ┌──────┐ ┌──────┐ │
│  │火先知 │ │致敬钢琴家│ │风铃修补匠│  ← 横向滚动
│  │武士裤 │ │黑钢琴  │ │拇指琴  │ │
│  └──────┘ └──────┘ └──────┘ │
│                              │
│  ── 全部先祖（按上次时间倒序）─│
│                              │
│  ┌──────────────────────┐   │
│  │ 希望之种          ✓  │   │  ← 先祖卡片
│  │ 欧若拉季 · 2026.06.18│   │     已选：右侧打勾 + 强调边框
│  └──────────────────────┘   │
│  ┌──────────────────────┐   │
│  │ 致敬钢琴家       ⊘ 已满│   │     已选满 3 个 → 置灰 + 小字
│  │ 音韵季 · 2026.06.11  │   │     小字：「已达上限」
│  └──────────────────────┘   │
│  ... 更多先祖 ...           │
│                              │
│  ┌──────────────────────┐   │
│  │     生成分享链接       │   │  ← 底部固定按钮（sticky bottom）
│  └──────────────────────┘   │     未选时灰禁用
└─────────────────────────────────┘
```

### 2.3 交互细节

| 状态 | 视觉反馈 | 交互 |
|------|---------|------|
| 默认（未选） | 白底、浅灰边框 | 点击 → 选中（未达 3 个） |
| 选中 | 强调色边框 + 右上角打勾 | 点击 → 取消选中 |
| 已选满 3 个（其他卡片） | 灰底、文字变灰、右上角小字「已达上限」 | 点击无响应 |
| 搜索过滤 | 实时过滤，匹配显示、不匹配隐藏 | 支持中文 + 拼音，匹配 `spiritName + aliases + searchKeys + items` |
| 顶部计数 | 「已选 2 / 3」实时更新 | 数字动画滚动（可选） |
| 热门卡片 | 横滑，左上角 ⭐ 标识 | 点击直接选中（同样受 3 个限制） |
| 底部按钮 | 未选时灰、禁用；选 1+ 个变蓝可点 | 点击 → 弹出订阅链接弹窗 |

### 2.4 订阅链接弹窗

```
┌─────────────────────────────────┐
│  ✓ 订阅链接已生成              │
│                              │
│  ┌──────────────────────┐   │
│  │ webcal://sky-stones-  │ 📋│
│  │ bni.pages.dev/spirit- │   │  ← 链接 + 复制按钮
│  │ events.ics?spirits=...│   │
│  └──────────────────────┘   │
│                              │
│  ┌──────────────────────┐   │
│  │  📅 添加到日历        │   │  ← 唤起日历 App
│  └──────────────────────┘   │
│                              │
│  ┌──────────────────────┐   │
│  │  关闭                │   │
│  └──────────────────────┘   │
└─────────────────────────────────┘
```

---

## 3. 提醒时机（保持现状）

| 事件类型 | start 提醒 | end 提醒 | 备注 |
|---------|-----------|---------|------|
| `traveling_spirit` | `-PT10M`（开始前 10 分钟） | `-PT16H`（结束前 16 小时，即离开前一天晚上 20:00 北京） | **已是「到来时提醒」** |
| `season` | `-PT10M` | `-P1D` | 不变 |
| `activity` | `-PT10M` | `-PT1H` | 不变 |
| `bonus` | `-PT10M` | `-PT3H` | 不变 |
| `candle_heap` | `-PT10M` | `-PT10M` | 不变 |
| `maintenance` | `-PT0M` | `-PT0M` | 不变 |

**说明**：
- 先祖的开始时间在 wiki 端已经是**周四北京 06:00**（前一天 22:00 UTC），**这就是"到来时刻"**
- `start: -PT10M` → 周四北京 05:50 弹提醒 = "祖先还有 10 分钟到"
- `end: -PT16H` → 周一北京 12:00 结束，16 小时前 = **周日北京 20:00** = "祖先明晚 12 点就走了，赶紧换完"

**如果有调整需求**（比如改成 `-PT0M` 准时弹），告诉我再改。

---

## 4. ICS 输出

### 4.1 新建 `functions/spirit-events.ics.js`

```js
export async function onRequest(context) {
  const url = new URL(context.request.url);
  // 1. 解析 ?spirits=火先知,致敬钢琴家（用 wiki 真名，URL encode）
  const spiritNames = (url.searchParams.get('spirits') || '')
    .split(',')
    .map(s => decodeURIComponent(s).trim())
    .filter(Boolean);
  
  if (spiritNames.length === 0 || spiritNames.length > 3) {
    return new Response('请提供 1-3 个先祖名字（用 wiki 真名）', { status: 400 });
  }
  
  // 2. 读 events.json
  const eventsRes = await context.env.ASSETS.fetch(new URL('/data/events.json', url.origin));
  const eventsData = await eventsRes.json();
  const events = eventsData.events || eventsData;
  
  // 3. 过滤：只保留订阅的先祖的复刻事件
  const filtered = events.filter(e => {
    if (e.type !== 'traveling_spirit') return false;
    if (e.enabled === false) return false;  // 不订阅被禁用的
    const title = e.title.replace('【复刻】', '').replace('【', '').replace('】', '');
    return spiritNames.includes(title);
  });
  
  // 4. 生成 ICS（复用 generateICS 函数）
  const ics = await generateICS(filtered, {
    calName: 'sky-stones - 自定义先祖订阅',
    calDesc: `你订阅的先祖：${spiritNames.join('、')}`,
  });
  
  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="spirit-events.ics"',
    },
  });
}
```

### 4.2 抽出 `functions/_ics-generator.js`

- 从 `functions/events.ics.js` 抽出 `generateICS()` 函数
- `events.ics.js` 和 `spirit-events.ics.js` 都引用
- **不要改 ICS 生成逻辑本身**（只搬位置）

---

## 5. Admin 后台：热门先祖编辑页 `/admin/spirit-hot/`

### 5.1 路由

- 新增 `src/admin/spirit-hot/index.html`（后台页面）
- 加入 `src/admin/_nav.js`（admin 顶部导航，加一个「热门先祖」链接）
- 认证：用现有 `x-admin-key` Cookie（admin 密码登录后持有）

### 5.2 页面布局

```
┌────────────────────────────────────────────┐
│  ⚙️ Admin                  [登出]            │  ← 顶部导航
│                                            │
│  热门先祖配置（最多 8 个）                    │
│                                            │
│  ┌──────────────────────────────────────┐ │
│  │ #1 [▼ 选先祖: 火先知]                 │ │  ← 下拉选 spiritName
│  │ 标题 [火先知（武士裤）]                │ │  ← title 输入框
│  │ 搜索词 [武士裤, 火先知, 裤裤]          │ │  ← searchKeys（逗号分隔）
│  │ 热门物品 [武士裤]                      │ │  ← hotItem
│  │ [↑] [↓] [🗑]                          │ │  ← 上下移动 + 删除
│  └──────────────────────────────────────┘ │
│  ┌──────────────────────────────────────┐ │
│  │ #2 [▼ 选先祖: 致敬钢琴家]               │ │
│  │ 标题 [...]                            │ │
│  │ ...                                   │ │
│  └──────────────────────────────────────┘ │
│                                            │
│  [+ 添加热门先祖]                            │  ← 最多加到 8 个
│                                            │
│  [💾 保存]                                  │
└────────────────────────────────────────────┘
```

### 5.3 数据获取与保存

- **加载**：`GET /api/spirit-hot` → 读 `data/spirit-hot.json`
- **保存**：`POST /api/spirit-hot` body 是新 JSON → 写回仓库
  - 用 GitHub Contents API `PUT /repos/:owner/:repo/contents/data/spirit-hot.json`
  - 需要 base64 编码 + SHA（取最新提交 SHA）
  - 复用 `functions/api/settings.js` 的 GitHub API 工具函数

### 5.4 验证

- 标题不能为空
- spiritName 必须从 soul-spirits.json 里选（不能瞎填）
- searchKeys 自动 trim + 去空
- 最多 8 个

---

## 6. 文件变更清单

| 操作 | 文件路径 | 说明 |
|------|---------|------|
| ➕ 新增 | `src/scripts/fetchSoulSpirits.js` | 从 wiki 爬取旅行先祖回归记录，写 `data/soul-spirits.json` |
| ➕ 新增 | `src/scripts/verify-soul-spirits.js` | 校验 `data/soul-spirits.json` 完整性（去重、字段、wiki 真名） |
| ➕ 新增 | `data/soul-spirits.json` | 纯净版先祖列表（60+ 条，wiki 真名，**codex 爬出来**，**不依赖旧的 spirit-items.json**） |
| ➕ 新增 | `data/spirit-hot.json` | 热门配置（初始 `{"items":[]}`，admin 后台编辑） |
| ➕ 新增 | `spirits.html` | 先祖选择页面（独立 HTML） |
| ➕ 新增 | `functions/spirit-events.ics.js` | 先祖订阅 ICS 输出 |
| ➕ 新增 | `functions/api/spirit-hot.js` | 热门配置的读/写 API（GitHub Contents API） |
| ➕ 新增 | `src/admin/spirit-hot/index.html` | 热门先祖编辑页 |
| ➕ 新增 | `functions/_ics-generator.js` | 抽 ICS 生成逻辑（events.ics.js + spirit-events.ics.js 共享） |
| ✏️ 修改 | `functions/events.ics.js` | 引用 `_ics-generator.js` |
| ✏️ 修改 | `src/scripts/syncEvents.js` | 第 5 步：跑 `fetchSoulSpirits.js` + `verify-soul-spirits.js` |
| ✏️ 修改 | `.github/workflows/sync-events.yml` | 第 5 步加到 CI |
| ✏️ 修改 | `index.html` | 主页加「订阅特定先祖」入口 |
| ✏️ 修改 | `functions/_middleware.js` | `/spirits.html` 和 `/spirit-events.ics` 路径放行 |
| ✏️ 修改 | `src/admin/_nav.js`（如有） | admin 导航加「热门先祖」链接 |
| ✏️ 修改 | `functions/api/admin-login.js`（如有） | 认证 token 加 `/admin/spirit-hot/` 路径 |

---

## 7. 实施步骤（按顺序）

### Step 1：抽 ICS 生成器
1. 看 `functions/events.ics.js`，找到 `generateICS()` 函数
2. 抽到 `functions/_ics-generator.js`
3. `events.ics.js` 改为 import 这个新文件
4. **本地测试** `/events.ics` 输出不变

### Step 2：新建 `data/spirit-hot.json`（初始为空）
```json
{"_meta":{"description":"热门先祖","maxItems":8},"items":[]}
```
- commit + push
- 等 CF Pages 部署

### Step 3：新建 `functions/spirit-events.ics.js`
- 按 4.1 节逻辑
- 测试：`?spirits=致敬钢琴家` 是否有 ICS 输出

### Step 4：新建 `spirits.html`
- 顶部导航 + 搜索框 + 热门横滑 + 全部列表 + 底部按钮
- 暂时硬编码几个先祖调试交互
- 调试完接 soul-spirits.json + spirit-hot.json

### Step 5：实现搜索 + 选中 + 上限逻辑
- 搜索：匹配 `spiritName`（中文名）+ `spiritName` 的拼音首字母 + 拼音全拼
- 选中/取消 + 计数 + 上限 3 个
- 拼音方案：
  - 用 `pinyin-pro` 包（轻量，~30KB）
  - 输入「huo」能匹配「火先知」「风铃修补匠」
  - 输入「xwz」能匹配「希望之种」「小偷先祖」

### Step 0（必须最先做）：爬先祖数据
**这一步必须在 Step 1 之前完成**，否则 `/spirits.html` 没数据可显示。
1. 新建 `src/scripts/fetchSoulSpirits.js`：
   - 用 `cheerio` 解析 `https://wiki.biligame.com/sky/旅行先祖回归记录`
   - 提取表格行：编号 / 名称 / 季节 / 日期
   - dedup by `spiritName`（同一先祖多次回归只留最新一次）
   - 生成 `id` = `pinyin(spiritName, { style: 'slug' })`，重复时加 `-2` / `-3` 后缀
   - 写入 `data/soul-spirits.json`
2. 新建 `src/scripts/verify-soul-spirits.js`：
   - 检查数量 ≥ 50 条
   - 检查无重复 `spiritName`
   - 检查 `spiritName` 都非空
3. 跑通：`node src/scripts/fetchSoulSpirits.js && node src/scripts/verify-soul-spirits.js`
4. **先 commit + push** 让 CF Pages 拿到 `data/soul-spirits.json`
5. 再继续后面 Step 1-7

### Step 6：生成分享链接弹窗
- localStorage 存当前选择
- 生成 `?spirits=xxx,yyy,zzz`（逗号分隔，URL encode）
- 复制 + webcal 唤起

### Step 7：admin 热门编辑页
- 新建 `src/admin/spirit-hot/index.html`
- 加载 / 保存 spirit-hot.json
- 下拉选先祖 + 标题/搜索词/物品输入框
- 上下移动 + 删除

### Step 8：测试 + 推送
- 手动测：选 3 个 → 生成链接 → 日历 App 订阅 → 看是否只收到 3 个
- admin 登录 → 改 1 个热门 → 保存 → 刷新 spirits.html 看效果
- commit + push + 触发 Action

---

## 8. 验收清单

### `/spirits.html` 端
- [ ] 访问 `/spirits.html` 看到 60+ 个先祖（按 `lastRevisit` 倒序）
- [ ] 顶部「⭐ 热门推荐」显示 admin 配置的 0-8 个
- [ ] 热门卡片显示 admin 配的 `title`（不是 wiki 真名）
- [ ] 搜索「火」能过滤出「火先知」
- [ ] 搜索「huo」（拼音）能过滤出「火先知」
- [ ] 搜索「武士裤」（物品名）能过滤出「火先知」
- [ ] 点击未选卡片 → 选中（顶部计数 +1）
- [ ] 点击已选卡片 → 取消（计数 -1）
- [ ] 选到 3 个后，其他卡片置灰 + 「已达上限」小字
- [ ] 点击「生成分享链接」弹窗显示
- [ ] 复制链接成功
- [ ] 「添加到日历」唤起日历 App
- [ ] 订阅后日历里只收到 3 个先祖的复刻事件
- [ ] **祖先到来时（周四 06:00）前 10 分钟弹提醒**
- [ ] 祖先离开前一天晚上（周日 20:00）弹"明晚要走"提醒

### `/admin/spirit-hot/` 端
- [ ] 登录后能访问
- [ ] 看到当前热门列表（可能为空）
- [ ] 「+ 添加」能加 1 个空项
- [ ] 下拉选 spiritName 列出 soul-spirits.json 全部先祖
- [ ] 编辑 title / searchKeys / hotItem
- [ ] 上下箭头调整顺序
- [ ] 「🗑」删除
- [ ] 超过 8 个时按钮禁用
- [ ] 「保存」走 POST，写到仓库
- [ ] 5 分钟内（CF 部署）刷新 spirits.html 看到新热门

---

## 9. 不在本期范围（v3+ 再做）

- ❌ 拼音搜索的 pinyin 包太大 → 用轻量 `pinyin-pro` 或自己建首字母表
- ❌ 多设备同步订阅
- ❌ 先祖详情页（兑换树 / 物品图）
- ❌ 回归预测
- ❌ 推送通知（微信/QQ/邮件）
- ❌ 订阅管理页（修改/取消订阅）
- ❌ 热门推荐自动排序（基于访问量）

---

## 10. 关键决策（给 codex 的 FAQ）

**Q1：为什么用 wiki 真名做 URL 参数，不用 ID？**
A：方便调试，URL 直观。`?spirits=火先知,致敬钢琴家` 一眼能看懂。URL 长度不是瓶颈（3 个名字最多 60 字符）。

**Q2：为什么 spirit-hot.json 不直接用 soul-spirits.json 过滤？**
A：用户/admin 想控制**展示标题**（比如「火先知（武士裤）」比「火先知」更吸引人）和**额外搜索词**（比如「裤裤」这个玩家俗名）。硬过滤会丢掉这些信息。

**Q3：admin 后台写文件会不会丢？**
A：用 GitHub API 是原子操作，commit 失败会回滚。如果担心，可以让 admin 编辑时加一个「预览」步骤。

**Q4：60+ 个先祖性能 OK 吗？**
A：OK。`soul-spirits.json` 才 25KB，前端一次 fetch 完，纯本地操作。搜索 60 条数据 < 5ms。

**Q5：iOS 日历订阅 webcal 协议真的会唤起吗？**
A：会。iOS/Android 都支持 `webcal://` 协议，浏览器/系统会弹出「添加到日历」。

---

> 完成后告诉我，我会 review + 部署。
