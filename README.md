# mo-sky-stones

光遇国服红黑石最后一场 iCalendar 订阅。核心规则来自
[CikiSyteen/sky-stones](https://github.com/CikiSyteen/sky-stones)，这里只保留计算和 `.ics`
输出，不包含网页。

## 订阅地址

- `/red.ics`: 红石最后一场
- `/black.ics`: 黑石最后一场

规则：当天有红黑石时只写入最后一场；如果最后一场从 23 点以后开始，则写入前一场。

## Cloudflare Pages

Pages 连接本仓库即可。无需构建命令，无需依赖安装，Functions 会直接响应订阅文件。

## 本地检查

```bash
npm test
```

脚本会生成 `preview-red.ics` 和 `preview-black.ics`，并检查 CRLF、UTC 时间和每日唯一事件。
