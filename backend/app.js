// app.js
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const usersRouter = require("./routes/users");
const messagesRouter = require("./routes/messages");
const roomsRouter = require("./routes/rooms");
const authRouter = require("./routes/auth");
const app = express();

app.use(express.json());
app.use(cookieParser());
// CORS — allow your frontend origin
const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  credentials: true,
}));

// API routes
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/messages", messagesRouter);
app.use("/api/rooms", roomsRouter);
app.use("/api/auth", authRouter);
app.get("/", (req, res) => {
  res.json({ ok: true, message: "Chat backend" });
});

module.exports = app;
