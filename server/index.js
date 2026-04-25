const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// TEMP memory (we'll upgrade later)
const rooms = {};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // CREATE ROOM
  socket.on("create-room", () => {
    const roomId = Math.random().toString(36).substring(2, 8);

    rooms[roomId] = {
      queue: [],
    };

    socket.join(roomId);
    socket.emit("room-created", roomId);

    console.log("Room created:", roomId);
  });

  // JOIN ROOM
  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    socket.emit("joined-room", roomId);

    console.log("Joined room:", roomId);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

server.listen(5000, () => {
  console.log("Server running on port 5000");
});