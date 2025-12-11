// src/auth/Login.jsx
import React, { useState } from "react";
import { Box, Paper, Typography, TextField, Button, Stack, Link, Checkbox, FormControlLabel } from "@mui/material";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);

  const auth = useAuth();
  const navigate = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const res = await auth.login({ username: username.trim(), password, rememberMe: remember });
    setLoading(false);
    if (res.ok) {
      navigate("/", { replace: true });
    } else {
      alert(res.error || "Login failed");
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", p: 2 }}>
      <Paper component="form" onSubmit={onSubmit} sx={{ p: 5, maxWidth: 420, width: "100%" }} elevation={6}>
        <Typography variant="h5" mb={2} align="center">Sign in</Typography>
        <Stack spacing={2}>
          <TextField label="Username" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
          <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <FormControlLabel control={<Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)} />} label="Remember me" />
          <Button type="submit" variant="contained" disabled={loading}>Sign in</Button>
          <Typography variant="body2" align="center">
            Don't have an account? <Link component={RouterLink} to="/register">Register</Link>
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
}
