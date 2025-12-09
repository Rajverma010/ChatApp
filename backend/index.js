require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");

// Models
const User = require("./models/user");
const Message = require("./models/message");
const Room = require("./models/room");

const authRoutes = require("./routes/auth");
const authMiddleware = require("./middleware/auth");

const app = express();
const server = http.createServer(app);

/* CORS */
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
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

/* MONGO */
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/chatapp";

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("MongoDB connected →", MONGO_URI))
  .catch((err) => console.error("MongoDB error:", err));

/* AUTH ROUTES */
app.use("/api/auth", authRoutes);

/* PROTECTED / PUBLIC API EXAMPLES */
// If you want to protect messages route, add authMiddleware as shown
// Example: protect private messages route
app.get("/api/messages", authMiddleware, async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to)
      return res.status(400).json({ error: "from & to required" });

    // Optionally ensure req.user.userId equals `from` or that user is allowed
    if (req.user.userId !== from && req.user.userId !== to) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const messages = await Message.find({
      $or: [{ from, to }, { from: to, to: from }],
    }).sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    console.error("GET /api/messages error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Room messages can be protected similarly:
app.get("/api/messages/room/:roomId", authMiddleware, async (req, res) => {
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

/* Room creation - protect */
app.post("/api/rooms", authMiddleware, async (req, res) => {
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

app.get("/api/rooms", authMiddleware, async (req, res) => {
  try {
    const rooms = await Room.find().lean();
    res.json(rooms);
  } catch (err) {
    console.error("GET /api/rooms error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* SOCKET.IO */
const io = new Server(server, {
  cors: corsOptions,
});

// map userId -> socketId
const onlineUsers = new Map();

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

// Socket auth via token in handshake auth: { token: "..." }
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token) return next(new Error("Authentication error: token required"));

    const payload = jwt.verify(token, JWT_SECRET);
    socket.userId = payload.userId;
    socket.username = payload.username;
    return next();
  } catch (err) {
    console.error("Socket auth error:", err);
    return next(new Error("Authentication error"));
  }
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.username);

  onlineUsers.set(socket.userId, socket.id);
  broadcastOnlineUsers();

  // PRIVATE MESSAGE
  socket.on("privateMessage", async ({ toUserId, content }) => {
    if (!content || !content.trim()) return;
    try {
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
    } catch (err) {
      console.error("privateMessage error:", err);
    }
  });

  // ROOM MESSAGE
  socket.on("roomMessage", async ({ roomId, content }) => {
    if (!content || !content.trim()) return;
    try {
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
    } catch (err) {
      console.error("roomMessage error:", err);
    }
  });

  socket.on("joinRoom", (roomId) => {
    socket.join(roomId);
  });

  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.username);
    onlineUsers.delete(socket.userId);
    broadcastOnlineUsers();
  });
});

function broadcastOnlineUsers() {
  const list = [];

  for (const [userId, socketId] of onlineUsers.entries()) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) list.push({ userId, username: socket.username });
  }

  io.emit("onlineUsers", list);
}

/* START SERVER */
const PORT = process.env.PORT || 4000;
server.listen(PORT, () =>
  console.log(`Server running at http://localhost:${PORT}`)
);
