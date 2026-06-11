# 实验性改图说明

当前项目主线是稳定读图/审图。下面这些写图命令只保留给小范围验证使用。

## 先 Dry Run

```cmd
jlc-agent.cmd edit --file examples/write-tests/edit-plan-wire.json
```

确认 dry run 输出没问题后，再加 `--apply` 执行：

```cmd
jlc-agent.cmd edit --file examples/write-tests/edit-plan-wire.json --apply
```

## 允许的改图工具

`edit` 命令只允许调用下面的小白名单：

```text
jlc.schematic.wire.create
jlc.schematic.netlabel.attach_pin
jlc.schematic.connect_pins
jlc.schematic.place_device
jlc.schematic.select
jlc.schematic.clear_selection
jlc.schematic.save
```

## 烟测命令

```cmd
jlc-agent.cmd smoke-fast --find R_AI_TEST3
jlc-agent.cmd smoke-fast --designator R_AI_FAST_0611B --apply
```

不加 `--apply` 时，`smoke-fast` 只读取原理图，并可选查找已有 designator。
加 `--apply` 时，它会放置一个非 BOM、非 PCB 的 0603 电阻，并从 source 回读验证。

重点看这些结果字段：

```text
verified
timings
sourceVerification.componentExists
sourceVerification.designatorMatches
sourceVerification.nameMatches
sourceVerification.bomDisabled
sourceVerification.pcbDisabled
```

## 证据规则

不要把工具返回 success 当成改图成功的最终证据。任何写入后，都要重新运行：

```cmd
jlc-agent.cmd read
```

或：

```cmd
jlc-agent.cmd review
```

以 source/netlist 回读结果为准。
