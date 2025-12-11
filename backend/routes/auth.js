// routes/auth.js
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { v4: uuidv4 } = require("uuid");
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "15m";
const REFRESH_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || "30", 10);
const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || "10", 10);

// helper: generate tokens
function createAccessToken(user) {
  return jwt.sign({ userId: user._id, username: user.username }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function createRefreshToken() {
  return uuidv4(); // opaque token stored server-side
}

// register
router.post("/register", async (req, res) => {
  try {
    const { username, password, rememberMe } = req.body;
    if (!username || !password) return res.status(400).json({ error: "username and password required" });

    const existing = await User.findOne({ username });
    if (existing) return res.status(409).json({ error: "username taken" });

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await User.create({ username, passwordHash, refreshTokens: [] });

    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshToken();

    // store refresh token in DB
    user.refreshTokens.push({ token: refreshToken, createdAt: new Date() });
    await user.save();

    // set cookie (HttpOnly)
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: REFRESH_DAYS * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({ token: accessToken, user: { _id: user._id, username: user.username } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// login
router.post("/login", async (req, res) => {
  try {
    const { username, password, rememberMe } = req.body;
    if (!username || !password) return res.status(400).json({ error: "username and password required" });

    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshToken();

    // store refresh token
    user.refreshTokens.push({ token: refreshToken, createdAt: new Date() });
    await user.save();

    // cookie options: longer if rememberMe
    const cookieMax = (rememberMe ? REFRESH_DAYS : 1) * 24 * 60 * 60 * 1000; // 1 day if not remember
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: cookieMax,
    });

    res.json({ token: accessToken, user: { _id: user._id, username: user.username } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// refresh (uses cookie)
router.post("/refresh", async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) return res.status(401).json({ error: "No refresh token" });

    // find user who has this refresh token
    const user = await User.findOne({ "refreshTokens.token": refreshToken });
    if (!user) {
      // token not valid
      res.clearCookie("refreshToken");
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    // rotate: remove the used refresh token and issue a new one
    user.refreshTokens = user.refreshTokens.filter((r) => r.token !== refreshToken);
    const newRefreshToken = createRefreshToken();
    user.refreshTokens.push({ token: newRefreshToken, createdAt: new Date() });
    await user.save();

    // issue new access token
    const accessToken = createAccessToken(user);

    // set cookie with rotated token
    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: REFRESH_DAYS * 24 * 60 * 60 * 1000,
    });

    res.json({ token: accessToken, user: { _id: user._id, username: user.username } });
  } catch (err) {
    console.error("refresh error", err);
    res.status(500).json({ error: "Server error" });
  }
});

// logout: remove refresh token cookie and remove it from DB
router.post("/logout", async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
      await User.updateOne({}, { $pull: { refreshTokens: { token: refreshToken } } });
    }
    res.clearCookie("refreshToken");
    res.json({ ok: true });
  } catch (err) {
    console.error("logout error", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
