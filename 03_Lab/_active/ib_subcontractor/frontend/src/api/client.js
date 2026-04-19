import axios from "axios";
import toast from "react-hot-toast";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const TOKEN_KEY = "prequal_token";

const client = axios.create({
  baseURL: API_BASE_URL
});

client.interceptors.request.use((config) => {
  const token = window.localStorage.getItem(TOKEN_KEY);

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error?.response?.data?.detail ||
      error?.response?.data?.message ||
      error?.message ||
      "Request failed";

    toast.error(typeof message === "string" ? message : "Request failed");

    if (error?.response?.status === 401 && window.location.pathname !== "/login") {
      window.localStorage.removeItem(TOKEN_KEY);
      window.location.assign("/login");
    }

    return Promise.reject(error);
  }
);

export default client;
