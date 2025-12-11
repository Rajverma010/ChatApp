// routes/rooms.js
const express = require("express");
const Room = require("../models/Room");
const router = express.Router();

// GET /api/rooms
router.get("/", async (req, res) => {
  try {
    const rooms = await Room.find().lean();
    res.json(rooms);
  } catch (err) {
    console.error("GET /api/rooms error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/rooms
router.post("/", async (req, res) => {
  try {
    const { name, members } = req.body;
    if (!name) return res.status(400).json({ error: "Room name required" });

    const room = await Room.create({ name, members: members || [] });
    res.status(201).json(room);
  } catch (err) {
    console.error("POST /api/rooms error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
