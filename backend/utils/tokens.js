// models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  refreshTokens: [{ token: String, createdAt: Date }],
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
