// backend/socket.js
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const Message = require("./models/Message");
const Room = require("./models/Room");
const User = require("./models/User");

const JWT_SECRET = process.env.JWT_SECRET;

function initSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // Map userId -> Set(socketId)
  const userSockets = new Map();

  function addSocketForUser(userId, socketId) {
    const set = userSockets.get(userId) || new Set();
    set.add(socketId);
    userSockets.set(userId, set);
  }

  function removeSocketForUser(userId, socketId) {
    const set = userSockets.get(userId);
    if (!set) return;
    set.delete(socketId);
    if (set.size === 0) userSockets.delete(userId);
    else userSockets.set(userId, set);
  }

  function getOnlineUsersList() {
    const list = [];
    for (const [userId, sockets] of userSockets.entries()) {
      let username = "User";
      for (const sid of sockets) {
        const s = io.sockets.sockets.get(sid);
        if (s?.username) {
          username = s.username;
          break;
        }
      }
      list.push({ userId, username });
    }
    return list;
  }

  // Authenticate socket with JWT present in handshake.auth.token
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Authentication token required"));

      const payload = jwt.verify(token, JWT_SECRET);
      socket.userId = payload.userId;
      socket.username = payload.username;
      return next();
    } catch (err) {
      console.warn("Socket auth failed:", err.message);
      return next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    // Track socket
    addSocketForUser(socket.userId.toString(), socket.id);
    // Join a dedicated private-room for this userId so we can do io.to(userId)
    socket.join(socket.userId.toString());

    // Broadcast unique online users
    io.emit("onlineUsers", getOnlineUsersList());

    console.log("Socket connected:", socket.id, "user:", socket.username, socket.userId);

    // Client asks to join a chat room (roomId should be string/objectId)
    socket.on("joinRoom", (roomId) => {
      if (!roomId) return;
      socket.join(roomId.toString());
      console.log(`${socket.username} joined room ${roomId}`);
    });

    // Private message -> save + emit to both sender and recipient's rooms
    socket.on("privateMessage", async ({ toUserId, content }) => {
      try {
        if (!toUserId || !content?.trim()) return;

        const msg = await Message.create({
          from: socket.userId,
          to: toUserId,
          content,
        });

        const payload = {
          _id: msg._id,
          from: msg.from.toString(),
          to: msg.to ? msg.to.toString() : null,
          content: msg.content,
          fromUsername: socket.username,
          createdAt: msg.createdAt,
        };

        // Emit to all sockets of recipient and to sender
        io.to(toUserId.toString()).emit("privateMessage", payload);
        io.to(socket.userId.toString()).emit("privateMessage", payload);
      } catch (err) {
        console.error("privateMessage error:", err);
      }
    });

    // Room message -> save + broadcast to the socket.io room
    socket.on("roomMessage", async ({ roomId, content }) => {
      try {
        if (!roomId || !content?.trim()) return;

        const msg = await Message.create({
          from: socket.userId,
          room: roomId,
          content,
        });

        const payload = {
          _id: msg._id,
          from: msg.from.toString(),
          fromUsername: socket.username,
          content: msg.content,
          roomId: roomId.toString(),
          createdAt: msg.createdAt,
        };

        // Only emit to sockets that joined this room
        io.to(roomId.toString()).emit("roomMessage", payload);
      } catch (err) {
        console.error("roomMessage error:", err);
      }
    });

    socket.on("disconnect", () => {
      removeSocketForUser(socket.userId.toString(), socket.id);
      io.emit("onlineUsers", getOnlineUsersList());
      console.log("Socket disconnected:", socket.id, "user:", socket.username);
    });
  });

  return io;
}

module.exports = { initSocket };
  