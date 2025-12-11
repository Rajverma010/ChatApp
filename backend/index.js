// index.js
require("dotenv").config();
const http = require("http");
const mongoose = require("mongoose");
const app = require("./app");
const { initSocket } = require("./socket");

const PORT = process.env.PORT || 4000;

const server = http.createServer(app);

// initialize socket.io and attach to server
const io = initSocket(server);

// --- Connect to MongoDB ---
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => {
    console.error("MongoDB error:", err);
    process.exit(1);
  });

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
