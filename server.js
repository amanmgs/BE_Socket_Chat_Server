const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
require("./db");
const Message = require("./models/Message");

const app = express();

app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// username -> socket.id
const users = {};

// Store all messages in memory
const messages = [];

io.on("connection", (socket) => {
  console.log("Connected :", socket.id);

  // ==========================
  // Register User
  // ==========================
  socket.on("register", (username) => {
    socket.username = username;

    users[username] = socket.id;

    console.log("Online Users:", users);

    io.emit("online_users", Object.keys(users));
  });

  // ==========================
  // Typing
  // ==========================
  socket.on("typing", ({ from, to }) => {
    const receiverSocket = users[to];

    if (receiverSocket) {
      io.to(receiverSocket).emit("typing", {
        from,
      });
    }
  });

  // ==========================
  // Send Message
  // ==========================
  socket.on("private_message", async (data) => {
    try {
      const receiverSocket = users[data.to];

      const message = await Message.create({
        from: data.from,
        to: data.to,
        message: data.message,
        delivered: !!receiverSocket,
        read: false,
      });

      socket.emit("private_message", message);

      if (receiverSocket) {
        io.to(receiverSocket).emit("private_message", message);
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

      const senderSocket = users[from];

      if (senderSocket) {
        io.to(senderSocket).emit("message_read", {
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
  socket.on("disconnect", () => {
    console.log("Disconnected :", socket.id);

    if (socket.username) {
      delete users[socket.username];
    }

    io.emit("online_users", Object.keys(users));
  });
});

server.listen(3000, () => {
  console.log("🚀 Server running on port 3000");
});
