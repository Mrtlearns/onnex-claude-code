import client from "./client";

export async function uploadCert(formData) {
  const response = await client.post("/api/certifications", formData, {
    headers: {
      "Content-Type": "multipart/form-data"
    }
  });
  return response.data;
}

export async function updateCert(id, data) {
  const response = await client.put(`/api/certifications/${id}`, data);
  return response.data;
}

export async function deleteCert(id) {
  const response = await client.delete(`/api/certifications/${id}`);
  return response.data;
}
