# AI Agent Guide

这份文档给接手的 AI 使用。目标是快速知道这套工具怎么连接嘉立创 EDA、怎么调用工具、以及哪些地方不能误判。

## 1. 连接模型

当前主线不是标准 MCP Server，而是 WebSocket RPC：

```text
AI/脚本
  -> 本地 WebSocket Server: ws://127.0.0.1:9050
  -> 嘉立创插件: jlceda-mcp-bridge v0.0.17
  -> 嘉立创 EDA 专业版当前打开的工程
```

关键点：

- 插件是 WebSocket client。
- AI/脚本要先监听 `127.0.0.1:9050`。
- 插件连上后会先发送 `hello`。
- 收到 `hello` 后再发送请求。
- 请求风格类似 MCP，主要是 `tools.list` 和 `tools.call`。
- `9050` 同一时间只能被一个脚本监听，所以命令必须串行执行。
- 插件短连接断开后可能需要几秒到几十秒重连，默认脚本最多等待 60 秒。

## 2. 首选命令

优先使用 `.cmd` 入口，避免 PowerShell 执行策略问题：

```cmd
ping.cmd
list-tools.cmd
call-tool.cmd -Name jlc.bridge.ping -ArgumentsJson "{}"
get-source.cmd
```

也可以使用 PowerShell 入口：

```powershell
PowerShell -NoProfile -ExecutionPolicy Bypass -File .\ping-node.ps1
PowerShell -NoProfile -ExecutionPolicy Bypass -File .\list-tools-node.ps1
PowerShell -NoProfile -ExecutionPolicy Bypass -File .\call-tool-node.ps1 -Name jlc.bridge.ping -ArgumentsJson "{}"
PowerShell -NoProfile -ExecutionPolicy Bypass -File .\get-source-node.ps1
```

不要优先使用早期 websocat 脚本。websocat 可以备用，但一次性发送容易遇到时序问题。

## 3. 新电脑最小部署

1. 安装嘉立创 EDA 专业版。
2. 导入插件：

   ```text
   plugin/jlceda-mcp-bridge_v0.0.17.eext
   ```

3. 启用插件，并允许外部交互/外部访问权限。
4. 在插件设置页配置 WebSocket URL：

   ```text
   ws://127.0.0.1:9050
   ```

5. 打开工程和原理图。
6. 在工具包目录运行：

   ```cmd
   ping.cmd
   list-tools.cmd
   ```

## 4. 请求格式

列工具：

```json
{
  "type": "request",
  "id": "tools-1",
  "method": "tools.list",
  "closeAfterResponse": true
}
```

调用工具：

```json
{
  "type": "request",
  "id": "call-1",
  "method": "tools.call",
  "params": {
    "name": "jlc.bridge.ping",
    "arguments": {}
  },
  "closeAfterResponse": true
}
```

通常直接使用 `scripts/bridge-call.js` 或 `.cmd` 包装脚本，不要自己手写 WebSocket 客户端。

## 5. 原理图自动化注意事项

先读：

```text
docs/AI_CAUTION_NOTES.md
```

核心原则：

- 命令返回 success 不等于原理图电气正确。
- 普通文字不是网络标签。
- 视觉上贴近引脚不一定真实连接。
- 关键步骤后必须用 `get-source.cmd` / `jlc.document.get_source` 回读图纸源数据，或让用户截图确认。

推荐流程：

```text
列出工具
-> 小步绘制一个功能块
-> 回读源数据检查真实器件/导线/NET 标签
-> 看截图修布局和可读性
-> 再继续下一块
```

## 6. 真实连接检查

运行：

```cmd
get-source.cmd
```

检查源数据里是否存在：

```text
WIRE
LINE
ATTR key=NET
```

如果 snapshot/list 工具显示数量异常，但 `document.get_source` 里能看到真实 `WIRE`、`LINE`、`ATTR key=NET`，优先以源数据为准。

## 7. 常见故障

### 超时

检查：

- 嘉立创 EDA 是否打开。
- 插件是否启用。
- 插件 URL 是否为 `ws://127.0.0.1:9050`。
- 当前是否有工程/原理图打开。
- `9050` 是否被其他进程占用。

### 端口占用

检查：

```powershell
netstat -ano | findstr :9050
```

AI 不要并发运行多个连接命令。
如果刚完成一个命令后下一个命令超时，等待几秒后串行重试。

### 插件显示 connecting

这是正常现象之一。插件是 client，只有当脚本正在监听 `9050` 时才会 connected。先运行 `ping.cmd`，脚本会临时监听，插件连进来后完成请求。

### 中文乱码

PowerShell 终端显示可能乱码，但文件本身可以是 UTF-8。向嘉立创批量写中文说明时，优先通过 UTF-8 文件或 JS 字符串发送，并先少量测试。
