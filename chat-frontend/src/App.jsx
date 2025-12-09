import React, { useEffect, useState, useRef, useMemo } from "react";
import { io } from "socket.io-client";
import axios from "axios";

import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Paper,
  TextField,
  Button,
  List,
  ListItemButton,
  ListItemText,
  Divider,
  Stack,
  IconButton,
  Chip,
  Avatar,
  CircularProgress,
  CssBaseline,
  useMediaQuery,
} from "@mui/material";

import { ThemeProvider, createTheme } from "@mui/material/styles";

import SendIcon from "@mui/icons-material/Send";
import AddIcon from "@mui/icons-material/Add";
import GroupIcon from "@mui/icons-material/Group";
import LogoutIcon from "@mui/icons-material/Logout";

const API_BASE = "http://localhost:4000";
const socket = io(API_BASE, { autoConnect: false, transports: ["websocket"] });

// Helper to generate a consistent color for user avatars
const stringToColor = (string = "") => {
  if (!string) return "#888888";
  let hash = 0;
  for (let i = 0; i < string.length; i++) {
    hash = string.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = "#";
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xff;
    color += ("00" + value.toString(16)).slice(-2);
  }
  return color;
};

/* ----------------- Diagnostics (useful while debugging) ----------------- */
// Attach axios interceptor so requests log and Authorization header can be injected later
axios.interceptors.request.use(
  (cfg) => {
    try {
      // if you store token in localStorage under "chatapp_auth_v1", attach it automatically:
      const raw = localStorage.getItem("chatapp_auth_v1");
      if (raw) {
        const { token } = JSON.parse(raw);
        if (token) cfg.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {}
    return cfg;
  },
  (err) => {
    console.error("axios request error", err);
    return Promise.reject(err);
  }
);

axios.interceptors.response.use(
  (r) => r,
  (err) => {
    console.error("axios response error", err?.response || err);
    // optional: auto logout on 401
    // if (err?.response?.status === 401) { localStorage.removeItem("chatapp_auth_v1"); window.location.reload(); }
    return Promise.reject(err);
  }
);
/* ----------------------------------------------------------------------- */

function App() {
  // auto detect system theme
  const prefersDarkMode = useMediaQuery("(prefers-color-scheme: dark)");

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: prefersDarkMode ? "dark" : "light",
          primary: {
            main: "#3498db",
          },
          background: {
            default: prefersDarkMode ? "#121212" : "#f0f2f5",
            paper: prefersDarkMode ? "#1e1e1e" : "#ffffff",
          },
        },
      }),
    [prefersDarkMode]
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ChatApp />
    </ThemeProvider>
  );
}

function ChatApp() {
  const [user, setUser] = useState(null); // {_id, username}
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [onlineUsers, setOnlineUsers] = useState([]); // [{userId, username}]

  const [activeUser, setActiveUser] = useState(null); // private chat target
  const [activeRoom, setActiveRoom] = useState(null); // current room

  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [rooms, setRooms] = useState([]);
  const [newRoomName, setNewRoomName] = useState("");

  // Ref for auto-scroll
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(scrollToBottom, [messages]);

  // Restore session on mount (if token present)
  useEffect(() => {
    const restore = async () => {
      try {
        const raw = localStorage.getItem("chatapp_auth_v1");
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!parsed) return;

        if (parsed.token) {
          // try to validate token on server
          try {
            const res = await axios.get(`${API_BASE}/api/auth/me`);
            // expected: res.data => user object
            if (res?.data) {
              setUser(res.data);
              return;
            }
          } catch (err) {
            // server may not provide /api/auth/me — fallback to stored user
            console.warn("auth/me failed, falling back to stored user");
            if (parsed.user) setUser(parsed.user);
          }
        } else if (parsed.user) {
          setUser(parsed.user);
        }
      } catch (err) {
        console.warn("Session restore failed", err);
        localStorage.removeItem("chatapp_auth_v1");
      }
    };
    restore();
  }, []);

  // ------------------ SOCKET SETUP ------------------
  useEffect(() => {
    if (!user) return;

    // send token-based auth when using JWT; your current backend expects { token }.
    // if you're still using socket auth with { userId, username } (legacy), keep that.
    // Here I set token if present in localStorage, otherwise fallback to user object:
    const stored = (() => {
      try {
        return JSON.parse(localStorage.getItem("chatapp_auth_v1"));
      } catch {
        return null;
      }
    })();

    if (stored?.token) {
      socket.auth = { token: stored.token };
    } else {
      socket.auth = { userId: user._id, username: user.username };
    }

    socket.connect();

    socket.on("onlineUsers", setOnlineUsers);

    socket.on("privateMessage", (msg) => {
      if (
        (msg.from === user._id && msg.to === activeUser?.userId) ||
        (msg.to === user._id && msg.from === activeUser?.userId)
      ) {
        setMessages((prev) => [...prev, msg]);
      }
    });

    socket.on("roomMessage", (msg) => {
      if (msg.roomId === activeRoom?._id) {
        setMessages((prev) => [...prev, msg]);
      }
    });

    socket.on("connect_error", (err) => {
      console.error("Socket connect_error (client):", err);
    });

    return () => {
      socket.off("onlineUsers");
      socket.off("privateMessage");
      socket.off("roomMessage");
      socket.off("connect_error");
      socket.disconnect();
    };
  }, [user, activeUser, activeRoom]);

  // ------------------ LOGIN ------------------
const handleLogin = async (e) => {
  e?.preventDefault?.();
  const username = usernameInput.trim();
  const password = passwordInput;
  if (!username || !password) {
    alert("Please enter username and password");
    return;
  }

  try {
    // NOTE: backend expects "identifier" (username or email)
    const res = await axios.post(`${API_BASE}/api/auth/login`, {
      identifier: username,
      password,
    });

    if (res?.data?.token && res?.data?.user) {
      localStorage.setItem(
        "chatapp_auth_v1",
        JSON.stringify({ token: res.data.token, user: res.data.user })
      );
      setUser(res.data.user);
      setUsernameInput("");
      setPasswordInput("");
      return;
    }

    console.warn("Login response unexpected:", res?.data);
    alert("Login succeeded but server response is unexpected.");
  } catch (err) {
    console.warn("Login failed, attempting to register...", err?.response?.status, err?.response?.data);

    const status = err?.response?.status;

    // If credentials invalid / user missing (401) -> try to register automatically
    if (status === 401 || status === 400) {
      try {
        const reg = await axios.post(`${API_BASE}/api/auth/register`, {
          username,
          password,
        });

        if (reg?.data?.token && reg?.data?.user) {
          localStorage.setItem(
            "chatapp_auth_v1",
            JSON.stringify({ token: reg.data.token, user: reg.data.user })
          );
          setUser(reg.data.user);
          setUsernameInput("");
          setPasswordInput("");
          alert("Account created and logged in.");
          return;
        }

        console.warn("Register response unexpected:", reg?.data);
        alert("Registration unexpectedly succeeded but response is odd.");
      } catch (regErr) {
        console.error("Auto-register failed:", regErr?.response || regErr);
        // show the server message if present
        const msg = regErr?.response?.data?.error || regErr?.response?.data?.message;
        alert("Register failed: " + (msg || regErr.message || "unknown"));
      }
      return;
    }

    // Other errors: show a helpful message
    if (status === 404) {
      alert("Login endpoint not found. Check backend routes.");
    } else {
      alert(err?.response?.data?.message || err.message || "Login failed");
    }
  }
};


  // ------------------ REGISTER ------------------
  const handleRegister = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    const username = usernameInput.trim();
    const password = passwordInput;
    if (!username || !password) {
      alert("Please enter username and password to register");
      return;
    }
    try {
      const res = await axios.post(`${API_BASE}/api/auth/register`, {
        username,
        password,
      });
      if (res?.data?.token && res?.data?.user) {
        localStorage.setItem(
          "chatapp_auth_v1",
          JSON.stringify({ token: res.data.token, user: res.data.user })
        );
        setUser(res.data.user);
        setUsernameInput("");
        setPasswordInput("");
        return;
      }
      console.warn("Register response unexpected:", res?.data);
      alert("Registered but response format is unexpected.");
    } catch (err) {
      console.error("Register error:", err?.response || err);
      const status = err?.response?.status;
      if (status === 400) alert("Bad request: " + JSON.stringify(err.response.data));
      else if (status === 404) alert("Register endpoint not found. Check backend routes.");
      else alert(err?.response?.data?.message || err.message || "Register failed");
    }
  };

  // ------------------ LOGOUT ------------------
  const handleLogout = () => {
    try {
      localStorage.removeItem("chatapp_auth_v1");
    } catch {}
    try {
      socket.disconnect();
    } catch {}
    setUser(null);
    setActiveRoom(null);
    setActiveUser(null);
    setRooms([]);
    setMessages([]);
  };

  // ------------------ LOAD ROOMS ------------------
  useEffect(() => {
    if (!user) return;
    const fetchRooms = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/rooms`); // all rooms
        setRooms(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchRooms();
  }, [user]);

  // ------------------ LOAD MESSAGES ------------------
  useEffect(() => {
    const fetchMessages = async () => {
      if (!user || (!activeUser && !activeRoom)) {
        setMessages([]);
        return;
      }
      setLoadingMessages(true);
      try {
        let res;
        if (activeUser) {
          res = await axios.get(`${API_BASE}/api/messages`, {
            params: { from: user._id, to: activeUser.userId },
          });
        } else if (activeRoom) {
          res = await axios.get(
            `${API_BASE}/api/messages/room/${activeRoom._id}`
          );
        }
        setMessages(res?.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingMessages(false);
      }
    };
    fetchMessages();
  }, [activeUser, activeRoom, user]);

  // ------------------ SEND MESSAGE ------------------
  const handleSendMessage = (e) => {
    e.preventDefault();
    const text = messageInput.trim();
    if (!text) return;

    if (activeUser) {
      // just emit; server will save and send back to both
      socket.emit("privateMessage", {
        toUserId: activeUser.userId,
        content: text,
      });
    } else if (activeRoom) {
      socket.emit("roomMessage", {
        roomId: activeRoom._id,
        content: text,
      });
    }

    // clear input; do NOT push to messages here
    setMessageInput("");
  };

  // ------------------ CREATE ROOM ------------------
  const handleCreateRoom = async () => {
    const trimmed = newRoomName.trim();
    if (!trimmed || !user) return;
    try {
      const res = await axios.post(`${API_BASE}/api/rooms`, {
        name: trimmed,
        members: [user._id],
      });
      setRooms((prev) => [...prev, res.data]);
      setNewRoomName("");
    } catch (err) {
      console.error(err);
      alert("Failed to create room");
    }
  };

  // ------------------ SELECT ROOM ------------------
  const handleSelectRoom = (room) => {
    setActiveUser(null);
    setActiveRoom(room);
  };

  // ------------------ SELECT USER ------------------
  const handleSelectUser = (u) => {
    if (u.userId === user._id) return;
    setActiveRoom(null);
    setActiveUser(u);
  };

  // ------------------ JOIN ROOM (SOCKET) ------------------
  useEffect(() => {
    if (activeRoom && socket.connected) {
      socket.emit("joinRoom", activeRoom._id);
    }
  }, [activeRoom]);

  const isLoggedIn = !!user;

  // ------------------ UI ------------------

  // Login UI – full screen
  if (!isLoggedIn) {
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
          onSubmit={handleLogin}
        >
          <Typography variant="h4" align="center" mb={1} color="primary">
            ChatApp 💬
          </Typography>
          <Typography
            variant="body1"
            align="center"
            mb={4}
            color="text.secondary"
          >
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
          <TextField
            label="Password (optional)"
            variant="outlined"
            fullWidth
            type="password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            margin="normal"
          />
          <Button
            type="submit"
            variant="contained"
            fullWidth
            sx={{ mt: 3, py: 1.5 }}
          >
            Enter Chat
          </Button>
        </Paper>
      </Box>
    );
  }

  // Logged-in full-screen layout
  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <AppBar position="static" color="primary" elevation={1}>
        <Toolbar sx={{ justifyContent: "space-between" }}>
          <Typography variant="h6" color="inherit">
            ChatApp
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Avatar sx={{ bgcolor: stringToColor(user.username) }}>
              {user.username.charAt(0).toUpperCase()}
            </Avatar>
            <Typography variant="body1" color="inherit">
              {user.username}
            </Typography>
            <IconButton color="inherit" onClick={handleLogout} aria-label="logout">
              <LogoutIcon />
            </IconButton>
          </Stack>
        </Toolbar>
      </AppBar>

      <Box sx={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* --- LEFT SIDEBAR --- */}
        <Box
          sx={{
            width: 300,
            borderRight: "1px solid",
            borderColor: "divider",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Rooms Section */}
          <Box sx={{ p: 2 }}>
            <Typography
              variant="overline"
              fontWeight={700}
              color="text.secondary"
            >
              Rooms
            </Typography>
            <List dense disablePadding sx={{ mt: 1 }}>
              {rooms.map((r) => {
                const selected = activeRoom?._id === r._id;
                return (
                  <ListItemButton
                    key={r._id}
                    selected={selected}
                    onClick={() => handleSelectRoom(r)}
                    sx={{
                      borderRadius: 1,
                      mb: 0.5,
                      "&.Mui-selected": {
                        bgcolor: "primary.light",
                        color: "primary.contrastText",
                        "& .MuiListItemText-primary": {
                          fontWeight: 600,
                        },
                      },
                    }}
                  >
                    <GroupIcon fontSize="small" sx={{ mr: 1, opacity: 0.8 }} />
                    <ListItemText
                      primary={r.name || "Unnamed room"}
                      primaryTypographyProps={{ color: "text.primary" }}
                    />
                  </ListItemButton>
                );
              })}
            </List>

            {/* New Room Input */}
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <TextField
                size="small"
                fullWidth
                placeholder="New room..."
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                variant="outlined"
              />
              <IconButton
                color="primary"
                onClick={handleCreateRoom}
                disabled={!newRoomName.trim()}
                size="small"
              >
                <AddIcon />
              </IconButton>
            </Stack>
          </Box>

          <Divider sx={{ mx: 2 }} />

          {/* Online Users Section */}
          <Box sx={{ p: 2, flex: 1, overflowY: "auto" }}>
            <Typography
              variant="overline"
              fontWeight={700}
              color="text.secondary"
            >
              Online Users
            </Typography>
            <List dense disablePadding sx={{ mt: 1 }}>
              {onlineUsers.map((u) => {
                const selected = activeUser?.userId === u.userId;
                const isMe = u.userId === user._id;

                return (
                  <ListItemButton
                    key={u.userId}
                    selected={selected}
                    disabled={isMe}
                    onClick={() => handleSelectUser(u)}
                    sx={{
                      borderRadius: 1,
                      mb: 0.5,
                      "&.Mui-selected": {
                        bgcolor: "primary.light",
                        color: "primary.contrastText",
                        "& .MuiListItemText-primary": {
                          fontWeight: 600,
                        },
                      },
                    }}
                  >
                    <Avatar
                      sx={{
                        width: 24,
                        height: 24,
                        mr: 1,
                        bgcolor: stringToColor(u.username),
                      }}
                    >
                      {u.username.charAt(0).toUpperCase()}
                    </Avatar>
                    <ListItemText
                      primary={u.username}
                      primaryTypographyProps={{ color: "text.primary" }}
                    />
                    {isMe && (
                      <Chip
                        label="You"
                        size="small"
                        color="primary"
                        variant="outlined"
                        sx={{ ml: 1, height: 18 }}
                      />
                    )}
                  </ListItemButton>
                );
              })}
            </List>
          </Box>
        </Box>

        {/* --- MAIN CHAT AREA --- */}
        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
          }}
        >
          {/* Chat Header */}
          <Box
            sx={{
              p: 2,
              borderBottom: "1px solid",
              borderColor: "divider",
              display: "flex",
              alignItems: "center",
              bgcolor: "background.paper",
            }}
          >
            {activeUser || activeRoom ? (
              <Stack direction="row" alignItems="center" spacing={2}>
                <Avatar
                  sx={{
                    bgcolor: stringToColor(
                      activeUser?.username || activeRoom?.name
                    ),
                  }}
                >
                  {(activeUser?.username || activeRoom?.name || "?")
                    .charAt(0)
                    .toUpperCase()}
                </Avatar>
                <Typography variant="h6" fontWeight={600} color="text.primary">
                  {activeUser ? activeUser.username : activeRoom.name}
                </Typography>
              </Stack>
            ) : (
              <Typography variant="h6" color="text.secondary">
                Select a room or user to start chatting 🚀
              </Typography>
            )}
          </Box>

          {/* Messages */}
          <Box
            sx={{
              flex: 1,
              overflowY: "auto",
              p: 3,
              backgroundImage:
                "linear-gradient(to top, rgba(0,0,0,0.02), transparent)",
            }}
          >
            {loadingMessages ? (
              <Box
                sx={{
                  height: "100%",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <CircularProgress size={24} sx={{ mr: 1 }} />
                <Typography color="text.secondary">
                  Loading messages...
                </Typography>
              </Box>
            ) : messages.length === 0 && (activeUser || activeRoom) ? (
              <Box
                sx={{
                  height: "100%",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Typography color="text.secondary">
                  No messages yet. Start the conversation! 💬
                </Typography>
              </Box>
            ) : (
              <Stack spacing={1.5}>
                {messages.map((msg) => {
                  const isMe = msg.from === user._id;
                  const time = new Date(msg.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  const senderName =
                    msg.fromUsername ||
                    (isMe ? user.username : activeUser?.username || "User");

                  return (
                    <Box
                      key={msg._id}
                      sx={{
                        display: "flex",
                        justifyContent: isMe ? "flex-end" : "flex-start",
                      }}
                    >
                      <Box
                        sx={{
                          maxWidth: "65%",
                          bgcolor: isMe ? "primary.light" : "background.paper",
                          borderRadius: isMe
                            ? "16px 16px 4px 16px"
                            : "16px 16px 16px 4px",
                          boxShadow: 1,
                          p: 1.5,
                        }}
                      >
                        {activeRoom && !isMe && (
                          <Typography
                            variant="caption"
                            fontWeight={700}
                            sx={{
                              color: stringToColor(senderName),
                              display: "block",
                              mb: 0.3,
                            }}
                          >
                            {senderName}
                          </Typography>
                        )}
                        <Typography variant="body1" color="text.primary">
                          {msg.content}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            float: "right",
                            mt: 0.5,
                            color: "text.secondary",
                            fontSize: "0.7rem",
                          }}
                        >
                          {time}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })}
                <div ref={messagesEndRef} />
              </Stack>
            )}
          </Box>

          {/* Input */}
          {(activeUser || activeRoom) && (
            <Box
              component="form"
              onSubmit={handleSendMessage}
              sx={{
                p: 2,
                borderTop: "1px solid",
                borderColor: "divider",
                bgcolor: "background.paper",
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  fullWidth
                  variant="outlined"
                  size="medium"
                  placeholder="Type a message..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  sx={{
                    "& fieldset": { borderRadius: 30 },
                  }}
                  autoFocus
                />
                <Button
                  type="submit"
                  variant="contained"
                  endIcon={<SendIcon />}
                  disabled={!messageInput.trim()}
                  sx={{
                    borderRadius: 30,
                    minWidth: 100,
                    px: 2,
                  }}
                >
                  Send
                </Button>
              </Stack>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}

export default App;