import client from "./client";

export async function login(email, password) {
  const response = await client.post("/api/auth/login", { email, password });
  return response.data;
}

export async function register(orgName, email, password) {
  const response = await client.post("/api/auth/register", { orgName, email, password });
  return response.data;
}

export async function getMe() {
  const response = await client.get("/api/auth/me");
  return response.data;
}
