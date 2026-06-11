# JLCEDA AI Bridge Kit

Portable bridge tools for connecting local AI/scripts to JLCEDA Pro through
the `jlceda-mcp-bridge` extension.

This is not a standard MCP server. The extension is a WebSocket client. Local
commands listen on `ws://127.0.0.1:9050`, wait for the extension `hello`, and
send RPC-style requests. `read` and `review` keep one listener open long enough
to read the schematic, netlist, and diagnostics in one stable pass.

```text
AI/script -> local WebSocket listener -> JLCEDA extension -> current project
```

## Current Goal

The project is being shaped first into a stable JLCEDA read/review agent:

- read the current document source and netlist
- generate structured review reports
- flag basic schematic risks
- keep small edit helpers as secondary/manual validation tools

It is intentionally not a "fully autonomous schematic generator" yet.

## Preferred Entry Point

Use:

```cmd
jlc-agent.cmd ping
jlc-agent.cmd tools
jlc-agent.cmd current
jlc-agent.cmd read
jlc-agent.cmd review
```

Compatibility wrappers are still kept:

```cmd
ping.cmd
list-tools.cmd
get-source.cmd
call-tool.cmd
```

They forward to `jlc-agent.cmd`.

## Setup

1. Install and open JLCEDA Pro.
2. Import the extension:

   ```text
   plugin/jlceda-mcp-bridge_v0.0.17.eext
   ```

3. Enable the extension and allow external access/interaction.
4. Set the extension WebSocket URL to:

   ```text
   ws://127.0.0.1:9050
   ```

5. Open a project and schematic page.
6. Run:

   ```cmd
   jlc-agent.cmd ping
   jlc-agent.cmd review
   ```

## Generated Reports

`jlc-agent.cmd read` and `jlc-agent.cmd review` write files under
`reports/latest` by default:

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
```

`diagnostics.json` records read status, per-step timings, truncation, and any
bridge/JLCEDA errors. If the active JLCEDA tab is not a schematic sheet,
`read`/`review` now exits quickly with `status: "failed"` instead of producing
a misleading PCB/footprint report.

## Repository Layout

```text
agent/        main read/review command implementation
plugin/       JLCEDA extension package
runtime/      bundled Node.js runtime
examples/     read-only RPC argument samples
reports/latest/ latest read/review output
reports/archive/ archived validation and smoke-test artifacts
docs/         usage and handoff notes
scripts/      lower-level bridge/debug helpers
package.json  optional npm metadata for dependency clarity
```

## Experimental Edits

Small-step edit helpers are still present for controlled validation, but they
are secondary to the read/review workflow. Their examples live under
`examples/write-tests/`; details are in `docs/EXPERIMENTAL_EDITS.md`.

## Important Notes

- Only one command can listen on port `9050` at a time.
- If a command times out right after another command ran, wait a few seconds
  and retry. For schematic checks, prefer `read` or `review` so the listener
  stays open while source, netlist, diagnostics, and optional DRC are gathered.
- A tool returning success does not prove the schematic is electrically
  correct. Prefer `jlc.document.get_source` and `jlc.schematic.get_netlist`
  readback.
- `websocat.exe`, `call-tool.ps1`, `list-tools.ps1`, and `test-ping.ps1` are
  legacy/debug fallbacks. Day-to-day use should go through `jlc-agent.cmd`.

More details:

```text
docs/AGENT_USAGE.md
docs/REPOSITORY_STRUCTURE.md
docs/AI_AGENT_GUIDE.md
docs/AI_CAUTION_NOTES.md
docs/EXPERIMENTAL_EDITS.md
docs/PORTABLE_CHECKLIST.md
```
