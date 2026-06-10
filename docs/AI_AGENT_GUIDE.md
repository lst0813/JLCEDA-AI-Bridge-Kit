# AI Agent Guide for JLCEDA AI Bridge Kit

这份文档是给接手的 AI 看的。目标是让 AI 快速知道：这是什么、怎么连、怎么调用、怎么验证，以及哪些坑不要再踩。

## 1. 这套东西是什么

`JLCEDA-AI-Bridge-Kit` 是一个便携包，用来让 AI/脚本控制嘉立创 EDA 专业版。

连接结构：

```text
AI/脚本
  -> 本地 WebSocket Server: ws://127.0.0.1:9050
  -> 嘉立创插件: jlceda-mcp-bridge v0.0.17
  -> 嘉立创 EDA 专业版当前打开的工程
```

重要判断：

- 这不是标准 MCP Server。
- 插件侧是 WebSocket client。
- AI 侧脚本要先在本地开 WebSocket server，等待插件连进来。
- 插件连上后会先发 `hello`，AI 侧要等到 `hello` 后再发请求。
- 请求风格类似 MCP：`tools.list` 和 `tools.call`。

## 2. 首选调用方式

优先使用 Node 版脚本：

```powershell
.\ping-node.ps1
.\list-tools-node.ps1
.\call-tool-node.ps1 -Name jlc.bridge.ping -ArgumentsJson "{}"
.\get-source-node.ps1
```

不要优先使用早期 websocat 脚本。websocat 能作为备用，但它的一次性发送容易遇到时序问题：请求可能早于插件 `hello`，导致插件没收到或结果不稳定。

## 3. 新电脑最小部署

1. 安装嘉立创 EDA 专业版。
2. 导入插件：

   ```text
   plugin/jlceda-mcp-bridge_v0.0.17.eext
   ```

3. 启用插件。
4. 打开插件外部交互/外部访问权限。
5. 配置插件 WebSocket URL：

   ```text
   ws://127.0.0.1:9050
   ```

6. 打开一个工程和原理图。
7. 在本工具包目录运行：

   ```powershell
   .\ping-node.ps1
   .\list-tools-node.ps1
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

`scripts/bridge-call.js` 已经封装了这些细节。通常不要自己手写 WebSocket 客户端，除非需要批处理或调试。

## 5. 常用命令模板

列出工具：

```powershell
.\list-tools-node.ps1
```

调用一个工具：

```powershell
.\call-tool-node.ps1 -Name 工具名 -ArgumentsJson '{"参数名":"参数值"}'
```

读取当前文档源文本：

```powershell
.\get-source-node.ps1
```

直接使用 JS 调用器：

```powershell
.\runtime\node.exe .\scripts\bridge-call.js --method tools.list
.\runtime\node.exe .\scripts\bridge-call.js --tool jlc.bridge.ping --args "{}"
```

## 6. 原理图自动化避坑

### 必须是真实对象

做原理图时，不能只放普通文字说明。用户要的是：

- 真实器件。
- 真实引脚。
- 真实导线。
- 真实网络标签。
- 可读、分区清晰的电路结构。

### 优先用网络标签保持可读性

复杂原理图不要乱拉长线。推荐：

- MCU 放中间。
- 电源、复位、启动、时钟、下载、USB、串口分区摆放。
- 短导线接到网络标签。
- 同一信号使用同名网络标签连接。

例如 STM32F103C8T6 最小系统常见网络：

```text
+3V3
GND
NRST
BOOT0
HSE_IN
HSE_OUT
SWDIO
SWCLK
USART1_TX
USART1_RX
USB_DM
USB_DP
+5V
```

### 不要只相信工具返回 success

部分工具可能返回成功，但当前图纸源里没有实际产生连线或网络属性。最终要用：

```powershell
.\get-source-node.ps1
```

检查源文本里是否有：

```text
WIRE
LINE
ATTR key=NET
```

真实连线/网络标签验证优先级：

1. `jlc.document.get_source` 源文本。
2. 用户截图观察。
3. 其他 snapshot/list 工具。

如果 snapshot/list 说数量为 0，但 `document.get_source` 里能看到 `WIRE`、`LINE`、`ATTR key=NET`，以源文本为准。

## 7. 中文和编码

PowerShell 管道或 heredoc 有时会把中文变成 `????`。如果要批量发送中文说明文字，优先：

- 使用 UTF-8 文件输入。
- 或在 JS 中使用 Unicode 字符串。
- 或先少量测试中文是否正常显示。

用户偏好：说明性文字尽量中文，但电气网络名可以按行业习惯使用英文/符号，例如 `SWDIO`、`+3V3`、`GND`。

## 8. 故障判断

### `ping-node.ps1` 超时

检查：

- 嘉立创 EDA 专业版是否打开。
- 插件是否启用。
- 插件 URL 是否为 `ws://127.0.0.1:9050`。
- 当前是否有工程/原理图打开。
- 9050 端口是否被其他进程占用。

### 端口被占用

关闭旧的脚本进程，或检查监听：

```powershell
netstat -ano | findstr :9050
```

### 插件一直 connecting

这是正常现象之一：因为插件是 client，只有当脚本正在监听 `9050` 时才会 connected。先运行 `ping-node.ps1`，脚本会开监听，插件连进来后完成请求。

### 工具清单为空或调用失败

先重新运行：

```powershell
.\ping-node.ps1
.\list-tools-node.ps1
```

再确认当前嘉立创工程处于可编辑状态。

## 9. AI 操作准则

- 先连通：`ping-node.ps1`。
- 再发现能力：`list-tools-node.ps1`。
- 再小步调用工具，不要一次性大批量乱画。
- 每一组绘图动作后，用 `get-source-node.ps1` 或截图确认真实效果。
- 涉及电路连接时，优先用网络标签，不要为了“看起来连上”乱拉跨页长线。
- 用户指出方向/位置/标签问题时，要学习布局规律，批量修正同类问题。
- 最终交付前，说明你验证了哪些内容。

## 10. 与旧项目的关系

旧的 `jlcmcp-master` 项目可以作为研究材料，但当前可用的主线是：

```text
JLCEDA-AI-Bridge-Kit
  + marketplace 插件 jlceda-mcp-bridge_v0.0.17.eext
  + Node WebSocket 调用器
```

如果目标是“可复制到别的电脑马上用”，优先使用本工具包。
