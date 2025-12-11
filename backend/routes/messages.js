// routes/messages.js
const express = require("express");
const Message = require("../models/Message");
const router = express.Router();
const auth = require("../middleware/auth");
// GET /api/messages?from=<id>&to=<id>
router.get("/",auth, async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: "from and to are required" });

    const messages = await Message.find({
      $or: [{ from, to }, { from: to, to: from }],
    })
      .sort({ createdAt: 1 })
      .lean();

    res.json(messages);
  } catch (err) {
    console.error("GET /api/messages error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET room messages: /api/messages/room/:roomId
router.get("/room/:roomId", async (req, res) => {
  try {
    const { roomId } = req.params;
    const messages = await Message.find({ room: roomId })
      .sort({ createdAt: 1 })
      .populate("from", "username")
      .lean();

    res.json(
      messages.map((msg) => ({
        _id: msg._id,
        content: msg.content,
        roomId: msg.room,
        from: msg.from._id,
        fromUsername: msg.from.username,
        createdAt: msg.createdAt,
      }))
    );
  } catch (err) {
    console.error("GET /api/messages/room/:roomId error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
