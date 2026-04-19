import client from "./client";

export async function listProjects() {
  const response = await client.get("/api/projects");
  return response.data;
}

export async function createProject(data) {
  const response = await client.post("/api/projects", data);
  return response.data;
}

export async function getProject(id) {
  const response = await client.get(`/api/projects/${id}`);
  return response.data;
}

export async function updateProject(id, data) {
  const response = await client.put(`/api/projects/${id}`, data);
  return response.data;
}

export async function addSubToProject(projId, subId) {
  const response = await client.post(`/api/projects/${projId}/subcontractors`, {
    subcontractor_id: subId
  });
  return response.data;
}

export async function removeSubFromProject(projId, subId) {
  const response = await client.delete(`/api/projects/${projId}/subcontractors/${subId}`);
  return response.data;
}
