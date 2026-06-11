# Binary Notes

This kit includes a few binaries and vendored files so it can run on a clean
Windows machine without a separate Node.js install.

## Included Files

```text
plugin/jlceda-mcp-bridge_v0.0.17.eext
runtime/node.exe
websocat.exe
node_modules/ws/
```

Roles:

- `plugin/jlceda-mcp-bridge_v0.0.17.eext`: JLCEDA extension package.
- `runtime/node.exe`: bundled Node.js runtime used by `jlc-agent.cmd`.
- `websocat.exe`: legacy/debug WebSocket fallback.
- `node_modules/ws/`: WebSocket library used by the Node agent.

## Notes

- `runtime/node.exe` is large because it is a portable runtime.
- `websocat.exe` is not part of the preferred workflow; keep it only as a
  debugging fallback.
- `node_modules/ws` keeps its own MIT license file.
- For strict public releases, consider moving large binaries to release assets
  instead of keeping them in repository history.
