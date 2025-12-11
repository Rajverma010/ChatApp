// src/api/api.js
import axios from "axios";

export const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
  withCredentials: true, // allow cookies (refresh token cookie)
});

// helper to set/remove Authorization header and persist token
export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    localStorage.setItem("token", token);
  } else {
    delete api.defaults.headers.common["Authorization"];
    localStorage.removeItem("token");
  }
}

export function getStoredToken() {
  return localStorage.getItem("token");
}

// internecptor logic: on 401, try refresh once then retry original request
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config;
    if (!originalRequest) return Promise.reject(err);

    // if status is 401 and we haven't tried refresh on this request
    if (err.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // queue while refreshing
        return new Promise(function (resolve, reject) {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers["Authorization"] = "Bearer " + token;
            return api(originalRequest);
          })
          .catch((e) => Promise.reject(e));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Try refresh (server should use HttpOnly refresh cookie OR accept stored refreshToken)
        const refreshRes = await axios.post(`${API_BASE}/api/auth/refresh`, {}, { withCredentials: true });
        const newToken = refreshRes.data?.token;
        if (!newToken) throw new Error("No token from refresh");

        // set new token in this api instance & storage
        setAuthToken(newToken);
        processQueue(null, newToken);
        isRefreshing = false;
        originalRequest.headers["Authorization"] = "Bearer " + newToken;
        return api(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        isRefreshing = false;
        // if refresh failed, logout client by removing token
        setAuthToken(null);
        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(err);
  }
);

export default api;
