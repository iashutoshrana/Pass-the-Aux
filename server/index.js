require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const axios = require("axios");

const app = express();

// ✅ Allow any origin in dev; lock down in production via env
app.use(
  cors({
    origin: process.env.CLIENT_URL || "*",
  })
);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "*",
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"], // ✅ match client
});

// In-memory rooms
const rooms = {};

// ✅ Auto-delete inactive rooms after 3 hours
const ROOM_TTL_MS = 3 * 60 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const roomId in rooms) {
    if (now - rooms[roomId].lastActivity > ROOM_TTL_MS) {
      delete rooms[roomId];
      console.log(`Room ${roomId} expired and removed`);
    }
  }
}, 10 * 60 * 1000); // check every 10 mins

// Spotify Token
let spotifyToken = "";

async function getSpotifyToken() {
  try {
    const res = await axios.post(
      "https://accounts.spotify.com/api/token",
      new URLSearchParams({ grant_type: "client_credentials" }),
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

// Search Route
app.get("/search", async (req, res) => {
  try {
    const query = req.query.q;
    console.log("🔍 Searching:", query);

    const spotifyRes = await axios.get("https://api.spotify.com/v1/search", {
      headers: { Authorization: `Bearer ${spotifyToken}` },
      params: { q: query, type: "track", limit: 5 },
    });

    const tracks = spotifyRes.data.tracks.items;

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
          return null;
        }
      })
    );

    res.json(results.filter(Boolean));
  } catch (err) {
    console.error("Search error ❌:", err.message);
    res.status(500).json({ error: "Search failed" });
  }
});

// Socket Logic
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("create-room", () => {
    const roomId = Math.random().toString(36).substring(2, 8);
    rooms[roomId] = {
      queue: [],
      currentSong: null,
      hostId: socket.id, // ✅ track host
      lastActivity: Date.now(),
    };
    socket.join(roomId);
    socket.emit("room-created", roomId);
    console.log(`Room ${roomId} created by ${socket.id}`);
  });

  socket.on("join-room", (roomId) => {
    if (!rooms[roomId]) {
      socket.emit("error", "Room not found");
      return;
    }
    socket.join(roomId);
    rooms[roomId].lastActivity = Date.now();
    socket.emit("joined-room", roomId);

    // ✅ Send full current state to late joiners
    socket.emit("room-state", {
      queue: rooms[roomId].queue,
      currentSong: rooms[roomId].currentSong,
    });
  });

  socket.on("add-song", ({ roomId, song }) => {
    const room = rooms[roomId];
    if (!room) return;

    // ✅ Duplicate guard on server side too
    const isDuplicate = room.queue.some((s) => s.videoId === song.videoId);
    if (isDuplicate) return;

    song.votes = 0;
    song.voters = [];
    room.queue.push(song);
    room.lastActivity = Date.now();

    // ✅ Auto-set currentSong if queue was empty
    if (!room.currentSong) {
      room.currentSong = song;
      io.to(roomId).emit("play-song", song);
    }

    io.to(roomId).emit("update-queue", room.queue);
  });

  socket.on("vote-song", ({ roomId, videoId, userId }) => {
    const room = rooms[roomId];
    if (!room) return;

    const song = room.queue.find((s) => s.videoId === videoId);
    if (!song || song.voters.includes(userId)) return;

    song.voters.push(userId);
    song.votes += 1;
    room.queue.sort((a, b) => b.votes - a.votes);
    room.lastActivity = Date.now();

    io.to(roomId).emit("update-queue", room.queue);
  });

  socket.on("next-song", (roomId) => {
    const room = rooms[roomId];
    if (!room || room.queue.length === 0) return;

    // ✅ Only host can skip
    if (socket.id !== room.hostId) return;

    // Remove current song from queue
    room.queue.shift();
    room.lastActivity = Date.now();

    if (room.queue.length === 0) {
      room.currentSong = null;
      io.to(roomId).emit("update-queue", []);
      io.to(roomId).emit("play-song", null);
      return;
    }

    room.currentSong = room.queue[0];
    io.to(roomId).emit("update-queue", room.queue);
    io.to(roomId).emit("play-song", room.currentSong);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    // If host disconnects, reassign host to next person in room
    for (const roomId in rooms) {
      if (rooms[roomId].hostId === socket.id) {
        const clients = io.sockets.adapter.rooms.get(roomId);
        if (clients && clients.size > 0) {
          const newHost = [...clients][0];
          rooms[roomId].hostId = newHost;
          io.to(newHost).emit("promoted-to-host");
          console.log(`Host reassigned to ${newHost} in room ${roomId}`);
        }
      }
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});