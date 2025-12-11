// src/components/AuthForm.jsx
import React, { useState } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Stack,
  Link,
} from "@mui/material";
import api, { setAuthToken } from "../api/api";
import { connectSocketWithToken } from "../api/socket";

export default function AuthForm({ onAuthSuccess }) {
  // mode: "login" | "register"
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const toggleMode = (e) => {
    e?.preventDefault();
    setMode((m) => (m === "login" ? "register" : "login"));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const res = await api.post(endpoint, { username: username.trim(), password });
      const { token, user } = res.data;

      // set axios default header + localStorage
      setAuthToken(token);

      // connect socket with token
      connectSocketWithToken(token);

      // call callback to set user in app state
      onAuthSuccess(user, token);
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.error || "Auth failed";
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
      }}
    >
      <Paper elevation={6} sx={{ p: 5, width: "100%", maxWidth: 420, borderRadius: 3 }} component="form" onSubmit={handleSubmit}>
        <Typography variant="h4" align="center" mb={1} color="primary">
          {mode === "login" ? "Welcome back" : "Create account"}
        </Typography>
        <Typography variant="body2" align="center" mb={3} color="text.secondary">
          {mode === "login" ? "Sign in to continue." : "Register to start chatting."}
        </Typography>

        <Stack spacing={2}>
          <TextField
            label="Username"
            variant="outlined"
            fullWidth
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
          <TextField
            label="Password"
            variant="outlined"
            type="password"
            fullWidth
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" variant="contained" fullWidth disabled={loading}>
            {mode === "login" ? "Sign in" : "Create account"}
          </Button>

          <Typography variant="body2" align="center" color="text.secondary">
            {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
            <Link href="#" onClick={toggleMode} underline="hover">
              {mode === "login" ? "Register" : "Sign in"}
            </Link>
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
}
