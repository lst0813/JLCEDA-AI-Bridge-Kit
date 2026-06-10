# JLCEDA AI Bridge Kit

这是一个把 AI/脚本连接到嘉立创 EDA 专业版的便携工具包。当前验证通过的方案是：

```text
AI/脚本 -> 本地 WebSocket 服务(127.0.0.1:9050) -> jlceda-mcp-bridge 插件 -> 嘉立创 EDA 专业版
```

注意：它不是标准 MCP Server，而是一个带有 `tools.list` / `tools.call` 风格的 WebSocket RPC 桥。

## 目录内容

- `plugin/jlceda-mcp-bridge_v0.0.17.eext`
  - 嘉立创 EDA 专业版插件，已经验证可用。
- `runtime/node.exe`
  - 便携 Node.js 运行时，优先用于稳定脚本。
- `node_modules/ws`
  - Node WebSocket 依赖。
- `scripts/bridge-call.js`
  - 推荐使用的稳定调用器：先监听端口，等插件发 `hello`，再发送请求。
- `ping-node.ps1`
  - 稳定连接测试。
- `list-tools-node.ps1`
  - 列出插件可用工具。
- `call-tool-node.ps1`
  - 通用工具调用入口。
- `get-source-node.ps1`
  - 读取当前工程源文本，用于核对真实连线/网络标签。
- `websocat.exe`、`test-ping.ps1`、`list-tools.ps1`、`call-tool.ps1`
  - 早期备用方案。能用，但有时序竞争，优先用 Node 版脚本。
- `docs/AI_AGENT_GUIDE.md`
  - 给其他 AI 快速学习和避坑的说明。
- `docs/PORTABLE_CHECKLIST.md`
  - 换电脑部署检查清单。

## 新电脑部署步骤

1. 安装并打开嘉立创 EDA 专业版。
2. 在扩展/插件管理里导入：

   ```text
   plugin/jlceda-mcp-bridge_v0.0.17.eext
   ```

3. 启用插件，并允许外部交互/外部访问权限。
4. 在插件配置里把 WebSocket 地址设为：

   ```text
   ws://127.0.0.1:9050
   ```

5. 打开或新建一个工程/原理图。
6. 在 PowerShell 里运行：

   ```powershell
   .\ping-node.ps1
   .\list-tools-node.ps1
   ```

如果 `ping-node.ps1` 返回 `pong`，说明 AI 到嘉立创的连接链路正常。

## 常用命令

在工具包目录内执行：

```powershell
.\ping-node.ps1
.\list-tools-node.ps1
.\call-tool-node.ps1 -Name jlc.bridge.ping -ArgumentsJson "{}"
.\get-source-node.ps1
```

调用任意工具：

```powershell
.\call-tool-node.ps1 -Name 工具名 -ArgumentsJson '{"key":"value"}'
```

## 给 AI 的入口

让新的 AI 先读：

```text
docs/AI_AGENT_GUIDE.md
```

然后执行：

```powershell
.\ping-node.ps1
.\list-tools-node.ps1
```

能连通后，再按 `tools.list` 返回的工具清单操作嘉立创。

## 关键避坑

- 插件是 WebSocket 客户端，脚本必须在本机先监听 `127.0.0.1:9050`。
- 不要把它当标准 MCP Server 接入。
- 优先使用 `*-node.ps1`，不要优先使用 websocat 版脚本。
- 画原理图时不要只放说明文字，要放真实器件、真实连线或真实网络标签。
- 工具返回成功不等于图纸一定正确，最终要用 `jlc.document.get_source` 检查 `WIRE`、`LINE`、`ATTR key=NET` 等源文本。
