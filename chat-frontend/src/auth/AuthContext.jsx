// src/auth/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import api, { setAuthToken, getStoredToken } from "../api/api";
import { connectSocketWithToken, disconnectSocket } from "../api/socket";

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

/**
 * AuthProvider responsibilities:
 * - store user and access token in memory (and token in localStorage via setAuthToken)
 * - restore session on load by calling refresh endpoint if needed
 * - expose login/register/logout functions and a "loading" flag
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false); // ready after restore attempt
  const [authLoading, setAuthLoading] = useState(false);

  // restore session on mount:
  const restore = useCallback(async () => {
    setAuthLoading(true);
    try {
      // If we have an access token already stored, use it and try to validate/refresh
      const token = getStoredToken();
      if (token) {
        setAuthToken(token);
        // Optionally verify via server (fetch profile) or try UI flow that triggers 401->refresh
        // We'll call /api/auth/refresh to ensure token is current (server should accept refresh cookie).
        const res = await api.post("/api/auth/refresh");
        // refresh returns new token and maybe user info
        const newToken = res.data?.token;
        const userObj = res.data?.user;
        if (newToken) {
          setAuthToken(newToken);
        }
        if (userObj) setUser(userObj);
        // if server only returns token, we still rely on localStorage user snapshot:
        if (!userObj) {
          const storedUser = localStorage.getItem("user");
          if (storedUser) setUser(JSON.parse(storedUser));
        }
        // connect socket
        const finalToken = newToken || token;
        if (finalToken) connectSocketWithToken(finalToken);
      } else {
        // no token -> maybe server has refresh cookie; try refresh endpoint once
        try {
          const res2 = await api.post("/api/auth/refresh");
          const newToken = res2.data?.token;
          const userObj = res2.data?.user;
          if (newToken) {
            setAuthToken(newToken);
            if (userObj) {
              setUser(userObj);
              localStorage.setItem("user", JSON.stringify(userObj));
            }
            connectSocketWithToken(newToken);
          }
        } catch (err) {
          // ignore — not logged in
        }
      }
    } catch (err) {
      console.warn("restore session failed", err);
    } finally {
      setAuthLoading(false);
      setReady(true);
    }
  }, []);

  useEffect(() => {
    restore();
  }, [restore]);

  // login: server should set refresh cookie (httpOnly) or return refresh token
  const login = async ({ username, password, rememberMe }) => {
    setAuthLoading(true);
    try {
      const res = await api.post("/api/auth/login", { username, password, rememberMe });
      const { token, user: userObj, refreshToken } = res.data;

      if (!token) throw new Error("No access token from server");

      setAuthToken(token);
      setUser(userObj);
      localStorage.setItem("user", JSON.stringify(userObj));

      // If server returns refreshToken (not recommended), store only if rememberMe.
      if (refreshToken && rememberMe) {
        localStorage.setItem("refreshToken", refreshToken);
      }

      // connect socket
      connectSocketWithToken(token);

      return { ok: true };
    } catch (err) {
      console.error("login failed", err);
      return { ok: false, error: err.response?.data?.error || err.message };
    } finally {
      setAuthLoading(false);
    }
  };

  const register = async ({ username, password, rememberMe }) => {
    setAuthLoading(true);
    try {
      const res = await api.post("/api/auth/register", { username, password, rememberMe });
      const { token, user: userObj, refreshToken } = res.data;
      if (!token) throw new Error("No access token from server");
      setAuthToken(token);
      setUser(userObj);
      localStorage.setItem("user", JSON.stringify(userObj));
      if (refreshToken && rememberMe) localStorage.setItem("refreshToken", refreshToken);
      connectSocketWithToken(token);
      return { ok: true };
    } catch (err) {
      console.error("register failed", err);
      return { ok: false, error: err.response?.data?.error || err.message };
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = async () => {
    setAuthLoading(true);
    try {
      // call backend to clear refresh token cookie / blacklist
      await api.post("/api/auth/logout").catch(() => {});
    } catch (_) {}
    // client cleanup
    setUser(null);
    setAuthToken(null);
    localStorage.removeItem("user");
    localStorage.removeItem("refreshToken");
    disconnectSocket();
    setAuthLoading(false);
  };

  const value = {
    user,
    ready,
    authLoading,
    login,
    logout,
    register,
    restore,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
