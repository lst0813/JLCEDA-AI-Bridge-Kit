# JLCEDA Agent Usage

This project has one preferred entry point:

```cmd
jlc-agent.cmd ping
jlc-agent.cmd tools
jlc-agent.cmd current
jlc-agent.cmd read
jlc-agent.cmd review
```

The older `ping.cmd`, `list-tools.cmd`, `get-source.cmd`, and
`call-tool.cmd` files are compatibility wrappers. They forward to
`jlc-agent.cmd`.

## Main Commands

Check the bridge:

```cmd
jlc-agent.cmd ping
```

List exposed tools:

```cmd
jlc-agent.cmd tools
```

Read the current schematic and write structured reports:

```cmd
jlc-agent.cmd read --report-dir reports/latest
```

Run the basic review rules and DRC status check:

```cmd
jlc-agent.cmd review --report-dir reports/latest
```

Call a raw extension RPC method:

```cmd
jlc-agent.cmd rpc --method getDocumentSource --args-file examples/source-fast.json
jlc-agent.cmd rpc --method schematic.getNetlist --args-file examples/netlist-fast.json
```

Generated files include:

```text
reports/latest/summary.md
reports/latest/risks.md
reports/latest/connectors.md
reports/latest/components.csv
reports/latest/nets.csv
reports/latest/source.schsrc
reports/latest/netlist.json
reports/latest/diagnostics.json
```

`read` and `review` are the main workflow. They keep one bridge session open,
record per-step timings, and write `diagnostics.json` even when a step fails.
If JLCEDA is focused on a PCB/footprint tab instead of a schematic sheet, the
command reports `status: "failed"` and tells you to open a schematic sheet
instead of treating the wrong document source as a schematic report.

## Performance Notes

- Do not run multiple `9050` commands at the same time. The extension is the
  WebSocket client, and only one local listener should own a port.
- `source`, `netlist`, `read`, and `review` use direct RPC where possible
  (`getDocumentSource`, `schematic.getNetlist`) instead of `tools.call`.
  This avoids the duplicated `data + toolResult` payload used by tool calls.
- A cold first call can still wait for extension reconnect backoff. Once the
  extension is actively reconnecting, source reads are typically sub-second
  and full read/review runs are usually a few seconds.
- For schematic read/review, prefer `read` or `review` because they keep one
  local listener open while gathering current document data, source, netlist,
  diagnostics, and optional DRC data.
- A short command can report a tiny tool `elapsedMs` but still take much longer
  end-to-end because it waited for the extension reconnect loop.
- The command-level elapsed time is the reliable user-facing speed number. The
  per-step `diagnostics.timings` fields show where bridge/JLCEDA time was spent
  after the extension connected.

## Calling Tools With JSON

Prefer JSON files for arguments:

```cmd
jlc-agent.cmd call --tool jlc.schematic.verify_netlist --args-file args.json
```

Small inline JSON is still supported:

```cmd
jlc-agent.cmd call --tool jlc.bridge.ping --args-json "{}"
```

## Experimental Small-Step Edits

Edit helpers are still present for controlled validation, but they are not the
main workflow. See `docs/EXPERIMENTAL_EDITS.md`.

## Legacy Files

`websocat.exe`, `call-tool.ps1`, `list-tools.ps1`, and `test-ping.ps1` are kept
as legacy/debug fallbacks. Day-to-day use should go through `jlc-agent.cmd`.
