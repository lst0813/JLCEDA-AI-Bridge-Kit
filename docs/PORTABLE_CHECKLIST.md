# 便携部署检查清单

把这个工具包复制到另一台 Windows 电脑时，按这份清单检查。

## 必需文件

```text
jlc-agent.cmd
agent/jlc-agent.js
plugin/jlceda-mcp-bridge_v0.0.17.eext
runtime/node.exe
node_modules/ws/package.json
node_modules/ws/index.js
scripts/bridge-call.js
package.json
README.md
docs/AGENT_USAGE.md
docs/REPOSITORY_STRUCTURE.md
docs/AI_AGENT_GUIDE.md
docs/AI_CAUTION_NOTES.md
docs/BINARY_NOTES.md
```

旧入口不是必须，但保留后兼容性更好：

```text
ping.cmd
list-tools.cmd
get-source.cmd
call-tool.cmd
```

## 嘉立创设置

1. 安装并打开嘉立创 EDA 专业版或目标私有化版本。
2. 导入 `plugin/jlceda-mcp-bridge_v0.0.17.eext`。
3. 启用扩展。
4. 如果客户端提示权限，允许外部访问/外部交互。
5. 设置扩展 WebSocket URL：

   ```text
   ws://127.0.0.1:9050
   ```

6. 打开工程，并切到原理图页面。

## 连接测试

在工具包目录运行：

```cmd
jlc-agent.cmd ping
jlc-agent.cmd current
jlc-agent.cmd read --report-dir reports/latest --no-drc
```

合格表现：

- `ping` 返回桥接响应。
- `current` 显示当前工程/文档。
- `read` 写出 `reports/latest/diagnostics.json`。
- 当前是原理图页面时，`diagnostics.json` 里应显示 `status: "ok"`。

## 常见问题

### 命令超时

检查嘉立创是否打开、扩展是否启用、URL 是否正确、当前是否为原理图页面。

扩展显示 `connecting` 不一定异常；没有本地命令监听时，它本来就连不上。

### 端口被占用

同一时间只能有一个进程监听 `9050`：

```powershell
netstat -ano | findstr :9050
```

等上一个命令退出后，再运行下一个命令。

### 没有 Node

工具包自带 `runtime/node.exe`。如果它被删除或被安全软件拦截，可以安装官方 Node.js，
或者恢复这个便携运行时。
