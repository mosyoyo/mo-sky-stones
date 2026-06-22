# 使用教学 + 推广合规 Plan

> 给 Codex 的实施指引。本项目是 `mosyoyo/mo-sky-stones`（Sky:CoL ICS 日历订阅服务）。  
> 本次改造涉及：主页内嵌订阅引导、iOS / 安卓使用教学、QQ 群跳转、推广文案合规声明。

---

## 1. 问题背景

当前主页（`index.html`）点击「订阅光遇日历」后：
- **iOS**：跳转 `webcal://` 协议，弹出「是否订阅」——但订阅后 iOS 会**默认关闭日历提醒**，用户收不到任何提醒，体验很差。需要告诉用户去「设置 → 日历 → 账户」把「提醒」开关打开。
- **安卓**：直接把 `httpsUrl` 复制到剪贴板，但用户不知道下一步去哪里粘贴，容易迷路。
- **PC**：复制链接后同样缺少下一步指引。

---

## 2. iOS 订阅引导

### 2.1 问题根因

iOS 的「互联网日历」（订阅日历）在 **iOS 16+** 后，**新建的订阅日历默认把「提醒」关掉**。  
具体路径：`设置 → 日历 → 账户 → 已订阅的日历 → 选中日历 → 提醒（开关）`

如果用户不手动打开这个开关，ICS 里所有 `VALARM` 都会被静默忽略，用户看不到任何提醒。

### 2.2 实现方案

**方案**：iOS 点「订阅」后，先跳转 `webcal://`，同时在主页上展示一个「iOS 开启提醒」步骤卡片。

**触发时机**：
- 当 UA 检测到 `iPhone|iPad|iPod` 时，`webcal://` 跳转后，在页面下方**立即展示提醒卡片**（不是弹窗，避免被浏览器拦截）

**卡片内容（文字）**：

```
订阅后，还需要手动开启提醒：

设置 → 日历 → 账户 → 已订阅的日历 → 光遇日历 → 提醒（打开）

⚠️ 不开启则收不到任何提醒
```

**实现细节（对 `index.html` JS 部分）**：

```js
document.querySelector('#subscribe').addEventListener('click', async () => {
  const ua = navigator.userAgent || '';
  const isAppleMobile = /iPhone|iPad|iPod/i.test(ua);
  if (isAppleMobile) {
    location.href = webcalUrl;
    // 显示 iOS 提醒引导卡片
    document.querySelector('#ios-guide').hidden = false;
    return;
  }
  await copyLink();
});
```

**HTML 新增（在 `#subscribe` 按钮下方，默认 `hidden`）**：

```html
<div id="ios-guide" hidden>
  <div class="guide-card">
    <p class="guide-title">📲 订阅后，需要手动开启提醒</p>
    <ol class="guide-steps">
      <li>打开「设置」App</li>
      <li>进入「日历」→「账户」</li>
      <li>找到「已订阅的日历」→「光遇日历」</li>
      <li>打开「提醒」开关</li>
    </ol>
    <p class="guide-note">⚠️ iOS 默认关闭订阅日历的提醒，不手动开启则收不到任何提醒。</p>
  </div>
</div>
```

**CSS（加到 `<style>` 块）**：

```css
.guide-card {
  margin-top: 18px;
  padding: 18px 20px;
  border: 1px solid rgba(255, 200, 0, .5);
  border-radius: 18px;
  background: rgba(255, 249, 210, .85);
  text-align: left;
  width: 100%;
  max-width: 420px;
}
.guide-title {
  margin: 0 0 10px;
  font-size: 15px;
  font-weight: 700;
  color: #1d1d1f;
}
.guide-steps {
  margin: 0 0 10px;
  padding-left: 20px;
  font-size: 14px;
  line-height: 1.7;
  color: #3a3a3c;
}
.guide-note {
  margin: 0;
  font-size: 12px;
  color: #8a6a00;
}
```

---

## 3. 安卓订阅引导

### 3.1 现状

安卓 UA 检测：非 iOS 设备点「订阅」后，当前是**直接复制链接**并 toast「已复制订阅链接，请粘贴到日历 App」。

但玩家不一定知道用哪个日历 App，也不知道「导入 URL 订阅」在哪里找。

### 3.2 推荐步骤（主流安卓方案）

**Google Calendar（推荐，大部分安卓玩家都有）**：

```
1. 复制订阅链接（点「订阅光遇日历」按钮）
2. 打开「Google 日历」App
3. 点右上角头像 → 搜索设置 → 「通过 URL 添加日历」
   （或 PC 版：日历.google.com → 设置 → 添加其他日历 → 通过 URL）
4. 粘贴链接 → 「添加日历」
5. 完成
```

**三星 / MIUI 系统日历**：

```
1. 复制订阅链接
2. 打开系统「日历」App → 设置（侧边栏或右上角）→「添加账户」→「CalDAV / 订阅」
3. 粘贴链接 → 确认
```

### 3.3 实现方案

安卓点按钮后，展示一个「安卓引导卡片」（类似 iOS 卡片，但内容不同）：

```js
// 非 iOS 设备
async function copyLink() {
  await navigator.clipboard.writeText(httpsUrl);
  showToast('✅ 链接已复制');
  // 展示安卓订阅引导
  document.querySelector('#android-guide').hidden = false;
}
```

**HTML（默认 hidden）**：

```html
<div id="android-guide" hidden>
  <div class="guide-card guide-card--android">
    <p class="guide-title">📋 链接已复制，下一步：</p>
    <ol class="guide-steps">
      <li>打开 <strong>Google 日历</strong> App</li>
      <li>右上角头像 → 日历设置 → 「通过 URL 添加日历」</li>
      <li>粘贴链接 → 添加日历</li>
    </ol>
    <p class="guide-note">也支持系统自带日历 → 设置 → 添加账户 → 订阅日历，粘贴链接。</p>
  </div>
</div>
```

---

## 4. QQ 群跳转链接

### 4.1 需求

在主页加一个 QQ 群按钮，方便玩家加群。

### 4.2 QQ 群跳转 URL 格式

```
https://qm.qq.com/cgi-bin/qm/qr?k=<key>&authKey=<authKey>
```

或者更简单的：

```
https://jq.qq.com/?_wv=1027&k=<key>
```

**如何获取**：QQ 群 → 群名称 → 更多 → 分享 → 复制链接，就是上面这个格式。

### 4.3 实现

在主页底部二级操作区加一个 QQ 群链接：

```html
<div class="secondary-actions">
  <a class="advanced" href="/subscribe">自定义订阅</a>
  <a class="advanced" href="/spirits">指定先祖</a>
  <a class="advanced" href="https://jq.qq.com/?_wv=1027&k=XXXXXX" target="_blank" rel="noopener">加 QQ 群</a>
</div>
```

> ⚠️ **codex 注意**：`XXXXXX` 是 QQ 群链接的 key，需要由管理员（喵喵）替换成实际的群 key。请在代码里加注释 `<!-- TODO: 替换为实际 QQ 群 key -->`，不要随意填写。

---

## 5. 推广策略（抖音 / 小红书外链限制）

### 5.1 问题分析

各平台对外链的限制：

| 平台 | 外链政策 | 绕过方法 |
|------|---------|---------|
| **抖音** | 视频、图文、评论均不能放可点击外链 | 在视频里 / 图片里写出链接文字，引导「去 XX 搜索」或「主页简介里有」 |
| **小红书** | 正文可以写链接文字但不可点击，评论偶尔能附链接 | 在图片上叠加链接文字；让用户截图扫二维码 |
| **B 站** | 动态（视频简介、专栏）可放外链，审核较宽松 | 直接贴链接即可 |
| **微博** | 可以放外链，但分享量比较少 | 直接贴链接 |
| **QQ 群** | 无限制，可直接贴链接 | ✅ 最佳渠道 |
| **微信群 / 朋友圈** | 朋友圈可跳转，公众号可放外链 | ✅ 有效 |

### 5.2 推荐推广方式

**方案 A：QQ 群直推（推荐首选）**
- 进入光遇 QQ 群（或相关游戏群），直接贴链接 + 简短介绍
- 「光遇日历订阅，自动提醒复刻、双倍、维护，免费用：sky-ics.pages.dev」
- 群内玩家粘性高，传播精准

**方案 B：小红书图文（适合图文版）**
- 做一张图：**「光遇日历订阅怎么用？」** 图片内嵌步骤截图 + URL 文字
- 文案技巧：在图片里写 `sky-ics.pages.dev`（文字不是链接，平台不拦截）
- 正文说「地址在图片里，手动输入」或「评论区见」
- 重要：**不要在正文里直接写外链**，会被降流

**方案 C：抖音 / 视频（适合视频版）**
- 录一段 15-30 秒操作演示（iPhone / 安卓各一个）
- 视频里嘴上说「去 sky-ics.pages.dev 搜索」或屏幕上打出 URL
- 简介里放「完整教程在主页简介」
- **不要在评论区主动放链接**，容易被流量惩罚

**方案 D：生成二维码（推荐配合图文）**
- 在主页 `index.html` 末尾加一个「生成二维码」功能（用 QR Code 库）
- 玩家截图发到群里 / 朋友圈，别人扫码即可
- 实现：`<script src="https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js"></script>`，在按钮旁边加「生成二维码」

> 这个功能**减少了分享成本**，符合项目第一性原则。

### 5.3 文案模板（可直接用）

**QQ 群文案（简短版）**：
```
📅 光遇日历订阅（免费）
自动提醒 | 复刻先祖 | 季节结束 | 双倍爱心 | 大蜡烛 | 维护
iPhone / 安卓都支持

地址：sky-ics.pages.dev
```

**小红书图文文案**：
```
光遇玩家必备！日历订阅永远不错过复刻先祖

📅 订阅后会自动提醒你：
・ 复刻先祖来了（提前提醒）
・ 季节快结束了
・ 双倍爱心开始/结束
・ 大蜡烛时间
・ 游戏维护时间

免费，不需要下载任何 App，苹果安卓电脑全支持。

地址在图片里 👆（手动输入到浏览器）

#光遇 #天空之光 #游戏日历 #复刻先祖
```

---

## 6. 合规声明

### 6.1 数据来源说明

项目数据来源：
1. **光遇 Wiki（wiki.biligame.com/sky）**：复刻先祖、季节、活动事件（CC BY-SA 4.0 授权，允许非商业使用，须标注来源）
2. **网易大神**：双倍爱心、大蜡烛、维护时间（公开动态抓取，非商业用途）

### 6.2 需要在主页加的免责声明

在页面底部 `footer` 里加一行小字：

```html
<span class="credit-note">数据来源：光遇 Wiki · 网易大神官方公告，每 6 小时更新，非官方产品</span>
```

**完整 footer 建议结构**：

```html
<footer>
  <span>© 2026 sky-ics</span>
  <span class="credit">by 喵喵</span>
  <span class="credit-note">
    数据来自
    <a href="https://wiki.biligame.com/sky/首页" target="_blank" rel="noopener">光遇 Wiki</a>
    ·
    <a href="https://ds.163.com/" target="_blank" rel="noopener">网易大神</a>，每 6 小时更新。
    非官方产品，与游戏官方无关。
  </span>
</footer>
```

### 6.3 合规风险点

| 风险 | 分析 | 建议 |
|------|------|------|
| **Wiki 版权** | Wiki 内容为 CC BY-SA 4.0，非商业使用可以，需标注来源 | 已在 footer 标注，✅ |
| **网易大神数据** | 抓取公开动态，仅做时间提取，非商业用途，符合合理使用 | 加「非官方产品」声明 ✅ |
| **游戏商标** | 「光遇」是 thatgamecompany / 网易的商标。项目名/域名不直接用「光遇」字样 | **不要在项目域名里用「光遇」** |
| **官方 API 调用** | 项目没有调用任何官方 API，仅读取公开 HTML，风险低 | ✅ 无风险 |
| **商业化** | 目前纯公益，无广告无收费 | 保持公益性质可避免版权纠纷 |

> 总体来说：**非商业 + 标注来源 + 加非官方声明 = 合规风险极低**，类似的工具（光遇 Wiki 本身、各类攻略站）都以这种方式运营。

---

## 7. 需要在 `index.html` 做的代码改动

### 7.1 文件改动清单

| 操作 | 文件 | 说明 |
|------|------|------|
| ✏️ 修改 | `index.html` | 加 iOS 引导卡片、安卓引导卡片、QQ 群链接、footer 合规声明、二维码按钮 |
| ➕ 新增（可选） | `subscribe.html` 或 `/subscribe/index.html` | 专属「订阅教学」页面（独立页面，可分享链接） |

### 7.2 `index.html` 完整改动列表

1. **iOS 引导卡片** (`#ios-guide`, 默认 `hidden`，iOS 用户点按钮后显示)
2. **安卓引导卡片** (`#android-guide`, 默认 `hidden`，非 iOS 用户点按钮后显示)
3. **QQ 群链接** (加到 `.secondary-actions` 里，`href` 换成实际 QQ 群地址)
4. **footer 合规声明** (数据来源 + 非官方声明，小字，不喧宾夺主)
5. **（可选）生成二维码按钮** (`#qrcode-btn`，用 qrcode.js 生成，展示在卡片下方)

### 7.3 生成二维码（可选）

如果要做，加这段：

```html
<!-- 在 .secondary-actions 后面 -->
<div id="qr-container" hidden style="margin-top:16px; text-align:center;">
  <canvas id="qr-canvas"></canvas>
  <p style="font-size:12px; color: var(--muted); margin:6px 0 0;">扫码或截图分享给好友</p>
</div>
<button id="qr-btn" class="advanced" type="button" style="margin-top:8px;">生成二维码</button>
```

```js
document.querySelector('#qr-btn').addEventListener('click', () => {
  const container = document.querySelector('#qr-container');
  container.hidden = false;
  QRCode.toCanvas(document.querySelector('#qr-canvas'), httpsUrl, { width: 160, margin: 1 });
});
```

```html
<script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
```

---

## 8. 独立订阅教学页（可选）

如果需要一个**可分享的教学链接**（比如在群里发「ios 教学：sky-ics.pages.dev/guide」），可以新建一个独立页面 `guide.html`，内容包括：

1. 大标题：「如何订阅光遇日历？」
2. Tab 切换：「iPhone / iPad」「安卓」「电脑」
3. 每个 Tab 里有截图 + 文字步骤
4. 底部大按钮「立即订阅」跳回主页

实现成本较高，本期可以不做。**建议做完主页引导卡片先验证用户是否有困惑，再决定要不要单独出教学页。**

---

## 9. 验收清单

- [ ] iOS 用户点「订阅」后，`#ios-guide` 卡片显示 4 步引导
- [ ] 非 iOS 用户点「订阅」后，`#android-guide` 卡片显示 3 步引导
- [ ] 两个引导卡片在第二次点击时**不重复显示**（已显示就不再 toggle）
- [ ] QQ 群链接正确跳转（实际 key 已替换）
- [ ] footer 有数据来源说明 + 非官方声明
- [ ] （可选）二维码按钮生成正确的订阅 URL 的二维码
- [ ] 移动端（360px 宽）排版不变形

---

> 完成后告诉我，我会 review + 测试。
