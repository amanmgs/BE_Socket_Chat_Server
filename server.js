const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

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

io.on("connection", (socket) => {
  console.log("Connected :", socket.id);

  // Register username
  socket.on("register", (username) => {
    users[username] = socket.id;

    io.emit("user_status", {
      username,
      online: true,
    });

    console.log(users);

    io.emit("online_users", Object.keys(users));
  });

  socket.on("typing", (data) => {
    const receiverSocket = users[data.to];

    if (receiverSocket) {
      io.to(receiverSocket).emit("typing", {
        from: data.from,
      });
    }
  });

  // Private Message
  socket.on("private_message", (data) => {
    const receiverSocket = users[data.to];

    const message = {
      from: data.from,
      to: data.to,
      message: data.message,
      time: new Date().toLocaleTimeString(),
    };

    // Send to receiver
    if (receiverSocket) {
      io.to(receiverSocket).emit("private_message", message);
    }

    // Send back to sender so both devices show the message
    socket.emit("private_message", message);
  });

  socket.on("disconnect", () => {
    console.log("Disconnected :", socket.id);

    for (const username in users) {
      if (users[username] === socket.id) {
        delete users[username];

        io.emit("user_status", {
          username: socket.username,
          online: false,
        });
      }
    }

    io.emit("online_users", Object.keys(users));
  });
});

server.listen(3000, () => {
  console.log("Server Started on 3000");
});
