// backend/index.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
const User = require("./models/user");
const Message = require("./models/message");
const Room = require("./models/room"); // New model for rooms

const app = express();
const server = http.createServer(app);

// Adjust origin to match your React dev server
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

// --- MongoDB connection ---
mongoose
  .connect("mongodb://127.0.0.1:27017/chatapp")
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB error:", err));

// --- User register/login ---
app.post("/api/users", async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: "Username required" });

    let user = await User.findOne({ username });
    if (!user) user = await User.create({ username });

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// --- Get conversation between two users ---
app.get("/api/messages", async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: "from and to are required" });

    const messages = await Message.find({
      $or: [
        { from, to },
        { from: to, to: from },
      ],
    })
      .sort({ createdAt: 1 })
      .lean();

    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// --- Get messages for a room ---
app.get("/api/messages/room/:roomId", async (req, res) => {
  try {
    const { roomId } = req.params;
    const messages = await Message.find({ room: roomId })
      .sort({ createdAt: 1 })
      .populate("from", "username")
      .lean();
    res.json(messages.map(msg => ({
      _id: msg._id,
      content: msg.content,
      roomId: msg.room,
      from: msg.from._id,
      fromUsername: msg.from.username,
      createdAt: msg.createdAt
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// --- Create a new room ---
app.post("/api/rooms", async (req, res) => {
  try {
    const { name, members } = req.body;
    if (!name) return res.status(400).json({ error: "Room name required" });
    const room = await Room.create({ name, members });
    res.json(room);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// --- List all rooms for a user ---
app.get("/api/rooms", async (req, res) => {
  try {
    const { userId } = req.query;
    const rooms = await Room.find({ members: userId }).lean();
    res.json(rooms);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// --- Online users store ---
const onlineUsers = new Map(); // userId -> socketId
const socketsToUsers = new Map(); // socketId -> userId

// Socket auth
io.use((socket, next) => {
  const { userId, username } = socket.handshake.auth || {};
  if (!userId || !username) return next(new Error("Invalid auth"));
  socket.userId = userId;
  socket.username = username;
  next();
});

// Socket events
io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id, "userId:", socket.userId);

  onlineUsers.set(socket.userId, socket.id);
  socketsToUsers.set(socket.id, socket.userId);

  broadcastOnlineUsers();

  // --- Private message ---
  socket.on("privateMessage", async ({ toUserId, content }) => {
    if (!toUserId || !content?.trim()) return;

    try {
      const msg = await Message.create({
        from: socket.userId,
        to: toUserId,
        content,
      });
      const populatedMsg = await msg.populate("from to", "username");
      const payload = {
        _id: populatedMsg._id,
        from: populatedMsg.from._id,
        to: populatedMsg.to._id,
        fromUsername: populatedMsg.from.username,
        toUsername: populatedMsg.to.username,
        content: populatedMsg.content,
        createdAt: populatedMsg.createdAt,
      };

      socket.emit("privateMessage", payload);
      const receiverSocketId = onlineUsers.get(toUserId);
      if (receiverSocketId) io.to(receiverSocketId).emit("privateMessage", payload);
    } catch (err) {
      console.error(err);
    }
  });

  // --- Room message ---
  socket.on("roomMessage", async ({ roomId, content }) => {
    if (!roomId || !content?.trim()) return;

    try {
      const msg = await Message.create({
        from: socket.userId,
        room: roomId,
        content,
      });
      const populatedMsg = await msg.populate("from", "username");
      const payload = {
        _id: populatedMsg._id,
        from: populatedMsg.from._id,
        fromUsername: populatedMsg.from.username,
        content: populatedMsg.content,
        roomId,
        createdAt: populatedMsg.createdAt,
      };
      io.to(roomId).emit("roomMessage", payload); // emit to room
    } catch (err) {
      console.error(err);
    }
  });

  // --- Join a room ---
  socket.on("joinRoom", (roomId) => {
    socket.join(roomId);
    console.log(`${socket.username} joined room ${roomId}`);
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
    const userId = socketsToUsers.get(socket.id);
    if (userId) {
      onlineUsers.delete(userId);
      socketsToUsers.delete(socket.id);
      broadcastOnlineUsers();
    }
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

const PORT = 4000;
server.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
