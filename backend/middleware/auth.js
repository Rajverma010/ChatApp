// middleware/auth.js
const jwt = require("jsonwebtoken");
const User = require("../models/user");

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

async function auth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer "))
      return res.status(401).json({ error: "Authorization required" });

    const token = authHeader.split(" ")[1];
    const payload = jwt.verify(token, JWT_SECRET);
    // attach user info to request
    req.user = { userId: payload.userId, username: payload.username };

    // Optional: fetch full user from DB if you need fields
    // req.userDoc = await User.findById(payload.userId).select("-password");

    next();
  } catch (err) {
    console.error("auth middleware error:", err);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

module.exports = auth;
