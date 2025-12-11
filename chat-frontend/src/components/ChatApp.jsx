// src/components/ChatApp.jsx
import React, { useEffect, useState } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Stack,
  Avatar,
  Button,
} from "@mui/material";
import ChatWindow from "./ChatWindow";
import Sidebar from "./Sidebar";
import AuthForm from "./AuthForm";
import api, { setAuthToken, getStoredToken } from "../api/api";
import { socket, connectSocketWithToken, disconnectSocket } from "../api/socket";
import { stringToColor } from "../utils/stringToColor";

export default function ChatApp() {
  // auth state
  const [user, setUser] = useState(null);
  // other chat states (rooms, messages, etc.)
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [activeUser, setActiveUser] = useState(null);
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [newRoomName, setNewRoomName] = useState("");

  // ---------- restore session on mount ----------
  useEffect(() => {
    const token = getStoredToken();
    const storedUser = localStorage.getItem("user");
    if (token && storedUser) {
      try {
        setAuthToken(token); // sets axios header and localStorage (idempotent)
        const userObj = JSON.parse(storedUser);
        setUser(userObj);
        // connect socket with token
        connectSocketWithToken(token);
      } catch (err) {
        console.warn("Session restore failed", err);
        // clear bad data
        setAuthToken(null);
        localStorage.removeItem("user");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- socket setup ----------
  useEffect(() => {
    if (!user) return;

    // listen to online users list
    socket.on("onlineUsers", setOnlineUsers);

    // private messages
    socket.on("privateMessage", (msg) => {
      if (
        (msg.from === user._id && msg.to === activeUser?.userId) ||
        (msg.to === user._id && msg.from === activeUser?.userId)
      ) {
        setMessages((prev) => [...prev, msg]);
      }
    });

    // room messages
    socket.on("roomMessage", (msg) => {
      if (msg.roomId === activeRoom?._id) {
        setMessages((prev) => [...prev, msg]);
      }
    });

    return () => {
      socket.off("onlineUsers", setOnlineUsers);
      socket.off("privateMessage");
      socket.off("roomMessage");
      // do NOT disconnect here (we want session persist across UI mounts).
    };
  }, [user, activeUser, activeRoom]);

  // ---------- handle auth success (from AuthForm) ----------
  const handleAuthSuccess = (userObj, token) => {
    // store user
    setUser(userObj);
    localStorage.setItem("user", JSON.stringify(userObj));
    // axios header already set by AuthForm via setAuthToken
    // socket connected by AuthForm via connectSocketWithToken
    // Optionally load initial data (rooms)
    loadRooms(userObj);
  };

  // ---------- logout ----------
  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("user");
    setAuthToken(null);
    disconnectSocket();
    // reset chat state
    setActiveRoom(null);
    setActiveUser(null);
    setMessages([]);
    setRooms([]);
    setOnlineUsers([]);
  };

  // ---------- load rooms ----------
  const loadRooms = async (maybeUser = user) => {
    if (!maybeUser) return;
    try {
      const res = await api.get("/api/rooms");
      setRooms(res.data);
    } catch (err) {
      console.error("Failed to load rooms", err);
    }
  };

  // call loadRooms when user logs in
  useEffect(() => {
    if (user) loadRooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ---------- messages load ----------
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
          res = await api.get("/api/messages", { params: { from: user._id, to: activeUser.userId } });
        } else if (activeRoom) {
          res = await api.get(`/api/messages/room/${activeRoom._id}`);
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

  // ---------- send message ----------
  const handleSendMessage = (e) => {
    e.preventDefault();
    const text = messageInput.trim();
    if (!text) return;

    if (activeUser) {
      socket.emit("privateMessage", { toUserId: activeUser.userId, content: text });
    } else if (activeRoom) {
      socket.emit("roomMessage", { roomId: activeRoom._id, content: text });
    }

    setMessageInput("");
  };

  // ---------- room create ----------
  const handleCreateRoom = async () => {
    const trimmed = newRoomName.trim();
    if (!trimmed || !user) return;
    try {
      const res = await api.post("/api/rooms", { name: trimmed, members: [user._id] });
      setRooms((prev) => [...prev, res.data]);
      setNewRoomName("");
    } catch (err) {
      console.error(err);
      alert("Failed to create room");
    }
  };

  // ---------- select handlers ----------
  const handleSelectRoom = (room) => {
    setActiveUser(null);
    setActiveRoom(room);
  };

  const handleSelectUser = (u) => {
    if (u.userId === user._id) return;
    setActiveRoom(null);
    setActiveUser(u);
  };

  // join room via socket when activeRoom changes
  useEffect(() => {
    if (activeRoom) {
      socket.emit("joinRoom", activeRoom._id);
    }
  }, [activeRoom]);

  // ---------- render ----------
  if (!user) {
    return <AuthForm onAuthSuccess={handleAuthSuccess} />;
  }

  // Logged-in UI
  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <AppBar position="static" color="primary" elevation={1}>
        <Toolbar sx={{ justifyContent: "space-between" }}>
          <Typography variant="h6" color="inherit">ChatApp</Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Avatar sx={{ bgcolor: stringToColor(user.username) }}>{user.username.charAt(0).toUpperCase()}</Avatar>
            <Typography variant="body1" color="inherit">{user.username}</Typography>
            <Button color="inherit" onClick={handleLogout}>Logout</Button>
          </Stack>
        </Toolbar>
      </AppBar>

      <Box sx={{ display: "flex", flex: 1, minHeight: 0 }}>
        <Sidebar
          user={user}
          rooms={rooms}
          newRoomName={newRoomName}
          setNewRoomName={setNewRoomName}
          onCreateRoom={handleCreateRoom}
          onlineUsers={onlineUsers}
          activeRoom={activeRoom}
          activeUser={activeUser}
          onSelectRoom={handleSelectRoom}
          onSelectUser={handleSelectUser}
        />

        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <ChatWindow
            user={user}
            activeRoom={activeRoom}
            activeUser={activeUser}
            messages={messages}
            loadingMessages={loadingMessages}
            messageInput={messageInput}
            setMessageInput={setMessageInput}
            onSendMessage={handleSendMessage}
          />
        </Box>
      </Box>
    </Box>
  );
}
