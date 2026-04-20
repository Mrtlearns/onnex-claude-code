import client from "./client";

export async function listSubs() {
  const response = await client.get("/api/subcontractors");
  return response.data;
}

export async function createSub(data) {
  const response = await client.post("/api/subcontractors", data);
  return response.data;
}

export async function getSub(id) {
  const response = await client.get(`/api/subcontractors/${id}`);
  return response.data;
}

export async function updateSub(id, data) {
  const response = await client.put(`/api/subcontractors/${id}`, data);
  return response.data;
}

export async function syncOsha(id) {
  const response = await client.post(`/api/subcontractors/${id}/sync-osha`);
  return response.data;
}

export async function getViolations(id) {
  const response = await client.get(`/api/subcontractors/${id}/violations`);
  return response.data;
}

export async function getCerts(id) {
  const response = await client.get(`/api/subcontractors/${id}/certifications`);
  return response.data;
}
