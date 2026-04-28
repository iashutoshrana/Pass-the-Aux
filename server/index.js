const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

require("dotenv").config();


const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const axios = require("axios");
const mongoose = require("mongoose");

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || "*" }));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "*",
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
});

// ✅ MongoDB Connection
mongoose
  .connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    family: 4, // ✅ Force IPv4 — fixes most India ISP DNS issues
  })
  .then(() => console.log("MongoDB connected ✅"))
  .catch((err) => console.error("MongoDB error ❌", err.message));

// ✅ Room Schema
const roomSchema = new mongoose.Schema({
  roomId: { type: String, unique: true },
  queue: { type: Array, default: [] },
  currentSong: { type: Object, default: null },
  hostId: { type: String, default: "" },
  lastActivity: { type: Date, default: Date.now },
});

const Room = mongoose.model("Room", roomSchema);

// In-memory rooms (for fast access)
const rooms = {};

// ✅ Load all rooms from DB into memory on server start
async function loadRoomsFromDB() {
  const allRooms = await Room.find({});
  allRooms.forEach((room) => {
    rooms[room.roomId] = {
      queue: room.queue,
      currentSong: room.currentSong,
      hostId: room.hostId,
      lastActivity: room.lastActivity,
    };
  });
  console.log(`Loaded ${allRooms.length} rooms from DB ✅`);
}
loadRoomsFromDB();

// ✅ Save room to DB
async function saveRoom(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  await Room.findOneAndUpdate(
    { roomId },
    {
      queue: room.queue,
      currentSong: room.currentSong,
      hostId: room.hostId,
      lastActivity: room.lastActivity,
    },
    { upsert: true, new: true }
  );
}

// ✅ Auto-delete inactive rooms after 3 hours
const ROOM_TTL_MS = 3 * 60 * 60 * 1000;
setInterval(async () => {
  const now = Date.now();
  for (const roomId in rooms) {
    if (now - new Date(rooms[roomId].lastActivity).getTime() > ROOM_TTL_MS) {
      delete rooms[roomId];
      await Room.deleteOne({ roomId });
      console.log(`Room ${roomId} expired and removed`);
    }
  }
}, 10 * 60 * 1000);

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

  socket.on("create-room", async () => {
    const roomId = Math.random().toString(36).substring(2, 8);
    rooms[roomId] = {
      queue: [],
      currentSong: null,
      hostId: socket.id,
      lastActivity: Date.now(),
    };
    socket.join(roomId);
    socket.emit("room-created", roomId);
    await saveRoom(roomId);
    console.log(`Room ${roomId} created by ${socket.id}`);
  });

  socket.on("join-room", async (roomId) => {
    if (!rooms[roomId]) {
      socket.emit("error", "Room not found");
      return;
    }
    socket.join(roomId);
    rooms[roomId].lastActivity = Date.now();
    socket.emit("joined-room", roomId);
    socket.emit("room-state", {
      queue: rooms[roomId].queue,
      currentSong: rooms[roomId].currentSong,
    });
    await saveRoom(roomId);
  });

  socket.on("add-song", async ({ roomId, song }) => {
    const room = rooms[roomId];
    if (!room) return;

    const isDuplicate = room.queue.some((s) => s.videoId === song.videoId);
    if (isDuplicate) return;

    song.votes = 0;
    song.voters = [];
    room.queue.push(song);
    room.lastActivity = Date.now();

    if (!room.currentSong) {
      room.currentSong = song;
      io.to(roomId).emit("play-song", song);
    }

    io.to(roomId).emit("update-queue", room.queue);
    await saveRoom(roomId);
  });

  socket.on("vote-song", async ({ roomId, videoId, userId }) => {
    const room = rooms[roomId];
    if (!room) return;

    const song = room.queue.find((s) => s.videoId === videoId);
    if (!song || song.voters.includes(userId)) return;

    song.voters.push(userId);
    song.votes += 1;
    room.queue.sort((a, b) => b.votes - a.votes);
    room.lastActivity = Date.now();

    io.to(roomId).emit("update-queue", room.queue);
    await saveRoom(roomId);
  });

  socket.on("next-song", async (roomId) => {
    const room = rooms[roomId];
    if (!room || room.queue.length === 0) return;

    if (socket.id !== room.hostId) return;

    room.queue.shift();
    room.lastActivity = Date.now();

    if (room.queue.length === 0) {
      room.currentSong = null;
      io.to(roomId).emit("update-queue", []);
      io.to(roomId).emit("play-song", null);
      await saveRoom(roomId);
      return;
    }

    room.currentSong = room.queue[0];
    io.to(roomId).emit("update-queue", room.queue);
    io.to(roomId).emit("play-song", room.currentSong);
    await saveRoom(roomId);
  });

  socket.on("disconnect", async () => {
    console.log("User disconnected:", socket.id);
    for (const roomId in rooms) {
      if (rooms[roomId].hostId === socket.id) {
        const clients = io.sockets.adapter.rooms.get(roomId);
        if (clients && clients.size > 0) {
          const newHost = [...clients][0];
          rooms[roomId].hostId = newHost;
          await saveRoom(roomId);
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