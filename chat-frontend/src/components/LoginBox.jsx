import React from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
} from "@mui/material";

export default function LoginBox({ usernameInput, setUsernameInput, onSubmit }) {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
      }}
    >
      <Paper
        elevation={6}
        sx={{ p: 5, width: "100%", maxWidth: 450, borderRadius: 3 }}
        component="form"
        onSubmit={onSubmit}
      >
        <Typography variant="h4" align="center" mb={1} color="primary">
          ChatApp 💬
        </Typography>
        <Typography variant="body1" align="center" mb={4} color="text.secondary">
          Sign in to start messaging.
        </Typography>
        <TextField
          label="Username"
          variant="outlined"
          fullWidth
          value={usernameInput}
          onChange={(e) => setUsernameInput(e.target.value)}
          margin="normal"
          autoFocus
        />
        <Button type="submit" variant="contained" fullWidth sx={{ mt: 3, py: 1.5 }}>
          Enter Chat
        </Button>
      </Paper>
    </Box>
  );
}
