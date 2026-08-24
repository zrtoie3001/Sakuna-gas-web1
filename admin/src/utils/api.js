import axios from "axios";

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || "http://localhost:3001", timeout: 12000 });

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem("admin_token");
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  r => r,
  async err => {
    if (err.response?.status === 401) {
      localStorage.removeItem("admin_token");
      window.location.href = "/login";
      return Promise.reject(err);
    }
    // Retry once on timeout or network error (GET only)
    const cfg = err.config;
    if (!cfg || cfg._retry || cfg.method !== "get") return Promise.reject(err);
    if (err.code === "ECONNABORTED" || err.code === "ERR_NETWORK" || !err.response) {
      cfg._retry = true;
      await new Promise(r => setTimeout(r, 1500));
      return api(cfg);
    }
    return Promise.reject(err);
  }
);

export default api;
