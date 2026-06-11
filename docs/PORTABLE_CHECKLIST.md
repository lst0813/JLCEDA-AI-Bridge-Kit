# Portable Checklist

Use this when copying the kit to another Windows machine.

## Required Files

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

The legacy wrappers are optional but useful for compatibility:

```text
ping.cmd
list-tools.cmd
get-source.cmd
call-tool.cmd
```

## JLCEDA Setup

1. Install and open JLCEDA Pro or the target private deployment.
2. Import `plugin/jlceda-mcp-bridge_v0.0.17.eext`.
3. Enable the extension.
4. Allow external access/interaction if the client asks for permission.
5. Set the extension WebSocket URL to:

   ```text
   ws://127.0.0.1:9050
   ```

6. Open a project and focus a schematic sheet.

## Connection Test

Run from the kit directory:

```cmd
jlc-agent.cmd ping
jlc-agent.cmd current
jlc-agent.cmd read --report-dir reports/latest --no-drc
```

Expected result:

- `ping` returns a bridge response.
- `current` shows the active project/document.
- `read` writes `reports/latest/diagnostics.json`.
- `diagnostics.json` shows `status: "ok"` when a schematic sheet is active.

## Common Problems

### Command Times Out

Check that JLCEDA is open, the extension is enabled, the URL is correct, and a
schematic sheet is active. The extension may show `connecting` when no local
command is listening; that is normal.

### Port Is Busy

Only one process can listen on `9050`.

```powershell
netstat -ano | findstr :9050
```

Wait for the previous command to exit before running another one.

### Node Is Missing

The kit includes `runtime/node.exe`. If it is removed or blocked by security
software, install official Node.js or restore the bundled runtime.
