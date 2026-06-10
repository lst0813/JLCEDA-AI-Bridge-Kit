# Portable Checklist

把这个目录复制到另一台 Windows 电脑后，按下面顺序检查。

## 必需文件

- `plugin/jlceda-mcp-bridge_v0.0.17.eext`
- `runtime/node.exe`
- `node_modules/ws/package.json`
- `scripts/bridge-call.js`
- `ping-node.ps1`
- `list-tools-node.ps1`
- `call-tool-node.ps1`
- `get-source-node.ps1`

## 嘉立创设置

- 已安装嘉立创 EDA 专业版。
- 已导入 `plugin/jlceda-mcp-bridge_v0.0.17.eext`。
- 插件已启用。
- 外部交互/外部访问权限已允许。
- 插件 URL 是：

  ```text
  ws://127.0.0.1:9050
  ```

- 已打开一个工程和原理图。

## 连接测试

在工具包目录运行：

```powershell
.\ping-node.ps1
.\list-tools-node.ps1
```

合格标准：

- `ping-node.ps1` 返回 `pong` 或正常 response。
- `list-tools-node.ps1` 能列出 `jlc.*` 工具。

## 常见问题

### 运行 ps1 被拦截

可以临时使用：

```powershell
PowerShell -ExecutionPolicy Bypass -File .\ping-node.ps1
```

### 一直超时

优先检查插件 URL、插件权限、嘉立创是否打开、是否有工程、9050 是否被占用。

### 另一台电脑没有 Node

本工具包已包含 `runtime/node.exe`。脚本会优先使用它；如果不存在，才会尝试系统里的 `node`。

### 想确认图纸真实连线

运行：

```powershell
.\get-source-node.ps1
```

检查返回内容里是否存在 `WIRE`、`LINE`、`ATTR key=NET`。
