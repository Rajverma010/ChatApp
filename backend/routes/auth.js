// routes/auth.js
const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();

const User = require("../models/user");

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

function signToken(user) {
  return jwt.sign(
    { userId: user._id.toString(), username: user.username },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// Register
router.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: "username & password required" });

    const existing = await User.findOne({ username });
    if (existing)
      return res.status(400).json({ error: "username already taken" });

    const user = await User.create({ username, password });

    const token = signToken(user);
    res.json({ user: { _id: user._id, username: user.username }, token });
  } catch (err) {
    console.error("POST /api/auth/register error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: "username & password required" });

    const user = await User.findOne({ username });
    if (!user)
      return res.status(401).json({ error: "Invalid username or password" });

    const ok = await user.comparePassword(password);
    if (!ok)
      return res.status(401).json({ error: "Invalid username or password" });

    const token = signToken(user);
    res.json({ user: { _id: user._id, username: user.username }, token });
  } catch (err) {
    console.error("POST /api/auth/login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
