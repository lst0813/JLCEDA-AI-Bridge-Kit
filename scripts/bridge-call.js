#!/usr/bin/env node
"use strict";

const { WebSocketServer } = require("ws");

function printUsage() {
  process.stderr.write(`Usage:
  node scripts/bridge-call.js --method tools.list
  node scripts/bridge-call.js --method ping
  node scripts/bridge-call.js --tool jlc.bridge.ping --args "{}"
  node scripts/bridge-call.js --tool jlc.document.get_source --args "{}"

Options:
  --host <host>       Default: 127.0.0.1
  --port <port>       Default: 9050
  --method <method>   RPC method. Default: tools.call when --tool is provided
  --tool <name>       Tool name for tools.call
  --args <json>       Tool arguments JSON. Default: {}
  --id <id>           Request id. Default: auto timestamp
  --timeout <ms>      Overall timeout. Default: 30000
`);
}

function readArgs(argv) {
  const out = {
    host: "127.0.0.1",
    port: 9050,
    args: "{}",
    timeout: 30000,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const needsValue = [
      "--host",
      "--port",
      "--method",
      "--tool",
      "--args",
      "--id",
      "--timeout",
    ].includes(key);

    if (key === "--help" || key === "-h") {
      out.help = true;
      continue;
    }

    if (!needsValue) {
      throw new Error(`Unknown option: ${key}`);
    }

    const value = argv[i + 1];
    if (value === undefined) {
      throw new Error(`Missing value for ${key}`);
    }
    i += 1;

    if (key === "--host") out.host = value;
    if (key === "--port") out.port = Number(value);
    if (key === "--method") out.method = value;
    if (key === "--tool") out.tool = value;
    if (key === "--args") out.args = value;
    if (key === "--id") out.id = value;
    if (key === "--timeout") out.timeout = Number(value);
  }

  if (out.help) return out;
  if (!Number.isInteger(out.port) || out.port <= 0) {
    throw new Error("--port must be a positive integer");
  }
  if (!Number.isInteger(out.timeout) || out.timeout < 1000) {
    throw new Error("--timeout must be an integer >= 1000");
  }

  if (!out.method) {
    out.method = out.tool ? "tools.call" : undefined;
  }
  if (!out.method) {
    throw new Error("Provide --method, or provide --tool for a tools.call request");
  }

  return out;
}

function buildRequest(opts) {
  const request = {
    type: "request",
    id: opts.id || `req-${Date.now()}`,
    method: opts.method,
    closeAfterResponse: true,
  };

  if (opts.method === "tools.call") {
    if (!opts.tool) {
      throw new Error("--tool is required when --method tools.call");
    }

    let parsedArgs;
    try {
      parsedArgs = JSON.parse(opts.args || "{}");
    } catch (error) {
      throw new Error(`--args is not valid JSON: ${error.message}`);
    }

    request.params = {
      name: opts.tool,
      arguments: parsedArgs,
    };
  }

  return request;
}

function isTerminalMessage(message) {
  return message && (
    message.type === "response" ||
    message.type === "error" ||
    Object.prototype.hasOwnProperty.call(message, "result") ||
    Object.prototype.hasOwnProperty.call(message, "error")
  );
}

async function main() {
  const opts = readArgs(process.argv.slice(2));
  if (opts.help) {
    printUsage();
    return;
  }

  const request = buildRequest(opts);
  const wss = new WebSocketServer({ host: opts.host, port: opts.port });
  let sent = false;
  let finished = false;

  function finish(code, payload) {
    if (finished) return;
    finished = true;
    clearTimeout(timeout);
    try {
      wss.close();
    } catch (_) {
      // Ignore close errors while the process is exiting.
    }
    if (payload !== undefined) {
      const text = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
      process.stdout.write(`${text}\n`);
    }
    process.exitCode = code;
  }

  const timeout = setTimeout(() => {
    finish(2, {
      type: "error",
      error: `Timed out after ${opts.timeout} ms. Confirm JLCEDA Pro is open, the extension is enabled, and the URL is ws://${opts.host}:${opts.port}.`,
    });
  }, opts.timeout);

  wss.on("listening", () => {
    process.stderr.write(`Listening on ws://${opts.host}:${opts.port}; waiting for JLCEDA bridge hello...\n`);
  });

  wss.on("error", (error) => {
    finish(1, {
      type: "error",
      error: `WebSocket server failed: ${error.message}`,
    });
  });

  wss.on("connection", (ws) => {
    process.stderr.write("JLCEDA bridge connected. Waiting for hello before sending request...\n");

    ws.on("message", (raw) => {
      let message;
      try {
        message = JSON.parse(String(raw));
      } catch (_) {
        process.stderr.write(`Non-JSON message: ${String(raw)}\n`);
        return;
      }

      if (!sent && message.type === "hello") {
        sent = true;
        ws.send(JSON.stringify(request));
        process.stderr.write(`Sent ${request.method}${request.params ? `:${request.params.name}` : ""}.\n`);
        return;
      }

      if (isTerminalMessage(message)) {
        finish(message.type === "error" || message.error ? 1 : 0, message);
      } else {
        process.stderr.write(`Ignored message: ${JSON.stringify(message)}\n`);
      }
    });

    ws.on("close", () => {
      if (!finished && !sent) {
        finish(1, {
          type: "error",
          error: "JLCEDA bridge disconnected before sending hello.",
        });
      }
    });

    ws.on("error", (error) => {
      finish(1, {
        type: "error",
        error: `WebSocket connection error: ${error.message}`,
      });
    });
  });
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  printUsage();
  process.exitCode = 1;
});
