// src/auth/PrivateRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function PrivateRoute({ children }) {
  const { user, ready } = useAuth();

  // while restore is pending, don't redirect — show nothing or a spinner
  if (!ready) return null;

  return user ? children : <Navigate to="/login" replace />;
}
