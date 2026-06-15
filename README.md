# sky-stones-ics

> 光遇国服红黑石时间表 → iCal 日历订阅

基于 [CikiSyteen/sky-stones](https://github.com/CikiSyteen/sky-stones) 嘅游戏规则逆向算法，生成标准 `.ics` 日历订阅文件，手机日历一键订阅。

## 🎯 特性

- ✅ **零外部依赖** — 纯算法推算，无 API、无爬虫
- ✅ **永久不需要更新** — 游戏规则不变，代码就不变
- ✅ **完全免费** — 部署在 Cloudflare Pages 免费额度内
- ✅ **隐私安全** — 无任何凭据泄露风险
- ✅ **零打扰** — 每日只推送最后一场，自带 15 分钟提醒

## 📅 订阅链接

部署完成后有两个独立订阅：

| 链接 | 内容 |
|---|---|
| `https://sky.yourdomain.com/red.ics` | 红石订阅（每日最后一场）|
| `https://sky.yourdomain.com/black.ics` | 黑石订阅（每日最后一场）|

> 想订阅边个就复制边个 URL，唔需要两个都订阅。

## 🛠️ 部署

### 1. Fork & 推送

```bash
git clone <your-fork-url>
cd sky-stones-ics
git push
```

### 2. Cloudflare Pages 部署

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
3. 选你 fork 嘅仓库
4. **Build settings**:
   - Build command: 留空
   - Build output directory: 留空
5. 点 **Save and Deploy**

### 3. 绑定自定义域名

1. Cloudflare Pages → **Custom domains**
2. 输入 `sky.yourdomain.com`
3. DNS 自动配置

## 📱 手机订阅

### iPhone

**方法 A（推荐）**：点 `webcal://sky.yourdomain.com/red.ics` 链接
**方法 B**：
```
设置 → 邮件 → 账户 → 添加账户 → 其他 → 添加已订阅日历
URL: https://sky.yourdomain.com/red.ics
```

### Android (Outlook)

```
Outlook: 日历 → 添加日历 → 订阅 Web 日历
URL: https://sky.yourdomain.com/red.ics
```

### Google Calendar

```
Google Calendar 网页版 → 设置 → 添加日历 → 来自 URL
URL: https://sky.yourdomain.com/red.ics
```

## 📂 项目结构

```
sky-stones-ics/
├── config.js              # 红黑石规则配置
├── calendar-engine.js     # 推算引擎
├── ics-generator.js       # .ics 文件生成
├── functions/
│   ├── red.ics.js         # 红石订阅路由
│   └── black.ics.js       # 黑石订阅路由
├── package.json
├── test.js                # 本地测试脚本
└── README.md
```

## 🧪 本地测试

```bash
node test.js
```

输出 `preview-red.ics` 和 `preview-black.ics` 两个本地测试文件，可直接导入日历 app 测试。

## 📜 数据来源

游戏规则数据来自 [CikiSyteen/sky-stones](https://github.com/CikiSyteen/sky-stones) 项目（MIT 协议），系玩家社区基于游戏内机制逆向得出。

## ⚠️ 免责声明

- 本工具仅供个人学习使用
- 规则可能因游戏更新而失效，如发现时间不准请提 Issue
- 不属于游戏官方工具，与 thatskygame / 网易无任何关系
