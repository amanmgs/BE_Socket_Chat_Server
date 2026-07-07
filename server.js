const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
require("./db");
const Message = require("./models/Message");
const User = require("./models/User");

const app = express();

app.use(cors());

const server = http.createServer(app);

// Store all messages in memory
// const messages = [];

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

async function broadcastUsers(excludeUsername = null) {
  const users = await User.find().sort({ username: 1 });

  io.emit("online_users", users);
}

io.on("connection", (socket) => {
  console.log("Connected :", socket.id);

  // ==========================
  // Register User
  // ==========================
  socket.on("register", async ({ name, deviceId }) => {
    try {
      socket.username = name;

      // Create if doesn't exist, otherwise update
      const user = await User.findOneAndUpdate(
        { username: name, deviceId },
        {
          username: name,
          deviceId,
          socketId: socket.id,
          online: true,
          lastSeen: new Date(),
        },
        {
          upsert: true,
          new: true,
        },
      );

      console.log("User:", user);

      await broadcastUsers(name);
    } catch (err) {
      console.log(err);
    }
  });

  // ==========================
  // Typing
  // ==========================
  socket.on("typing", async ({ from, to }) => {
    try {
      const receiver = await User.findOne({ username: to });

      if (receiver?.socketId) {
        io.to(receiver.socketId).emit("typing", {
          from,
        });
      }
    } catch (err) {
      console.log(err);
    }
  });

  // ==========================
  // Send Message
  // ==========================
  socket.on("private_message", async (data) => {
    try {
      const receiver = await User.findOne({
        username: data.to,
      });

      const delivered = !!receiver?.socketId;

      const message = await Message.create({
        from: data.from,
        to: data.to,
        message: data.message,
        delivered,
        read: false,
      });

      socket.emit("private_message", message);

      if (receiver?.socketId) {
        io.to(receiver.socketId).emit("private_message", message);
      }
    } catch (err) {
      console.log(err);
    }
  });

  // ==========================
  // Chat History
  // ==========================
  socket.on("get_messages", async ({ from, to }) => {
    try {
      const history = await Message.find({
        $or: [
          {
            from,
            to,
          },

          {
            from: to,
            to: from,
          },
        ],
      }).sort({
        createdAt: 1,
      });

      socket.emit("chat_history", history);
    } catch (err) {
      console.log(err);
    }
  });

  // ==========================
  // Read Receipt
  // ==========================
  socket.on("read_message", async ({ messageId, from }) => {
    try {
      await Message.findByIdAndUpdate(messageId, {
        read: true,
      });

      const sender = await User.findOne({
        username: from,
      });

      if (sender?.socketId) {
        io.to(sender.socketId).emit("message_read", {
          messageId,
        });
      }
    } catch (err) {
      console.log(err);
    }
  });

  // ==========================
  // Disconnect
  // ==========================
  socket.on("disconnect", async () => {
    try {
      if (!socket.username) return;

      await User.findOneAndUpdate(
        { username: socket.username },
        {
          online: false,
          socketId: "",
          lastSeen: new Date(),
        },
      );

      await broadcastUsers(socket.username);

      console.log(socket.username + " is offline");
    } catch (err) {
      console.log(err);
    }
  });
});

server.listen(3000, () => {
  console.log("🚀 Server running on port 3000");
});
