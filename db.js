console.log("Loading db.js...");

const mongoose = require("mongoose");

const MONGO_URI = "mongodb://127.0.0.1:27017/chatapp";

mongoose.connection.on("connected", () => {
  console.log("✅ MongoDB Connected");
});

mongoose.connection.on("error", (err) => {
  console.log("❌ MongoDB Error:", err);
});

mongoose.connection.on("disconnected", () => {
  console.log("⚠️ MongoDB Disconnected");
});

mongoose.connect(MONGO_URI);

module.exports = mongoose;