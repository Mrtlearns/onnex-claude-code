import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/chat`;

Deno.test("chat: handles CORS preflight", async () => {
  const res = await fetch(FUNCTION_URL, { method: "OPTIONS" });
  await res.text();
  assertEquals(res.status, 200);
  assertExists(res.headers.get("access-control-allow-origin"));
});

Deno.test("chat: rejects missing authorization", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: 1, message: "hello" }),
  });
  const body = await res.text();
  assertEquals(res.status, 500);
  assertExists(body);
});

Deno.test("chat: rejects missing session_id", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ message: "hello" }),
  });
  const body = await res.json();
  assertEquals(res.status, 500);
  assertExists(body.error);
});

Deno.test("chat: rejects missing message", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ session_id: 1 }),
  });
  const body = await res.json();
  assertEquals(res.status, 500);
  assertExists(body.error);
});

Deno.test("chat: rejects invalid JSON body", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: "not-json",
  });
  const body = await res.text();
  assertEquals(res.status, 500);
  assertExists(body);
});

Deno.test("chat: rejects invalid auth token", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer invalid-token-12345",
    },
    body: JSON.stringify({ session_id: 1, message: "hello" }),
  });
  const body = await res.json();
  assertEquals(res.status, 500);
  assertExists(body.error);
});
