// routes/users.js
const express = require("express");
const User = require("../models/User");
const router = express.Router();

// Create or return user (POST /api/users)
router.post("/", async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: "Username required" });

    let user = await User.findOne({ username });
    if (!user) user = await User.create({ username });

    res.json(user);
  } catch (err) {
    console.error("POST /api/users error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
