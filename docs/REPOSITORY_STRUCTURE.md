# 仓库结构

这个仓库围绕“稳定读图/审图”来组织。

## 主链路

```text
jlc-agent.cmd
  -> agent/jlc-agent.js
  -> plugin/jlceda-mcp-bridge_v0.0.17.eext
  -> 当前嘉立创原理图页面
```

优先使用：

```cmd
jlc-agent.cmd ping
jlc-agent.cmd current
jlc-agent.cmd read
jlc-agent.cmd review
```

## 目录职责

```text
agent/          主要 Node.js Agent。读取 source/netlist，生成报告。
plugin/         嘉立创扩展安装包。
runtime/        jlc-agent.cmd 使用的便携 Node.js 运行时。
examples/       只读 RPC 参数样例。
examples/write-tests/
                已归档的写图/改图验证计划和烟测输入。
reports/latest/
                最近一次读图/审图输出。
reports/archive/
                历史验证输出和烟测证据。
docs/           使用说明、风险说明和 AI 交接文档。
scripts/        底层桥接/调试辅助脚本。
node_modules/   本地运行依赖。
package.json    依赖和脚本元信息。
```

## 文档说明

```text
docs/AGENT_USAGE.md          命令使用说明。
docs/AI_AGENT_GUIDE.md       给 AI/脚本接手者的操作说明。
docs/AI_CAUTION_NOTES.md     审图证据和误判风险说明。
docs/EXPERIMENTAL_EDITS.md   实验性写图/改图命令说明。
docs/PORTABLE_CHECKLIST.md   换电脑部署检查清单。
docs/BINARY_NOTES.md         便携运行时和二进制文件说明。
```

## 当前策略

- `read` 和 `review` 是主流程。
- 写图/改图工具保留，但标记为实验能力。
- `reports/latest` 只放最近一次正式读图/审图输出。
- 历史验证证据放到 `reports/archive`。
- 判断运行状态优先看 `diagnostics.json` 和 `summary.md`。
- 不要并发运行多个占用 `9050` 的命令。

## 最近报告文件

`reports/latest` 通常包含：

```text
summary.md
risks.md
connectors.md
components.csv
nets.csv
source.schsrc
source-info.json
netlist.json
drc.json
diagnostics.json
current.json
```
