require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// TEMP memory
const rooms = {};

// 🎧 Spotify Token
let spotifyToken = "";

async function getSpotifyToken() {
  try {
    const res = await axios.post(
      "https://accounts.spotify.com/api/token",
      new URLSearchParams({
        grant_type: "client_credentials",
      }),
      {
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(
              `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
            ).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    spotifyToken = res.data.access_token;
    console.log("Spotify token fetched ✅");
  } catch (err) {
    console.error("Spotify token error ❌", err.message);
  }
}

// call once
getSpotifyToken();

// 🎵 Spotify Search API
app.get("/search", async (req, res) => {
  try {
    const query = req.query.q;

    const response = await axios.get(
      "https://api.spotify.com/v1/search",
      {
        headers: {
          Authorization: `Bearer ${spotifyToken}`,
        },
        params: {
          q: query,
          type: "track",
          limit: 5,
        },
      }
    );

    res.json(response.data.tracks.items);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Search failed" });
  }
});

// 🔌 Socket Logic
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

  // 🎵 ADD SONG
  socket.on("add-song", ({ roomId, song }) => {
    if (!rooms[roomId]) return;

    rooms[roomId].queue.push(song);

    io.to(roomId).emit("update-queue", rooms[roomId].queue);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

server.listen(5000, () => {
  console.log("Server running on port 5000");
});