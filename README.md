# JLCEDA AI Bridge Kit

这是一个把 AI/脚本连接到嘉立创 EDA 专业版的便携工具包。

当前验证过的连接结构：

```text
AI/脚本 -> 本地 WebSocket Server(127.0.0.1:9050) -> jlceda-mcp-bridge 插件 -> 嘉立创 EDA 专业版
```

注意：它不是标准 MCP Server，而是一个带 `tools.list` / `tools.call` 风格的 WebSocket RPC 桥。

## 包含内容

- `plugin/jlceda-mcp-bridge_v0.0.17.eext`
  - 嘉立创 EDA 专业版插件。
- `runtime/node.exe`
  - 便携 Node.js 运行时，脚本会优先使用它。
- `node_modules/ws`
  - WebSocket 依赖。
- `scripts/bridge-call.js`
  - 推荐调用器：先监听端口，等待插件 `hello`，再发送请求。
- `ping.cmd` / `ping-node.ps1`
  - 连接测试，调用 `jlc.bridge.ping`。
- `list-tools.cmd` / `list-tools-node.ps1`
  - 列出插件当前可用工具。
- `call-tool.cmd` / `call-tool-node.ps1`
  - 调用任意工具。
- `get-source.cmd` / `get-source-node.ps1`
  - 读取当前图纸源数据，用来检查真实连线和真实网络标签。
- `docs/AI_AGENT_GUIDE.md`
  - 给其他 AI 的快速使用说明。
- `docs/AI_CAUTION_NOTES.md`
  - 给其他 AI 的画图避坑说明。
- `docs/PORTABLE_CHECKLIST.md`
  - 换电脑部署检查清单。
- `docs/BINARY_NOTES.md`
  - 二进制文件和大文件说明。

## 新电脑部署

1. 安装并打开嘉立创 EDA 专业版。
2. 在扩展/插件管理里导入：

   ```text
   plugin/jlceda-mcp-bridge_v0.0.17.eext
   ```

3. 启用插件，并允许外部交互/外部访问权限。
4. 在插件设置页把 WebSocket URL 设为：

   ```text
   ws://127.0.0.1:9050
   ```

5. 打开或新建一个工程/原理图。
6. 在本工具包目录运行：

   ```cmd
   ping.cmd
   list-tools.cmd
   ```

如果 `ping.cmd` 返回正常 response 或 `pong`，说明连接链路正常。
默认最多等待 60 秒，因为插件短连接断开后有时需要一点时间重新连接。

## 常用命令

推荐使用 `.cmd` 入口，避免 PowerShell 执行策略拦截：

```cmd
ping.cmd
list-tools.cmd
call-tool.cmd -Name jlc.bridge.ping -ArgumentsJson "{}"
get-source.cmd
```

也可以直接用 PowerShell：

```powershell
PowerShell -NoProfile -ExecutionPolicy Bypass -File .\ping-node.ps1
PowerShell -NoProfile -ExecutionPolicy Bypass -File .\list-tools-node.ps1
PowerShell -NoProfile -ExecutionPolicy Bypass -File .\call-tool-node.ps1 -Name jlc.bridge.ping -ArgumentsJson "{}"
```

## 给 AI 的入口

新的 AI 接手时，先读：

```text
docs/AI_AGENT_GUIDE.md
docs/AI_CAUTION_NOTES.md
docs/PORTABLE_CHECKLIST.md
```

然后串行执行：

```cmd
ping.cmd
list-tools.cmd
```

## 关键避坑

- 插件是 WebSocket 客户端，脚本必须先在本机监听 `127.0.0.1:9050`。
- `9050` 同一时间只能有一个脚本监听，命令必须串行运行，不要并发跑。
- 如果刚跑完一个命令后下一个命令超时，等几秒再重试，通常是插件短连接重连延迟。
- 不要把它当标准 MCP Server 接入。
- 优先使用 Node 版脚本和 `.cmd` 入口，`websocat.exe` 只作为备用。
- 画原理图时，普通文字不是网络标签，视觉上贴近引脚也不一定真实连接。
- 工具返回 success 不等于图纸电气正确，最终要用 `jlc.document.get_source` 检查 `WIRE`、`LINE`、`ATTR key=NET`。
