#!/usr/bin/env node
/**
 * PI Lawyer OS — PostgREST MCP Server
 * Exposes live case/lead data to Wyatt via the Model Context Protocol.
 * Runs inside the openclaw container over stdin/stdout.
 */

"use strict";

const crypto = require("crypto");
const https = require("https");
const http = require("http");
const { URL } = require("url");

// ── Config ────────────────────────────────────────────────────────────────────

const POSTGREST_URL = process.env.PILAWEROS_API_URL || "http://postgrest:3000";
const JWT_SECRET    = process.env.JWT_SECRET         || "";
const FIRM_LIMIT    = 100; // max rows per list call

// ── JWT (HS256, no dependencies) ──────────────────────────────────────────────

function b64url(buf) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function makeServiceJwt() {
  const header  = b64url(Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payload = b64url(Buffer.from(JSON.stringify({
    role: "web_user",
    firm_id: null,     // service token: PostgREST RLS bypass via web_user (reads all firms)
    user_role: "admin",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  })));
  const sig = b64url(
    crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest()
  );
  return `${header}.${payload}.${sig}`;
}

// ── HTTP helper ───────────────────────────────────────────────────────────────

function pgGet(path) {
  return new Promise((resolve, reject) => {
    const token = makeServiceJwt();
    const url   = new URL(path, POSTGREST_URL);
    const mod   = url.protocol === "https:" ? https : http;

    const req = mod.get(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept:        "application/json",
        "Accept-Profile": "public",
      },
    }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        if (res.statusCode >= 400) {
          reject(new Error(`PostgREST ${res.statusCode}: ${data}`));
        } else {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`JSON parse error: ${e.message}`));
          }
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

// ── Tools ─────────────────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "get_leads",
    description: "List leads. Filter by status (new|contacted|signed|lost|dead) or source. Returns up to 50 most recent.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", description: "Filter by lead status (optional)" },
        source: { type: "string", description: "Filter by source e.g. web, phone (optional)" },
        limit:  { type: "number", description: "Max results (default 20, max 50)" },
      },
    },
  },
  {
    name: "get_lead",
    description: "Get full details of a single lead by ID.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string", description: "Lead UUID" },
      },
    },
  },
  {
    name: "get_cases",
    description: "List cases. Filter by status (investigation|demand|litigation|settled|closed) or assigned attorney name. Returns up to 50 most recent.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", description: "Filter by case status (optional)" },
        limit:  { type: "number", description: "Max results (default 20, max 50)" },
      },
    },
  },
  {
    name: "get_case",
    description: "Get full details of a single case by ID, including medical providers and settlement offers.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string", description: "Case UUID" },
      },
    },
  },
  {
    name: "get_communications",
    description: "Get communication history for a lead (calls, SMS, emails).",
    inputSchema: {
      type: "object",
      required: ["lead_id"],
      properties: {
        lead_id: { type: "string", description: "Lead UUID" },
        limit:   { type: "number", description: "Max results (default 20)" },
      },
    },
  },
  {
    name: "get_analytics_summary",
    description: "Get high-level firm analytics: lead counts by status, case counts by status, recent activity.",
    inputSchema: { type: "object", properties: {} },
  },
];

async function callTool(name, args) {
  const lim = Math.min(args.limit || 20, 50);

  switch (name) {
    case "get_leads": {
      let qs = `order=created_at.desc&limit=${lim}`;
      if (args.status) qs += `&status=eq.${encodeURIComponent(args.status)}`;
      if (args.source) qs += `&source=eq.${encodeURIComponent(args.source)}`;
      const rows = await pgGet(`/leads?${qs}&select=id,first_name,last_name,phone,email,status,source,lead_score,is_duplicate,created_at,last_contact_at`);
      return `Found ${rows.length} leads:\n\n${JSON.stringify(rows, null, 2)}`;
    }

    case "get_lead": {
      const rows = await pgGet(`/leads?id=eq.${encodeURIComponent(args.id)}&select=*`);
      if (!rows.length) return "Lead not found.";
      return JSON.stringify(rows[0], null, 2);
    }

    case "get_cases": {
      let qs = `order=created_at.desc&limit=${lim}`;
      if (args.status) qs += `&status=eq.${encodeURIComponent(args.status)}`;
      const rows = await pgGet(`/cases?${qs}&select=id,case_number,status,incident_type,incident_date,assigned_attorney,sol_date,created_at`);
      return `Found ${rows.length} cases:\n\n${JSON.stringify(rows, null, 2)}`;
    }

    case "get_case": {
      const [cases, providers, offers] = await Promise.all([
        pgGet(`/cases?id=eq.${encodeURIComponent(args.id)}&select=*`),
        pgGet(`/medical_providers?case_id=eq.${encodeURIComponent(args.id)}&select=*`),
        pgGet(`/settlement_offers?case_id=eq.${encodeURIComponent(args.id)}&select=*&order=created_at.desc`),
      ]);
      if (!cases.length) return "Case not found.";
      return JSON.stringify({ case: cases[0], medical_providers: providers, settlement_offers: offers }, null, 2);
    }

    case "get_communications": {
      const lim2 = Math.min(args.limit || 20, 50);
      const rows = await pgGet(
        `/communications?lead_id=eq.${encodeURIComponent(args.lead_id)}&order=created_at.desc&limit=${lim2}&select=id,channel,direction,message,created_at`
      );
      return `Found ${rows.length} communications:\n\n${JSON.stringify(rows, null, 2)}`;
    }

    case "get_analytics_summary": {
      const [leadSummary, caseSummary] = await Promise.all([
        pgGet(`/v_analytics_lead_funnel?select=*`),
        pgGet(`/v_analytics_case_summary?select=*`),
      ]);
      return JSON.stringify({ lead_funnel: leadSummary, case_summary: caseSummary }, null, 2);
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ── MCP JSON-RPC server (stdio) ───────────────────────────────────────────────

let buf = "";

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buf += chunk;
  const lines = buf.split("\n");
  buf = lines.pop(); // incomplete last line

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    handleMessage(trimmed);
  }
});

async function handleMessage(raw) {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }

  const { id, method, params } = msg;

  try {
    let result;

    if (method === "initialize") {
      result = {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "postgrest-mcp", version: "1.0.0" },
      };
    } else if (method === "tools/list") {
      result = { tools: TOOLS };
    } else if (method === "tools/call") {
      const text = await callTool(params.name, params.arguments || {});
      result = { content: [{ type: "text", text }] };
    } else if (method === "notifications/initialized") {
      return; // no response needed for notifications
    } else {
      send({ jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } });
      return;
    }

    send({ jsonrpc: "2.0", id, result });
  } catch (err) {
    send({ jsonrpc: "2.0", id, error: { code: -32000, message: err.message } });
  }
}

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

process.stderr.write("PostgREST MCP server started\n");
