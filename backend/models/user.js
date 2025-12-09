// backend/models/user.js
const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    createdAt: { type: Date, default: Date.now }
  },
  { collection: "users" }
);

module.exports = mongoose.model("User", UserSchema);
