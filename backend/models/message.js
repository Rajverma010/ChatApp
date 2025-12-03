const mongoose = require("mongoose");
const messageSchema = new mongoose.Schema({
  from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  to: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // for private messages
  room: { type: mongoose.Schema.Types.ObjectId, ref: "Room" }, // for room messages
  content: { type: String, required: true },
}, { timestamps: true });
module.exports = mongoose.model("Message", messageSchema);
