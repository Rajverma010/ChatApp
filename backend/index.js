// backend/index.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
const User = require("./models/user");
const Message = require("./models/message");

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


// --- Simple user register/login by username ---
// If username exists, return existing user. Otherwise create new.
app.post("/api/users", async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: "Username required" });

    let user = await User.findOne({ username });
    if (!user) {
      user = await User.create({ username });
    }

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
    if (!from || !to) {
      return res.status(400).json({ error: "from and to are required" });
    }

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

// --- Online users store (in memory) ---
const onlineUsers = new Map(); // userId -> socketId
const socketsToUsers = new Map(); // socketId -> userId

// Attach auth (userId, username) to socket
io.use((socket, next) => {
  const { userId, username } = socket.handshake.auth || {};
  if (!userId || !username) {
    return next(new Error("Invalid auth"));
  }
  socket.userId = userId;
  socket.username = username;
  next();
});

// --- Socket.IO events ---
io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id, "userId:", socket.userId);

  // Mark user online
  onlineUsers.set(socket.userId, socket.id);
  socketsToUsers.set(socket.id, socket.userId);

  // Broadcast updated online users list
  broadcastOnlineUsers();

  // Handle private messages
  socket.on("privateMessage", async ({ toUserId, content }) => {
    if (!toUserId || !content?.trim()) return;

    try {
      // Save to DB
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

      // Send to sender
      socket.emit("privateMessage", payload);

      // Send to receiver if online
      const receiverSocketId = onlineUsers.get(toUserId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("privateMessage", payload);
      }
    } catch (err) {
      console.error("Error saving message:", err);
    }
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
  // Convert Map to array of { userId, username }
  const list = [];
  for (const [userId, socketId] of onlineUsers.entries()) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      list.push({
        userId,
        username: socket.username,
      });
    }
  }
  io.emit("onlineUsers", list);
}

const PORT = 4000;
server.listen(PORT, () => {
  console.log("Server listening on http://localhost:" + PORT);
});
