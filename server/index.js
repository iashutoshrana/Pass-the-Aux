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
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
  transports: ["websocket"],
});

// TEMP memory
const rooms = {};

// 🎧 Spotify Token
let spotifyToken = "";

// 🔑 GET SPOTIFY TOKEN
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

setInterval(getSpotifyToken, 50 * 60 * 1000);
getSpotifyToken();


// 🎵 HYBRID SEARCH (FIXED)
app.get("/search", async (req, res) => {
  try {
    const query = req.query.q;
    console.log("🔍 Searching:", query);

    // 🎧 Spotify Search
    const spotifyRes = await axios.get(
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

    const tracks = spotifyRes.data.tracks.items;
    console.log("Spotify results:", tracks.length);

    // 🎬 Map to YouTube safely
    const results = await Promise.all(
      tracks.map(async (track) => {
        try {
          const searchQuery = `${track.name} ${track.artists[0].name}`;

          const ytRes = await axios.get(
            "https://www.googleapis.com/youtube/v3/search",
            {
              params: {
                part: "snippet",
                q: searchQuery,
                key: process.env.YOUTUBE_API_KEY,
                type: "video",
                maxResults: 1,
              },
            }
          );

          const video = ytRes.data.items?.[0];

          // 🚫 skip if no video found
          if (!video) return null;

          return {
            title: track.name,
            artist: track.artists[0].name,
            thumbnail: track.album.images[0]?.url,
            videoId: video.id.videoId,
            votes: 0,
            voters: [],
          };
        } catch (err) {
          console.log("YouTube error:", err.message);
          return null; // 👈 don't crash whole API
        }
      })
    );

    // ✅ remove null values
    const cleanResults = results.filter(Boolean);

    res.json(cleanResults);
  } catch (err) {
    console.error("Search error ❌:", err.message);
    res.status(500).json({ error: "Search failed" });
  }
});


// 🔌 SOCKET LOGIC
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("create-room", () => {
    const roomId = Math.random().toString(36).substring(2, 8);

    rooms[roomId] = {
      queue: [],
      currentIndex: 0,
    };

    socket.join(roomId);
    socket.emit("room-created", roomId);
  });

  socket.on("join-room", (roomId) => {
    if (!rooms[roomId]) return;

    socket.join(roomId);
    socket.emit("joined-room", roomId);
    socket.emit("update-queue", rooms[roomId].queue);
  });

  socket.on("add-song", ({ roomId, song }) => {
    if (!rooms[roomId]) return;

    song.votes = 0;
    song.voters = [];

    rooms[roomId].queue.push(song);

    io.to(roomId).emit("update-queue", rooms[roomId].queue);
  });

  socket.on("vote-song", ({ roomId, videoId, userId }) => {
    const room = rooms[roomId];
    if (!room) return;

    const song = room.queue.find((s) => s.videoId === videoId);
    if (!song) return;

    if (song.voters.includes(userId)) return;

    song.voters.push(userId);
    song.votes += 1;

    room.queue.sort((a, b) => b.votes - a.votes);

    io.to(roomId).emit("update-queue", room.queue);
  });

  socket.on("next-song", (roomId) => {
    const room = rooms[roomId];
    if (!room || room.queue.length === 0) return;

    room.currentIndex =
      (room.currentIndex + 1) % room.queue.length;

    io.to(roomId).emit(
      "play-song",
      room.queue[room.currentIndex]
    );
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

server.listen(5000, () => {
  console.log("Server running on port 5000");
});