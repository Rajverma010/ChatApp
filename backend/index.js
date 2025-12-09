// backend/index.js
require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");

// Models
const User = require("./models/user");
const Message = require("./models/message");
const Room = require("./models/room");

const app = express();
const server = http.createServer(app);

/* ---------------------------------------------
   CORS CONFIG — FIXES 5173 / 5174 / 5175 ISSUES
--------------------------------------------- */
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // allow backend tools
    if (
      origin.startsWith("http://localhost") ||
      origin.startsWith("http://127.0.0.1")
    ) {
      return callback(null, true);
    }
    return callback(new Error("CORS not allowed: " + origin));
  },
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

/* ---------------------------------------------
   SOCKET.IO WITH SAME CORS SETTINGS
--------------------------------------------- */
const io = new Server(server, {
  cors: corsOptions,
});

/* ---------------------------------------------
   MONGODB CONNECTION (Compass Compatible)
--------------------------------------------- */

// Works with Compass: ensure Compass uses the SAME URI!
// If no .env, defaults to local MongoDB
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/chatapp";

mongoose
  .connect(MONGO_URI)
  .then(() =>
    console.log("MongoDB connected →", MONGO_URI)
  )
  .catch((err) => console.error("MongoDB error:", err));

/* ---------------------------------------------
   USERS (login or auto-create)
--------------------------------------------- */
app.post("/api/users", async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: "Username required" });

    let user = await User.findOne({ username });

    if (!user) {
      user = await User.create({ username });
      console.log("New user created:", user.username);
    } else {
      console.log("User logged in:", user.username);
    }

    res.json(user);
  } catch (err) {
    console.error("POST /api/users error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ---------------------------------------------
   FETCH PRIVATE MESSAGES
--------------------------------------------- */
app.get("/api/messages", async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to)
      return res.status(400).json({ error: "from & to required" });

    const messages = await Message.find({
      $or: [{ from, to }, { from: to, to: from }],
    }).sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    console.error("GET /api/messages error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ---------------------------------------------
   FETCH ROOM MESSAGES
--------------------------------------------- */
app.get("/api/messages/room/:roomId", async (req, res) => {
  try {
    const { roomId } = req.params;

    const messages = await Message.find({ room: roomId })
      .sort({ createdAt: 1 })
      .populate("from", "username");

    res.json(
      messages.map((msg) => ({
        _id: msg._id,
        content: msg.content,
        roomId,
        from: msg.from._id,
        fromUsername: msg.from.username,
        createdAt: msg.createdAt,
      }))
    );
  } catch (err) {
    console.error("GET room messages error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ---------------------------------------------
   CREATE ROOM
--------------------------------------------- */
app.post("/api/rooms", async (req, res) => {
  try {
    const { name, members } = req.body;
    if (!name) return res.status(400).json({ error: "Room name required" });

    const room = await Room.create({ name, members: members || [] });

    res.json(room);
  } catch (err) {
    console.error("POST /api/rooms error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ---------------------------------------------
   GET ALL ROOMS
--------------------------------------------- */
app.get("/api/rooms", async (req, res) => {
  try {
    const rooms = await Room.find().lean();
    res.json(rooms);
  } catch (err) {
    console.error("GET /api/rooms error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ---------------------------------------------
   SOCKET.IO AUTH STORAGE
--------------------------------------------- */
const onlineUsers = new Map(); // userId → socketId

io.use((socket, next) => {
  const { userId, username } = socket.handshake.auth;
  if (!userId || !username)
    return next(new Error("Invalid socket auth"));

  socket.userId = userId;
  socket.username = username;
  next();
});

/* ---------------------------------------------
   SOCKET.IO EVENTS
--------------------------------------------- */
io.on("connection", (socket) => {
  console.log("User connected:", socket.username);

  onlineUsers.set(socket.userId, socket.id);

  broadcastOnlineUsers();

  // PRIVATE MESSAGE
  socket.on("privateMessage", async ({ toUserId, content }) => {
    if (!content.trim()) return;

    const msg = await Message.create({
      from: socket.userId,
      to: toUserId,
      content,
    });

    const payload = {
      _id: msg._id,
      from: socket.userId,
      to: toUserId,
      content: msg.content,
      createdAt: msg.createdAt,
    };

    socket.emit("privateMessage", payload);

    if (onlineUsers.has(toUserId)) {
      io.to(onlineUsers.get(toUserId)).emit("privateMessage", payload);
    }
  });

  // ROOM MESSAGE
  socket.on("roomMessage", async ({ roomId, content }) => {
    if (!content.trim()) return;

    const msg = await Message.create({
      from: socket.userId,
      room: roomId,
      content,
    });

    const payload = {
      _id: msg._id,
      from: socket.userId,
      content: msg.content,
      roomId,
      createdAt: msg.createdAt,
    };

    io.to(roomId).emit("roomMessage", payload);
  });

  // JOIN ROOM
  socket.on("joinRoom", (roomId) => {
    socket.join(roomId);
  });

  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.username);
    onlineUsers.delete(socket.userId);
    broadcastOnlineUsers();
  });
});

/* ---------------------------------------------
   BROADCAST ONLINE USERS
--------------------------------------------- */
function broadcastOnlineUsers() {
  const list = [];

  for (const [userId, socketId] of onlineUsers.entries()) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) list.push({ userId, username: socket.username });
  }

  io.emit("onlineUsers", list);
}

/* ---------------------------------------------
   START SERVER
--------------------------------------------- */
const PORT = process.env.PORT || 4000;
server.listen(PORT, () =>
  console.log(`Server running at http://localhost:${PORT}`)
);
