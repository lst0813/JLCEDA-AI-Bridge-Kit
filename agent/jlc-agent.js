#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { WebSocket, WebSocketServer } = require("ws");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 9050;
const DEFAULT_TIMEOUT = 60000;
const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY = 3000;
const DEFAULT_KEEPALIVE = 15000;
const DEFAULT_CLOSE_WAIT = 2000;

const SAFE_EDIT_TOOLS = new Set([
  "jlc.schematic.wire.create",
  "jlc.schematic.netlabel.attach_pin",
  "jlc.schematic.connect_pins",
  "jlc.schematic.place_device",
  "jlc.schematic.select",
  "jlc.schematic.clear_selection",
  "jlc.schematic.save",
]);

const DEFAULT_TEST_DEVICE = {
  deviceUuid: "fda93f9c26224f7aa97d1a6a7b2d5fd7",
  libraryUuid: "0819f05c4eef4c71ace90d822a990e87",
  x: 1180,
  y: 260,
  rotation: 0,
  addIntoBom: false,
  addIntoPcb: false,
};

function usage() {
  return `Usage:
  jlc-agent ping [--port 9050] [--timeout 60000]
  jlc-agent tools
  jlc-agent current
  jlc-agent call --tool <name> [--args-file args.json | --args-json "{}"]
  jlc-agent rpc --method <name> [--args-file args.json | --args-json "{}"]
  jlc-agent source [--out reports/latest/source.schsrc] [--max-chars 200000]
  jlc-agent netlist [--out reports/latest/netlist.json] [--max-chars 500000]
  jlc-agent read [--report-dir reports/latest]
  jlc-agent review [--report-dir reports/latest] [--no-drc]
  jlc-agent edit --file edit-plan.json [--apply]                 (experimental)
  jlc-agent smoke --file edit-plan.json [--apply]                (experimental)
  jlc-agent smoke-fast [--file edit-plan.json | --designator R_AI_FAST_123456] [--apply]
                                                                  (experimental)

Notes:
  The JLCEDA extension is a WebSocket client. This command listens on
  ws://127.0.0.1:9050, waits for hello, sends one request, then exits.
  read/review are the primary workflow. Edit/smoke commands are retained for
  controlled validation only.

  Prefer --args-file for complex JSON. It avoids PowerShell/CMD quote traps.
`;
}

function die(message, code = 1) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function parseArgv(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      out._.push(token);
      continue;
    }

    const eq = token.indexOf("=");
    if (eq !== -1) {
      out[token.slice(2, eq)] = token.slice(eq + 1);
      continue;
    }

    const key = token.slice(2);
    if (["apply", "no-drc", "raw", "help"].includes(key)) {
      out[key] = true;
      continue;
    }

    const value = argv[i + 1];
    if (value === undefined) {
      die(`Missing value for --${key}`);
    }
    out[key] = value;
    i += 1;
  }
  return out;
}

function intOpt(opts, key, fallback, options = {}) {
  if (opts[key] === undefined) return fallback;
  const value = Number(opts[key]);
  const min = options.min === undefined ? 1 : options.min;
  if (!Number.isInteger(value) || value < min) {
    die(`--${key} must be an integer >= ${min}`);
  }
  return value;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readJsonFile(filePath) {
  const full = path.resolve(ROOT, filePath);
  return JSON.parse(fs.readFileSync(full, "utf8").replace(/^\uFEFF/, ""));
}

function readArgsJson(opts) {
  if (opts["args-file"]) {
    return readJsonFile(opts["args-file"]);
  }
  if (opts["args-json"]) {
    return JSON.parse(opts["args-json"]);
  }
  return {};
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeText(filePath, text) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `\uFEFF${text}`, "utf8");
}

function writeJson(filePath, data) {
  writeText(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function csvCell(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsv(rows, columns) {
  const lines = [columns.join(",")];
  for (const row of rows) {
    lines.push(columns.map((key) => csvCell(row[key])).join(","));
  }
  return `${lines.join("\n")}\n`;
}

function refParts(ref) {
  const match = String(ref || "").match(/^([A-Za-z#]+)(\d+)?(.*)$/);
  if (!match) return ["~", 0, String(ref || "")];
  return [match[1], match[2] ? Number(match[2]) : -1, match[3] || ""];
}

function compareRef(a, b) {
  const pa = refParts(a.ref || a.Ref || a);
  const pb = refParts(b.ref || b.Ref || b);
  if (pa[0] !== pb[0]) return pa[0].localeCompare(pb[0]);
  if (pa[1] !== pb[1]) return pa[1] - pb[1];
  return pa[2].localeCompare(pb[2]);
}

function buildRequest(opts) {
  const request = {
    type: "request",
    id: opts.id || `req-${Date.now()}`,
    method: opts.method,
  };
  if (opts.closeAfterResponse !== false) {
    request.closeAfterResponse = true;
  }
  if (opts.method === "tools.call") {
    request.params = {
      name: opts.tool,
      arguments: opts.args || {},
    };
  }
  if (opts.params !== undefined) {
    request.params = opts.params;
  }
  return request;
}

function buildToolRequest(name, args, id, closeAfterResponse) {
  return buildRequest({
    method: "tools.call",
    tool: name,
    args,
    id,
    closeAfterResponse,
  });
}

function buildRpcRequest(method, params, id, closeAfterResponse) {
  return buildRequest({
    method,
    params,
    id,
    closeAfterResponse,
  });
}

function isTerminalMessage(message) {
  return message && (
    message.type === "response" ||
    message.type === "error" ||
    Object.prototype.hasOwnProperty.call(message, "result") ||
    Object.prototype.hasOwnProperty.call(message, "error")
  );
}

class BridgeSession {
  constructor(options = {}) {
    this.host = options.host || DEFAULT_HOST;
    this.port = options.port || DEFAULT_PORT;
    this.timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT;
    this.closeWaitMs = options.closeWaitMs || DEFAULT_CLOSE_WAIT;
    this.keepAliveMs = options.keepAliveMs || DEFAULT_KEEPALIVE;
    this.wss = null;
    this.clients = new Set();
    this.activeWs = null;
    this.pending = new Map();
    this.ready = false;
    this.closed = false;
    this.closing = false;
    this.keepAliveTimer = null;
    this.readyTimer = null;
    this.readyPromise = null;
    this.resolveReady = null;
    this.rejectReady = null;
    this.connectionWaiters = [];
  }

  async open() {
    if (this.readyPromise) return this.readyPromise;

    this.readyPromise = new Promise((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
      this.readyTimer = setTimeout(() => {
        this.failReady(new Error(`Timed out after ${this.timeoutMs} ms waiting for JLCEDA hello on ws://${this.host}:${this.port}.`));
      }, this.timeoutMs);

      this.wss = new WebSocketServer({ host: this.host, port: this.port });
      this.wss.on("error", (error) => {
        const wrapped = new Error(`WebSocket server failed on ws://${this.host}:${this.port}: ${error.message}`);
        this.failReady(wrapped);
        this.rejectAll(wrapped);
      });
      this.wss.on("connection", (ws) => this.handleConnection(ws));
    });

    return this.readyPromise;
  }

  failReady(error) {
    if (this.ready || !this.rejectReady) return;
    clearTimeout(this.readyTimer);
    this.rejectReady(error);
    this.rejectReady = null;
    this.resolveReady = null;
  }

  markReady(hello) {
    if (this.ready) return;
    this.ready = true;
    clearTimeout(this.readyTimer);
    if (this.resolveReady) {
      this.resolveReady(hello);
      this.resolveReady = null;
      this.rejectReady = null;
    }
    this.resolveConnectionWaiters();
  }

  resolveConnectionWaiters() {
    if (!this.activeWs || this.activeWs.readyState !== WebSocket.OPEN) return;
    const waiters = this.connectionWaiters.splice(0);
    for (const waiter of waiters) {
      clearTimeout(waiter.timer);
      waiter.resolve(this.activeWs);
    }
  }

  waitForConnection(timeoutMs) {
    if (this.activeWs && this.activeWs.readyState === WebSocket.OPEN) {
      return Promise.resolve(this.activeWs);
    }

    return new Promise((resolve, reject) => {
      const waiter = { resolve, reject, timer: null };
      waiter.timer = setTimeout(() => {
        this.connectionWaiters = this.connectionWaiters.filter((item) => item !== waiter);
        reject(new Error(`Timed out after ${timeoutMs} ms waiting for JLCEDA reconnect on ws://${this.host}:${this.port}.`));
      }, timeoutMs);
      this.connectionWaiters.push(waiter);
    });
  }

  handleConnection(ws) {
    if (this.closed || this.closing) {
      try {
        ws.terminate();
      } catch (_) {
        // Ignore connection teardown errors during shutdown.
      }
      return;
    }

    this.clients.add(ws);

    ws.on("message", (raw) => {
      let message;
      try {
        message = JSON.parse(String(raw));
      } catch (_) {
        return;
      }

      if (message.type === "hello") {
        this.activeWs = ws;
        this.startKeepAlive();
        this.markReady(message);
        this.resolveConnectionWaiters();
        return;
      }

      if (isTerminalMessage(message)) {
        this.resolvePending(message);
      }
    });

    ws.on("close", () => {
      this.clients.delete(ws);
      if (this.activeWs === ws) {
        this.activeWs = null;
        if (!this.closed && this.pending.size > 0) {
          const error = new Error("JLCEDA bridge disconnected before the pending request completed.");
          error.reconnectable = true;
          this.rejectAll(error);
        }
        if (!this.closed && !this.ready) this.failReady(new Error("JLCEDA bridge disconnected before sending hello."));
      }
    });

    ws.on("error", (error) => {
      const wrapped = new Error(`WebSocket connection error: ${error.message}`);
      this.rejectAll(wrapped);
      if (!this.ready) this.failReady(wrapped);
    });
  }

  startKeepAlive() {
    if (this.keepAliveTimer || !this.keepAliveMs) return;
    this.keepAliveTimer = setInterval(() => {
      for (const client of this.clients) {
        if (client.readyState === WebSocket.OPEN) {
          try {
            client.ping();
          } catch (_) {
            // Ignore keepalive failures; close/error handlers carry the real state.
          }
        }
      }
    }, this.keepAliveMs);
  }

  resolvePending(message) {
    const id = message.id;
    let pending = id ? this.pending.get(id) : undefined;
    if (!pending && this.pending.size === 1) {
      pending = Array.from(this.pending.values())[0];
    }
    if (!pending) return;

    clearTimeout(pending.timer);
    this.pending.delete(pending.id);
    pending.resolve(message);
  }

  rejectAll(error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }

  async send(request, options = {}) {
    await this.open();
    const retryOnDisconnect = options.retryOnDisconnect === undefined ? 0 : options.retryOnDisconnect;
    let lastError;
    for (let attempt = 0; attempt <= retryOnDisconnect; attempt += 1) {
      try {
        return await this.sendOnce(request, options);
      } catch (error) {
        lastError = error;
        if (!error.reconnectable || attempt >= retryOnDisconnect) break;
        await sleep(100);
      }
    }
    throw lastError;
  }

  async sendOnce(request, options = {}) {
    const timeoutMs = options.timeoutMs || this.timeoutMs;
    const ws = await this.waitForConnection(timeoutMs);

    return new Promise((resolve, reject) => {
      const id = request.id || `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const payload = { ...request, id, closeAfterResponse: false };
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${options.label || id} timed out after ${timeoutMs} ms.`));
      }, timeoutMs);
      const onClose = () => {
        if (!this.pending.has(id)) return;
        clearTimeout(timer);
        this.pending.delete(id);
        const error = new Error("JLCEDA bridge disconnected before the pending request completed.");
        error.reconnectable = true;
        reject(error);
      };

      this.pending.set(id, { id, timer, resolve, reject });
      ws.once("close", onClose);
      try {
        ws.send(JSON.stringify(payload));
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        ws.off("close", onClose);
        reject(error);
      }
    });
  }

  async callTool(name, args, options = {}) {
    const response = await this.send(
      buildToolRequest(name, args || {}, options.id || `tool-${Date.now()}`, false),
      { ...options, label: name }
    );
    if (response.error) {
      const detail = response.error.message || JSON.stringify(response.error);
      const error = new Error(`${name} failed: ${detail}`);
      error.response = response;
      throw error;
    }
    return response;
  }

  async callRpc(method, params, options = {}) {
    const response = await this.send(
      buildRpcRequest(method, params || {}, options.id || `rpc-${Date.now()}`, false),
      { retryOnDisconnect: 1, ...options, label: method }
    );
    if (response.error) {
      const detail = response.error.message || JSON.stringify(response.error);
      const error = new Error(`${method} failed: ${detail}`);
      error.response = response;
      throw error;
    }
    return response;
  }

  async close() {
    if (this.closing) return;
    this.closing = true;
    this.closed = true;
    clearTimeout(this.readyTimer);
    clearInterval(this.keepAliveTimer);
    this.rejectAll(new Error("Bridge session closed."));
    for (const waiter of this.connectionWaiters.splice(0)) {
      clearTimeout(waiter.timer);
      waiter.reject(new Error("Bridge session closed."));
    }

    const clients = Array.from(this.clients);
    this.clients.clear();
    for (const client of clients) {
      try {
        client.terminate();
      } catch (_) {
        // Ignore close errors during shutdown.
      }
    }

    const wss = this.wss;
    this.wss = null;
    if (!wss) return;

    await new Promise((resolve) => {
      const force = setTimeout(resolve, this.closeWaitMs);
      try {
        wss.close(() => {
          clearTimeout(force);
          resolve();
        });
      } catch (_) {
        clearTimeout(force);
        resolve();
      }
    });
  }
}

function bridgeRequest(options) {
  const host = options.host || DEFAULT_HOST;
  const port = options.port || DEFAULT_PORT;
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT;
  const closeWaitMs = options.closeWaitMs || DEFAULT_CLOSE_WAIT;
  const request = buildRequest(options);

  return new Promise((resolve, reject) => {
    const wss = new WebSocketServer({ host, port });
    const clients = new Set();
    let sent = false;
    let done = false;

    function closeServerOnly() {
      try {
        wss.close();
      } catch (_) {
        // Ignore close errors during shutdown.
      }
    }

    function terminateClients() {
      for (const client of clients) {
        try {
          client.terminate();
        } catch (_) {
          // Ignore close errors during shutdown.
        }
      }
    }

    function cleanup() {
      clearTimeout(timer);
      closeServerOnly();
    }

    function finish(error, payload) {
      if (done) return;
      done = true;
      cleanup();

      let settled = false;
      function settle() {
        if (settled) return;
        settled = true;
        if (error) reject(error);
        else resolve(payload);
      }

      if (clients.size === 0) {
        settle();
        return;
      }

      const force = setTimeout(() => {
        terminateClients();
        settle();
      }, closeWaitMs);

      for (const client of Array.from(clients)) {
        client.once("close", () => {
          clients.delete(client);
          if (clients.size === 0) {
            clearTimeout(force);
            settle();
          }
        });
      }
    }

    const timer = setTimeout(() => {
      finish(new Error(`Timed out after ${timeoutMs} ms. Confirm JLCEDA Pro is open, the extension is enabled, and the URL is ws://${host}:${port}.`));
    }, timeoutMs);

    wss.on("error", (error) => {
      finish(new Error(`WebSocket server failed on ws://${host}:${port}: ${error.message}`));
    });

    wss.on("connection", (ws) => {
      clients.add(ws);
      ws.on("message", (raw) => {
        let message;
        try {
          message = JSON.parse(String(raw));
        } catch (_) {
          return;
        }

        if (!sent && message.type === "hello") {
          sent = true;
          ws.send(JSON.stringify(request));
          return;
        }

        if (isTerminalMessage(message)) {
          finish(null, message);
        }
      });

      ws.on("close", () => {
        clients.delete(ws);
        if (!done && !sent) {
          finish(new Error("JLCEDA bridge disconnected before sending hello."));
        }
      });

      ws.on("error", (error) => {
        finish(new Error(`WebSocket connection error: ${error.message}`));
      });
    });
  });
}

function bridgeBatch(requests, options) {
  const host = options.host || DEFAULT_HOST;
  const port = options.port || DEFAULT_PORT;
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT;
  const closeWaitMs = options.closeWaitMs || 2000;

  return new Promise((resolve, reject) => {
    const wss = new WebSocketServer({ host, port });
    const clients = new Set();
    const responses = [];
    let index = 0;
    let done = false;
    let activeWs = null;

    function closeServerOnly() {
      try {
        wss.close();
      } catch (_) {
        // Ignore close errors during shutdown.
      }
    }

    function terminateClients() {
      for (const client of clients) {
        try {
          client.terminate();
        } catch (_) {
          // Ignore close errors during shutdown.
        }
      }
    }

    function cleanup() {
      clearTimeout(timer);
      closeServerOnly();
    }

    function settle(error) {
      if (done) return;
      done = true;
      cleanup();

      let settled = false;
      function finish() {
        if (settled) return;
        settled = true;
        if (error) reject(error);
        else resolve(responses);
      }

      if (clients.size === 0) {
        finish();
        return;
      }

      const force = setTimeout(() => {
        terminateClients();
        finish();
      }, closeWaitMs);

      for (const client of Array.from(clients)) {
        client.once("close", () => {
          clients.delete(client);
          if (clients.size === 0) {
            clearTimeout(force);
            finish();
          }
        });
      }
    }

    function sendCurrent() {
      if (!activeWs || index >= requests.length) {
        settle();
        return;
      }
      activeWs.send(JSON.stringify(requests[index]));
    }

    const timer = setTimeout(() => {
      settle(new Error(`Timed out after ${timeoutMs} ms. Confirm JLCEDA Pro is open, the extension is enabled, and the URL is ws://${host}:${port}.`));
    }, timeoutMs);

    wss.on("error", (error) => {
      settle(new Error(`WebSocket server failed on ws://${host}:${port}: ${error.message}`));
    });

    wss.on("connection", (ws) => {
      clients.add(ws);
      activeWs = ws;

      ws.on("message", (raw) => {
        let message;
        try {
          message = JSON.parse(String(raw));
        } catch (_) {
          return;
        }

        if (message.type === "hello") {
          sendCurrent();
          return;
        }

        if (isTerminalMessage(message)) {
          responses.push(message);
          index += 1;
          if (index >= requests.length) {
            settle();
          } else {
            sendCurrent();
          }
        }
      });

      ws.on("close", () => {
        clients.delete(ws);
        if (!done && responses.length < requests.length) {
          settle(new Error("JLCEDA bridge disconnected before the batch completed."));
        }
      });

      ws.on("error", (error) => {
        settle(new Error(`WebSocket connection error: ${error.message}`));
      });
    });
  });
}

async function callTool(name, args, opts) {
  if (opts && opts.session) {
    const response = await opts.session.callTool(name, args, { timeoutMs: opts.timeoutMs });
    return response;
  }
  let response;
  let lastError;
  const retries = opts.retries === undefined ? DEFAULT_RETRIES : opts.retries;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      response = await bridgeRequest({
        method: "tools.call",
        tool: name,
        args,
        port: opts.port,
        timeoutMs: opts.timeoutMs,
      });
      lastError = undefined;
      break;
    } catch (error) {
      lastError = error;
      if (attempt >= retries) break;
      await sleep(opts.retryDelayMs || DEFAULT_RETRY_DELAY);
    }
  }
  if (lastError) throw lastError;
  if (response.error) {
    const detail = response.error.message || JSON.stringify(response.error);
    const error = new Error(`${name} failed: ${detail}`);
    error.isToolError = true;
    throw error;
  }
  return response;
}

async function callRpc(method, params, opts) {
  if (opts && opts.session) {
    const response = await opts.session.callRpc(method, params, { timeoutMs: opts.timeoutMs });
    return response;
  }
  let response;
  let lastError;
  const retries = opts.retries === undefined ? DEFAULT_RETRIES : opts.retries;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      response = await bridgeRequest({
        method,
        params,
        closeAfterResponse: true,
        port: opts.port,
        timeoutMs: opts.timeoutMs,
      });
      lastError = undefined;
      break;
    } catch (error) {
      lastError = error;
      if (attempt >= retries) break;
      await sleep(opts.retryDelayMs || DEFAULT_RETRY_DELAY);
    }
  }
  if (lastError) throw lastError;
  if (response.error) {
    const detail = response.error.message || JSON.stringify(response.error);
    throw new Error(`${method} failed: ${detail}`);
  }
  return response;
}

async function listTools(opts) {
  if (opts && opts.session) {
    const response = await opts.session.callRpc("tools.list", {}, { timeoutMs: opts.timeoutMs });
    if (response.error) {
      throw new Error(`tools.list failed: ${response.error.message || JSON.stringify(response.error)}`);
    }
    return response;
  }
  let response;
  let lastError;
  const retries = opts.retries === undefined ? DEFAULT_RETRIES : opts.retries;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      response = await bridgeRequest({
        method: "tools.list",
        port: opts.port,
        timeoutMs: opts.timeoutMs,
      });
      lastError = undefined;
      break;
    } catch (error) {
      lastError = error;
      if (attempt >= retries) break;
      await sleep(opts.retryDelayMs || DEFAULT_RETRY_DELAY);
    }
  }
  if (lastError) throw lastError;
  if (response.error) {
    throw new Error(`tools.list failed: ${response.error.message || JSON.stringify(response.error)}`);
  }
  return response;
}

async function batchTools(calls, opts) {
  const requests = calls.map((call, index) => buildToolRequest(
    call.name,
    call.args || {},
    `batch-${Date.now()}-${index + 1}`,
    index === calls.length - 1
  ));
  const responses = await bridgeBatch(requests, opts);
  return responses.map((response, index) => {
    if (response.error) {
      const detail = response.error.message || JSON.stringify(response.error);
      const error = new Error(`${calls[index].name} failed: ${detail}`);
      error.response = response;
      throw error;
    }
    return unwrapToolData(response);
  });
}

async function batchRequests(calls, opts) {
  const requests = calls.map((call, index) => {
    if (call.kind === "rpc") {
      return buildRpcRequest(
        call.method,
        call.params || {},
        `batch-${Date.now()}-${index + 1}`,
        index === calls.length - 1
      );
    }
    return buildToolRequest(
      call.name,
      call.args || {},
      `batch-${Date.now()}-${index + 1}`,
      index === calls.length - 1
    );
  });
  const responses = await bridgeBatch(requests, opts);
  return responses.map((response, index) => {
    if (response.error) {
      const call = calls[index];
      const label = call.kind === "rpc" ? call.method : call.name;
      const detail = response.error.message || JSON.stringify(response.error);
      const error = new Error(`${label} failed: ${detail}`);
      error.response = response;
      throw error;
    }
    if (calls[index].kind === "rpc") return response.result;
    return unwrapToolData(response);
  });
}

function unwrapToolData(response) {
  return response && response.result ? response.result.data : undefined;
}

async function getCurrent(opts) {
  const response = await callRpc("getCurrentDocumentInfo", {}, opts);
  return response.result;
}

async function getSource(opts, maxChars) {
  const params = {};
  if (maxChars) params.maxChars = maxChars;
  const response = await callRpc("getDocumentSource", params, opts);
  return response.result;
}

async function getNetlist(opts, maxChars, timeoutMs) {
  const params = { netlistType: "JLCEDA" };
  if (maxChars) params.maxChars = maxChars;
  if (timeoutMs) params.timeoutMs = timeoutMs;
  const response = await callRpc("schematic.getNetlist", params, opts);
  return response.result;
}

function parseSource(source) {
  const counts = {};
  const header = {};
  const lines = String(source || "").split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    let item;
    try {
      item = JSON.parse(line);
    } catch (_) {
      continue;
    }
    const type = item[0];
    counts[type] = (counts[type] || 0) + 1;
    if (type === "ATTR") {
      const key = item[3];
      const value = item[4];
      if (String(key || "").startsWith("@")) {
        header[key] = value;
      }
    }
  }
  return { counts, header, lineCount: lines.filter(Boolean).length };
}

function parseNetlist(netlistText) {
  if (netlistText === undefined || netlistText === null || netlistText === "") {
    return emptyNetlistModel();
  }
  const raw = typeof netlistText === "string" ? JSON.parse(netlistText) : netlistText;
  const components = [];
  const nets = new Map();

  for (const [uid, entry] of Object.entries(raw || {})) {
    const props = entry.props || {};
    const pins = entry.pins || {};
    const channel = String(props["Channel ID"] || "");
    const pageMatch = channel.match(/^\$(\d+)e/);
    const page = pageMatch ? pageMatch[1] : "?";
    const ref = String(props.Designator || "");
    const prefixMatch = ref.match(/^([A-Za-z#]+)/);
    const prefix = prefixMatch ? prefixMatch[1] : "?";
    const pinList = Object.entries(pins).map(([pin, net]) => ({
      pin,
      net: net === undefined || net === null ? "" : String(net),
    }));

    const component = {
      uid,
      page,
      ref,
      prefix,
      name: String(props.Name || ""),
      value: String(props.Value || ""),
      footprint: String(props.FootprintName || props["Footprint Name"] || ""),
      deviceName: String(props.DeviceName || ""),
      symbolName: String(props.SymbolName || ""),
      channel,
      pinCount: pinList.length,
      pins: pinList,
    };
    components.push(component);

    for (const pin of pinList) {
      if (!pin.net) continue;
      if (!nets.has(pin.net)) nets.set(pin.net, []);
      nets.get(pin.net).push({
        ref,
        pin: pin.pin,
        page,
        component: component.value || component.name,
      });
    }
  }

  components.sort(compareRef);
  const netRows = Array.from(nets.entries())
    .map(([name, endpoints]) => ({ name, count: endpoints.length, endpoints }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return { raw, components, nets: netRows };
}

function emptyNetlistModel(raw = {}) {
  return { raw, components: [], nets: [] };
}

function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

function makeRisks(model, drcResult, diagnostics = {}) {
  const risks = [];
  const namedSingleEndpoints = model.nets
    .filter((net) => net.count === 1 && !net.name.startsWith("$"))
    .map((net) => `${net.name}: ${net.endpoints[0].ref}.${net.endpoints[0].pin} (page ${net.endpoints[0].page})`);

  if (namedSingleEndpoints.length) {
    risks.push({
      severity: "warning",
      title: "Single-end named nets",
      details: namedSingleEndpoints,
    });
  }

  const emptyPins = [];
  for (const component of model.components) {
    for (const pin of component.pins) {
      if (!pin.net) {
        emptyPins.push(`${component.ref}.${pin.pin} ${component.value || component.name} (page ${component.page})`);
      }
    }
  }
  if (emptyPins.length) {
    risks.push({
      severity: "info",
      title: "Empty pins",
      details: emptyPins,
    });
  }

  const typoNets = model.nets
    .map((net) => net.name)
    .filter((name) => /SUORCE/i.test(name));
  if (typoNets.length) {
    risks.push({
      severity: "info",
      title: "Possible naming typo",
      details: Array.from(new Set(typoNets)).sort(),
    });
  }

  if (drcResult && drcResult.ok === false) {
    risks.push({
      severity: "warning",
      title: "JLCEDA DRC returned ok=false",
      details: ["The bridge did not return detailed DRC items. Open the DRC panel in JLCEDA for details."],
    });
  }

  const diagnosticDetails = (diagnostics.errors || []).map((item) => {
    const label = item.fatal ? "fatal" : "non-fatal";
    return `${item.step} (${label}): ${item.message}`;
  });
  if (diagnosticDetails.length) {
    risks.push({
      severity: diagnostics.ok === false ? "warning" : "info",
      title: "Read/review diagnostics",
      details: diagnosticDetails,
    });
  }

  return risks;
}

function renderSummary(context) {
  const { current, sourceInfo, model, risks, diagnostics } = context;
  const byPage = groupBy(model.components, (component) => component.page);
  const lines = [];
  lines.push("# JLCEDA Agent Review");
  lines.push("");
  lines.push("## Document");
  lines.push("");
  if (diagnostics) {
    lines.push(`- status: ${diagnostics.status || (diagnostics.ok === false ? "degraded" : "ok")}`);
    lines.push(`- generatedAt: ${diagnostics.generatedAt || ""}`);
  }
  lines.push(`- documentType: ${current && current.documentType !== undefined ? current.documentType : ""}`);
  lines.push(`- uuid: ${current && current.uuid ? current.uuid : ""}`);
  lines.push(`- projectUuid: ${current && current.parentProjectUuid ? current.parentProjectUuid : ""}`);
  if (sourceInfo.header) {
    for (const key of ["@Project Name", "@Schematic Name", "@Page Name", "@Page No", "@Page Count", "@Board Name", "@Update Date"]) {
      if (sourceInfo.header[key] !== undefined) lines.push(`- ${key}: ${sourceInfo.header[key]}`);
    }
  }
  lines.push("");
  lines.push("## Counts");
  lines.push("");
  lines.push(`- components in netlist: ${model.components.length}`);
  lines.push(`- nets: ${model.nets.length}`);
  for (const key of Object.keys(sourceInfo.counts || {}).sort()) {
    lines.push(`- source ${key}: ${sourceInfo.counts[key]}`);
  }
  if (diagnostics && diagnostics.source) {
    lines.push(`- source chars: ${diagnostics.source.chars}`);
    lines.push(`- source truncated: ${diagnostics.source.truncated}`);
  }
  if (diagnostics && diagnostics.netlist) {
    lines.push(`- netlist chars: ${diagnostics.netlist.chars}`);
    lines.push(`- netlist truncated: ${diagnostics.netlist.truncated}`);
  }
  lines.push("");
  lines.push("## Pages");
  lines.push("");
  for (const [page, components] of Array.from(byPage.entries()).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    const prefixes = groupBy(components, (component) => component.prefix);
    const prefixText = Array.from(prefixes.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([prefix, values]) => `${prefix}=${values.length}`)
      .join(", ");
    lines.push(`- page ${page}: ${components.length} components (${prefixText})`);
  }
  lines.push("");
  lines.push("## Key ICs");
  lines.push("");
  for (const component of model.components.filter((item) => item.prefix === "U")) {
    lines.push(`- ${component.ref} page ${component.page}: ${component.value || component.name} (${component.footprint})`);
  }
  lines.push("");
  lines.push("## Connectors");
  lines.push("");
  for (const component of model.components.filter((item) => item.prefix === "J")) {
    const pins = component.pins
      .sort((a, b) => Number(a.pin) - Number(b.pin))
      .map((pin) => `${pin.pin}=${pin.net || "NC"}`)
      .join("; ");
    lines.push(`- ${component.ref} page ${component.page}: ${component.value || component.name}; ${pins}`);
  }
  lines.push("");
  lines.push("## Top Nets");
  lines.push("");
  for (const net of model.nets.slice(0, 30)) {
    lines.push(`- ${net.name}: ${net.count}`);
  }
  lines.push("");
  if (diagnostics && diagnostics.timings && diagnostics.timings.length) {
    lines.push("## Read Timings");
    lines.push("");
    for (const item of diagnostics.timings) {
      lines.push(`- ${item.name}: ${item.ok ? "ok" : "failed"} ${item.elapsedMs} ms`);
    }
    lines.push("");
  }
  if (diagnostics && diagnostics.errors && diagnostics.errors.length) {
    lines.push("## Read Errors");
    lines.push("");
    for (const error of diagnostics.errors) {
      lines.push(`- ${error.step}: ${error.message}`);
    }
    lines.push("");
  }
  lines.push("## Risk Summary");
  lines.push("");
  if (!risks.length) {
    lines.push("- No basic-rule risks found.");
  } else {
    for (const risk of risks) {
      lines.push(`- [${risk.severity}] ${risk.title}: ${risk.details.length}`);
    }
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function renderConnectors(model) {
  const lines = ["# Connectors", ""];
  for (const component of model.components.filter((item) => item.prefix === "J")) {
    lines.push(`## ${component.ref} page ${component.page}`);
    lines.push("");
    lines.push(`- value: ${component.value || component.name}`);
    lines.push(`- footprint: ${component.footprint}`);
    lines.push("");
    for (const pin of component.pins.sort((a, b) => Number(a.pin) - Number(b.pin))) {
      lines.push(`- pin ${pin.pin}: ${pin.net || "NC"}`);
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

function renderRisks(risks) {
  const lines = ["# Review Risks", ""];
  if (!risks.length) {
    lines.push("No basic-rule risks found.");
    lines.push("");
    return lines.join("\n");
  }

  for (const risk of risks) {
    lines.push(`## [${risk.severity}] ${risk.title}`);
    lines.push("");
    for (const detail of risk.details) {
      lines.push(`- ${detail}`);
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

async function generateReports(opts, includeDrc) {
  const reportDir = path.resolve(ROOT, opts["report-dir"] || "reports/latest");
  ensureDir(reportDir);

  const runtime = {
    port: intOpt(opts, "port", DEFAULT_PORT),
    timeoutMs: intOpt(opts, "timeout", DEFAULT_TIMEOUT),
    retries: intOpt(opts, "retries", DEFAULT_RETRIES, { min: 0 }),
    retryDelayMs: intOpt(opts, "retry-delay", DEFAULT_RETRY_DELAY),
  };
  const sourceChars = intOpt(opts, "max-source-chars", 200000);
  const netlistChars = intOpt(opts, "max-netlist-chars", 500000);
  const netlistTimeout = intOpt(opts, "netlist-timeout", 60000);
  const timings = [];
  const errors = [];
  const startedAt = Date.now();

  let current = {};
  let sourceData = {};
  let netlistData = {};
  let model = emptyNetlistModel();
  let drcResult = null;

  await withBridgeSession(runtime, async (session) => {
    const sessionRuntime = { ...runtime, session };
    current = await timedOptionalStep(timings, errors, "current", () => getCurrent(sessionRuntime), {
      fallback: {},
    }) || {};

    if (Number(current.documentType) !== 1) {
      const ensureResponse = await timedOptionalStep(timings, errors, "ensure-page", () => callRpc("ensureSchematicPage", {}, sessionRuntime), {
        fallback: null,
      });
      if (ensureResponse && ensureResponse.result) {
        current = ensureResponse.result;
      } else {
        current = await timedOptionalStep(timings, errors, "current-after-ensure", () => getCurrent(sessionRuntime), {
          fallback: current,
        }) || current;
      }
    }

    if (Number(current.documentType) !== 1) {
      errors.push(readError(
        "schematic-page",
        new Error(`Current document is not a schematic page (documentType=${current.documentType === undefined ? "unknown" : current.documentType}). Open a schematic sheet/tab in JLCEDA and rerun read/review.`),
        true
      ));
      return;
    }

    sourceData = await readFullSourceForReports(sessionRuntime, timings, errors, sourceChars);
    netlistData = await timedOptionalStep(timings, errors, "netlist", () => getNetlist(sessionRuntime, netlistChars, netlistTimeout), {
      fallback: {},
    }) || {};
    if (includeDrc) {
      drcResult = await timedOptionalStep(timings, errors, "drc", () =>
        callTool("jlc.schematic.drc", { strict: true, userInterface: false }, sessionRuntime)
      , {
        fallback: null,
      });
      drcResult = unwrapToolData(drcResult) || drcResult;
    }
  });

  const sourceInfo = parseSource(sourceData.source);
  try {
    model = parseNetlist(netlistData.netlist);
  } catch (error) {
    errors.push(readError("netlist-parse", error));
    model = emptyNetlistModel();
  }

  const diagnostics = {
    ok: errors.length === 0,
    status: errors.some((item) => item.fatal) ? "failed" : (errors.length ? "degraded" : "ok"),
    generatedAt: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt,
    timings,
    source: {
      chars: sourceData.source ? sourceData.source.length : 0,
      totalChars: sourceData.totalChars || 0,
      truncated: Boolean(sourceData.truncated),
    },
    netlist: {
      chars: netlistData.netlist ? String(netlistData.netlist).length : 0,
      totalChars: netlistData.totalChars || 0,
      truncated: Boolean(netlistData.truncated),
      netlistType: netlistData.netlistType || "JLCEDA",
    },
    errors,
  };

  const risks = makeRisks(model, drcResult, diagnostics);
  const componentsCsv = model.components.map((component) => ({
    page: component.page,
    ref: component.ref,
    value: component.value,
    name: component.name,
    footprint: component.footprint,
    pin_count: component.pinCount,
    nets: component.pins.map((pin) => `${pin.pin}=${pin.net || "NC"}`).join("; "),
  }));
  const netsCsv = model.nets.map((net) => ({
    net: net.name,
    count: net.count,
    endpoints: net.endpoints.map((endpoint) => `${endpoint.ref}.${endpoint.pin}(p${endpoint.page})`).join("; "),
  }));

  writeJson(path.join(reportDir, "current.json"), current);
  writeText(path.join(reportDir, "source.schsrc"), sourceData.source || "");
  writeJson(path.join(reportDir, "source-info.json"), sourceInfo);
  writeJson(path.join(reportDir, "netlist.json"), model.raw);
  writeJson(path.join(reportDir, "drc.json"), drcResult);
  writeJson(path.join(reportDir, "diagnostics.json"), diagnostics);
  writeText(path.join(reportDir, "components.csv"), toCsv(componentsCsv, ["page", "ref", "value", "name", "footprint", "pin_count", "nets"]));
  writeText(path.join(reportDir, "nets.csv"), toCsv(netsCsv, ["net", "count", "endpoints"]));
  writeText(path.join(reportDir, "connectors.md"), renderConnectors(model));
  writeText(path.join(reportDir, "risks.md"), renderRisks(risks));
  writeText(path.join(reportDir, "summary.md"), renderSummary({ current, sourceInfo, model, risks, diagnostics }));

  return {
    reportDir,
    status: diagnostics.status,
    components: model.components.length,
    nets: model.nets.length,
    risks: risks.reduce((sum, risk) => sum + risk.details.length, 0),
    diagnostics,
    drc: drcResult,
  };
}

function validateEditPlan(plan) {
  if (!plan || typeof plan !== "object") {
    die("Edit plan must be a JSON object.");
  }
  if (!Array.isArray(plan.operations)) {
    die("Edit plan must contain an operations array.");
  }
  for (const [index, operation] of plan.operations.entries()) {
    if (!operation.tool || !SAFE_EDIT_TOOLS.has(operation.tool)) {
      die(`Operation ${index + 1} uses a non-whitelisted tool: ${operation.tool || "<missing>"}`);
    }
    if (operation.arguments && typeof operation.arguments !== "object") {
      die(`Operation ${index + 1} arguments must be an object.`);
    }
  }
}

function makeDefaultSmokePlan(opts) {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const designator = opts.designator || `R_AI_FAST_${stamp}`;
  return {
    generated: true,
    findDesignator: designator,
    operations: [
      {
        tool: "jlc.schematic.place_device",
        arguments: {
          ...DEFAULT_TEST_DEVICE,
          x: intOpt(opts, "x", DEFAULT_TEST_DEVICE.x),
          y: intOpt(opts, "y", DEFAULT_TEST_DEVICE.y),
          rotation: intOpt(opts, "rotation", DEFAULT_TEST_DEVICE.rotation, { min: 0 }),
          designator,
          name: opts.name || "AI_FAST_TEST_RESISTOR",
        },
      },
    ],
  };
}

function loadSmokePlan(opts, commandName) {
  if (opts.file) {
    const plan = readJsonFile(opts.file);
    validateEditPlan(plan);
    return plan;
  }

  if (commandName !== "smoke-fast") {
    die(`${commandName} requires --file edit-plan.json`);
  }

  const plan = makeDefaultSmokePlan(opts);
  validateEditPlan(plan);
  return plan;
}

async function withBridgeSession(runtime, fn) {
  const session = new BridgeSession(runtime);
  await session.open();
  try {
    return await fn(session);
  } finally {
    await session.close();
  }
}

function sourceContainsDesignator(source, designator) {
  if (!designator) return undefined;
  return String(source || "").includes(String(designator));
}

function normalizePrimitiveId(value) {
  const text = String(value || "");
  if (/^e\d+$/i.test(text)) return text;
  const match = text.match(/^\$?\d*I(\d+)$/i);
  if (match) return `e${match[1]}`;
  return text;
}

function verifySourceComponent(source, primitiveId, expected = {}) {
  const normalizedId = normalizePrimitiveId(primitiveId);
  const result = {
    primitiveId: normalizedId || null,
    componentExists: false,
    component: null,
    attrs: {},
    expectedDesignator: expected.designator || null,
    expectedName: expected.name || null,
    designatorMatches: undefined,
    nameMatches: undefined,
    bomDisabled: undefined,
    pcbDisabled: undefined,
  };

  if (!normalizedId) return result;

  for (const line of String(source || "").split(/\r?\n/)) {
    if (!line.trim()) continue;
    let item;
    try {
      item = JSON.parse(line);
    } catch (_) {
      continue;
    }

    if (item[0] === "COMPONENT" && item[1] === normalizedId) {
      result.componentExists = true;
      result.component = {
        id: item[1],
        device: item[2],
        x: item[3],
        y: item[4],
        rotation: item[5],
      };
      continue;
    }

    if (item[0] === "ATTR" && item[2] === normalizedId) {
      result.attrs[item[3]] = item[4] === undefined ? null : item[4];
    }
  }

  if (expected.designator !== undefined) {
    result.designatorMatches = result.attrs.Designator === expected.designator;
  }
  if (expected.name !== undefined) {
    result.nameMatches = result.attrs.Name === expected.name;
  }
  if (expected.addIntoBom !== undefined) {
    result.bomDisabled = expected.addIntoBom === false ? result.attrs["Add into BOM"] === "no" : result.attrs["Add into BOM"] !== "no";
  }
  if (expected.addIntoPcb !== undefined) {
    result.pcbDisabled = expected.addIntoPcb === false ? result.attrs["Convert to PCB"] === "no" : result.attrs["Convert to PCB"] !== "no";
  }

  return result;
}

async function timedStep(timings, name, fn) {
  const startedAt = Date.now();
  try {
    const result = await fn();
    timings.push({ name, ok: true, elapsedMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    timings.push({ name, ok: false, elapsedMs: Date.now() - startedAt, error: error.message });
    throw error;
  }
}

async function readSourceForVerification(sessionRuntime, timings, maxChars) {
  const initial = await timedStep(timings, "source-after", () => getSource(sessionRuntime, maxChars));
  if (!initial.truncated) return initial;

  const verifyChars = Math.max(1000000, (initial.totalChars || maxChars) + 1024);
  return timedStep(timings, "source-after-full", () => getSource(sessionRuntime, verifyChars));
}

function readError(step, error, fatal = false) {
  return {
    step,
    fatal,
    message: error && error.message ? error.message : String(error),
  };
}

async function timedOptionalStep(timings, errors, name, fn, options = {}) {
  try {
    return await timedStep(timings, name, fn);
  } catch (error) {
    errors.push(readError(name, error, Boolean(options.fatal)));
    if (options.fatal) throw error;
    return options.fallback;
  }
}

async function readFullSourceForReports(sessionRuntime, timings, errors, maxChars) {
  const initial = await timedOptionalStep(timings, errors, "source", () => getSource(sessionRuntime, maxChars), {
    fallback: {},
  });
  if (!initial || !initial.truncated) return initial || {};

  const verifyChars = Math.max(1000000, (initial.totalChars || maxChars) + 1024);
  return timedOptionalStep(timings, errors, "source-full", () => getSource(sessionRuntime, verifyChars), {
    fallback: initial,
  });
}

async function runEdit(opts) {
  if (!opts.file) die("edit requires --file edit-plan.json");
  const plan = readJsonFile(opts.file);
  validateEditPlan(plan);

  if (!opts.apply) {
    return {
      dryRun: true,
      operations: plan.operations.map((operation) => operation.tool),
      message: "Dry run only. Re-run with --apply to execute whitelisted operations.",
    };
  }

  const runtime = {
    port: intOpt(opts, "port", DEFAULT_PORT),
    timeoutMs: intOpt(opts, "timeout", DEFAULT_TIMEOUT),
    retries: intOpt(opts, "retries", DEFAULT_RETRIES, { min: 0 }),
    retryDelayMs: intOpt(opts, "retry-delay", DEFAULT_RETRY_DELAY),
  };
  return withBridgeSession(runtime, async (session) => {
    const sessionRuntime = { ...runtime, session };
    const startedAt = Date.now();
    const before = await getSource(sessionRuntime, intOpt(opts, "max-source-chars", 200000));
    const results = [];
    for (const operation of plan.operations) {
      const response = await callTool(operation.tool, operation.arguments || {}, sessionRuntime);
      results.push({ tool: operation.tool, ok: true, response: unwrapToolData(response) || response.result || response });
      await sleep(intOpt(opts, "post-edit-delay", 1000, { min: 0 }));
    }
    const after = await getSource(sessionRuntime, intOpt(opts, "max-source-chars", 200000));

    return {
      dryRun: false,
      operations: results,
      beforeChars: before.source ? before.source.length : 0,
      afterChars: after.source ? after.source.length : 0,
      changed: before.source !== after.source,
      elapsedMs: Date.now() - startedAt,
    };
  });
}

async function runSmoke(opts) {
  const plan = loadSmokePlan(opts, "smoke");
  const runtime = {
    port: intOpt(opts, "port", DEFAULT_PORT),
    timeoutMs: intOpt(opts, "timeout", DEFAULT_TIMEOUT),
    retries: intOpt(opts, "retries", DEFAULT_RETRIES, { min: 0 }),
    retryDelayMs: intOpt(opts, "retry-delay", DEFAULT_RETRY_DELAY),
  };

  return withBridgeSession(runtime, async (session) => {
    const sessionRuntime = { ...runtime, session };
    const startedAt = Date.now();
    const current = await getCurrent(sessionRuntime);
    const before = await getSource(sessionRuntime, intOpt(opts, "max-source-chars", 200000));
    const operationResults = [];
    if (opts.apply) {
      for (const operation of plan.operations) {
        const response = await callTool(operation.tool, operation.arguments || {}, sessionRuntime);
        operationResults.push({ tool: operation.tool, response: unwrapToolData(response) || response.result || response });
        await sleep(intOpt(opts, "post-edit-delay", 1000, { min: 0 }));
      }
    }
    let findResult;
    if (opts.find) {
      findResult = unwrapToolData(await callTool("jlc.schematic.find_by_designator", { designator: opts.find }, sessionRuntime));
    }
    const after = await getSource(sessionRuntime, intOpt(opts, "max-source-chars", 200000));

    return {
      dryRun: !opts.apply,
      calls: [
        "getCurrentDocumentInfo",
        "getDocumentSource",
        ...operationResults.map((item) => item.tool),
        ...(opts.find ? ["jlc.schematic.find_by_designator"] : []),
        "getDocumentSource",
      ],
      current,
      operations: operationResults,
      beforeChars: before.source ? before.source.length : 0,
      afterChars: after.source ? after.source.length : 0,
      changed: before.source !== after.source,
      elapsedMs: Date.now() - startedAt,
      find: findResult,
    };
  });
}

async function runSmokeFast(opts) {
  const plan = loadSmokePlan(opts, "smoke-fast");
  const runtime = {
    port: intOpt(opts, "port", DEFAULT_PORT),
    timeoutMs: intOpt(opts, "timeout", DEFAULT_TIMEOUT),
    retries: intOpt(opts, "retries", DEFAULT_RETRIES, { min: 0 }),
    retryDelayMs: intOpt(opts, "retry-delay", DEFAULT_RETRY_DELAY),
  };
  const postEditDelay = intOpt(opts, "post-edit-delay", 500, { min: 0 });
  const sourceChars = intOpt(opts, "max-source-chars", 200000);
  const designator = opts.find || plan.findDesignator || plan.operations?.[0]?.arguments?.designator || opts.designator;

  return withBridgeSession(runtime, async (session) => {
    const sessionRuntime = { ...runtime, session };
    const timings = [];
    const startedAt = Date.now();
    const current = await timedStep(timings, "current", () => getCurrent(sessionRuntime));
    const before = await timedStep(timings, "source-before", () => getSource(sessionRuntime, sourceChars));

    const writeResults = [];
    if (opts.apply) {
      for (const operation of plan.operations) {
        const response = await timedStep(timings, operation.tool, () => callTool(operation.tool, operation.arguments || {}, sessionRuntime));
        writeResults.push({
          tool: operation.tool,
          response: unwrapToolData(response) || response.result || response,
        });
        if (postEditDelay) await sleep(postEditDelay);
      }
    }

    let findResult = null;
    if (designator) {
      findResult = await timedStep(timings, "find-by-designator", () =>
        callTool("jlc.schematic.find_by_designator", { designator }, sessionRuntime)
      );
      findResult = unwrapToolData(findResult);
    }

    const after = await readSourceForVerification(sessionRuntime, timings, sourceChars);
    const changed = before.source !== after.source;
    const designatorSeen = sourceContainsDesignator(after.source, designator);
    const placedPrimitiveId = writeResults.find((item) => item.response && item.response.primitiveId)?.response?.primitiveId;
    const expectedPlaceArgs = plan.operations.find((operation) => operation.tool === "jlc.schematic.place_device")?.arguments || {};
    const sourceVerification = opts.apply ? verifySourceComponent(after.source, placedPrimitiveId, expectedPlaceArgs) : null;
    const verified = !opts.apply || (
      changed &&
      sourceVerification &&
      sourceVerification.componentExists &&
      sourceVerification.designatorMatches !== false &&
      sourceVerification.nameMatches !== false &&
      sourceVerification.bomDisabled !== false &&
      sourceVerification.pcbDisabled !== false
    );

    return {
      dryRun: !opts.apply,
      designator,
      verified,
      current,
      timings,
      operations: writeResults,
      beforeChars: before.source ? before.source.length : 0,
      afterChars: after.source ? after.source.length : 0,
      changed,
      designatorSeen,
      sourceVerification,
      find: findResult,
      elapsedMs: Date.now() - startedAt,
    };
  });
}

async function main() {
  const opts = parseArgv(process.argv.slice(2));
  const command = opts._[0];

  if (!command || opts.help || command === "help" || command === "--help") {
    process.stdout.write(usage());
    return;
  }

  const runtime = {
    port: intOpt(opts, "port", DEFAULT_PORT),
    timeoutMs: intOpt(opts, "timeout", DEFAULT_TIMEOUT),
    retries: intOpt(opts, "retries", DEFAULT_RETRIES, { min: 0 }),
    retryDelayMs: intOpt(opts, "retry-delay", DEFAULT_RETRY_DELAY),
  };

  if (command === "ping") {
    process.stdout.write(`${JSON.stringify(await callTool("jlc.bridge.ping", {}, runtime), null, 2)}\n`);
    return;
  }

  if (command === "tools") {
    process.stdout.write(`${JSON.stringify(await listTools(runtime), null, 2)}\n`);
    return;
  }

  if (command === "current") {
    process.stdout.write(`${JSON.stringify(await getCurrent(runtime), null, 2)}\n`);
    return;
  }

  if (command === "call") {
    const tool = opts.tool || opts.name || opts._[1];
    if (!tool) die("call requires --tool <name>");
    const args = readArgsJson(opts);
    const response = await callTool(tool, args, runtime);
    process.stdout.write(`${JSON.stringify(response, null, 2)}\n`);
    return;
  }

  if (command === "rpc") {
    const method = opts.method || opts._[1];
    if (!method) die("rpc requires --method <name>");
    const params = readArgsJson(opts);
    const response = await callRpc(method, params, runtime);
    process.stdout.write(`${JSON.stringify(response, null, 2)}\n`);
    return;
  }

  if (command === "source") {
    const data = await getSource(runtime, intOpt(opts, "max-chars", 200000));
    if (opts.out) writeText(path.resolve(ROOT, opts.out), data.source || "");
    if (opts.out && !opts.raw) {
      process.stdout.write(`${JSON.stringify({
        out: opts.out,
        totalChars: data.totalChars,
        truncated: data.truncated,
      }, null, 2)}\n`);
      return;
    }
    process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
    return;
  }

  if (command === "netlist") {
    const data = await getNetlist(runtime, intOpt(opts, "max-chars", 500000));
    if (opts.out) writeJson(path.resolve(ROOT, opts.out), parseNetlist(data.netlist).raw);
    if (opts.out && !opts.raw) {
      process.stdout.write(`${JSON.stringify({
        out: opts.out,
        totalChars: data.totalChars,
        truncated: data.truncated,
        netlistType: data.netlistType,
      }, null, 2)}\n`);
      return;
    }
    process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
    return;
  }

  if (command === "read" || command === "review") {
    const result = await generateReports(opts, command === "review" && !opts["no-drc"]);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  if (command === "edit") {
    const result = await runEdit(opts);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  if (command === "smoke") {
    const result = await runSmoke(opts);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  if (command === "smoke-fast") {
    const result = await runSmokeFast(opts);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  die(`Unknown command: ${command}\n\n${usage()}`);
}

main().catch((error) => {
  die(error.stack || error.message || String(error));
});
