# Portable Checklist

把这个目录复制到另一台 Windows 电脑后，按下面顺序检查。

## 必需文件

- `plugin/jlceda-mcp-bridge_v0.0.17.eext`
- `runtime/node.exe`
- `node_modules/ws/package.json`
- `scripts/bridge-call.js`
- `ping.cmd`
- `list-tools.cmd`
- `call-tool.cmd`
- `get-source.cmd`
- `docs/AI_AGENT_GUIDE.md`
- `docs/AI_CAUTION_NOTES.md`
- `docs/BINARY_NOTES.md`

## 嘉立创设置

- 已安装嘉立创 EDA 专业版。
- 已导入 `plugin/jlceda-mcp-bridge_v0.0.17.eext`。
- 插件已启用。
- 外部交互/外部访问权限已允许。
- 插件 WebSocket URL 是：

  ```text
  ws://127.0.0.1:9050
  ```

- 已打开一个工程和原理图。

## 连接测试

在工具包目录串行运行：

```cmd
ping.cmd
list-tools.cmd
```

合格标准：

- `ping.cmd` 返回正常 response 或 `pong`。
- `list-tools.cmd` 能列出 `jlc.*` 工具。
- 默认最多等待 60 秒，因为插件短连接断开后有时需要重新连接。

## 常见问题

### 运行 `.ps1` 被拦截

优先使用 `.cmd` 文件。它们已经带了 `ExecutionPolicy Bypass`。

### 一直超时

检查：

- 嘉立创 EDA 是否打开。
- 插件是否启用。
- 插件 URL 是否为 `ws://127.0.0.1:9050`。
- 是否打开了工程/原理图。
- `9050` 是否被其他进程占用。

### 端口被占用

同一时间只能有一个脚本监听 `9050`。检查：

```powershell
netstat -ano | findstr :9050
```

如果上一个命令刚结束，下一个命令立刻超时，等几秒后重试。

### 另一台电脑没有 Node

本工具包已包含 `runtime/node.exe`。脚本会优先使用它；如果不存在，才会尝试系统里的 `node`。

### 想确认图纸真实连线

运行：

```cmd
get-source.cmd
```

检查返回内容里是否存在 `WIRE`、`LINE`、`ATTR key=NET`。
