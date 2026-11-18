const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const axios = require("axios");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");

const app = express();
app.set("trust proxy", 1); // needed behind Render/Railway/Nginx

const CLIENT_URL = process.env.CLIENT_URL || "*";
app.use(cors({ origin: CLIENT_URL }));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
});

// ---------------------------------------------------------------------------
// MongoDB
// ---------------------------------------------------------------------------
mongoose
  .connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    family: 4, // force IPv4 (fixes DNS issues on some ISPs)
  })
  .then(() => console.log("MongoDB connected ✅"))
  .catch((err) => console.error("MongoDB error ❌", err.message));

const roomSchema = new mongoose.Schema({
  roomId: { type: String, unique: true },
  queue: { type: Array, default: [] },
  currentSong: { type: Object, default: null },
  startedAt: { type: Number, default: 0 }, // when the current song started (ms)
  hostId: { type: String, default: "" },
  lastActivity: { type: Date, default: Date.now },
});

const Room = mongoose.model("Room", roomSchema);

// In-memory rooms (fast access)
const rooms = {};

async function loadRoomsFromDB() {
  try {
    const allRooms = await Room.find({});
    allRooms.forEach((room) => {
      rooms[room.roomId] = {
        queue: room.queue,
        currentSong: room.currentSong,
        startedAt: room.startedAt || 0,
        hostId: room.hostId,
        lastActivity: room.lastActivity,
      };
    });
    console.log(`Loaded ${allRooms.length} rooms from DB ✅`);
  } catch (err) {
    console.error("Load rooms error ❌", err.message);
  }
}
loadRoomsFromDB();

async function saveRoom(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  try {
    await Room.findOneAndUpdate(
      { roomId },
      {
        queue: room.queue,
        currentSong: room.currentSong,
        startedAt: room.startedAt || 0,
        hostId: room.hostId,
        lastActivity: room.lastActivity,
      },
      { upsert: true, new: true },
    );
  } catch (err) {
    console.error("Save room error ❌", err.message);
  }
}

// Auto-delete inactive rooms after 3 hours
const ROOM_TTL_MS = 3 * 60 * 60 * 1000;
setInterval(
  async () => {
    const now = Date.now();
    for (const roomId in rooms) {
      if (now - new Date(rooms[roomId].lastActivity).getTime() > ROOM_TTL_MS) {
        delete rooms[roomId];
        try {
          await Room.deleteOne({ roomId });
        } catch (err) {
          console.error("Delete room error ❌", err.message);
        }
        console.log(`Room ${roomId} expired and removed`);
      }
    }
  },
  10 * 60 * 1000,
);

// ---------------------------------------------------------------------------
// Spotify token
// ---------------------------------------------------------------------------
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
              `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`,
            ).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );
    spotifyToken = res.data.access_token;
    console.log("Spotify token fetched ✅");
  } catch (err) {
    console.error("Spotify token error ❌", err.message);
  }
}

setInterval(getSpotifyToken, 50 * 60 * 1000);
getSpotifyToken();

// ---------------------------------------------------------------------------
// Search (with caching + rate limiting to protect API quotas)
// ---------------------------------------------------------------------------
app.use("/search", rateLimit({ windowMs: 60_000, max: 20 }));

const searchCache = new Map(); // query -> { at, data }
const ytCache = new Map(); // "track artist" -> videoId
const CACHE_TTL = 60 * 60 * 1000;

async function spotifySearch(q) {
  const call = () =>
    axios.get("https://api.spotify.com/v1/search", {
      headers: { Authorization: `Bearer ${spotifyToken}` },
      params: { q, type: "track", limit: 4 },
    });
  try {
    return await call();
  } catch (err) {
    if (err.response?.status === 401) {
      await getSpotifyToken(); // token expired, refresh once and retry
      return call();
    }
    throw err;
  }
}

async function findVideoId(searchQuery) {
  const key = searchQuery.toLowerCase();
  if (ytCache.has(key)) return ytCache.get(key);

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
    },
  );
  const id = ytRes.data.items?.[0]?.id?.videoId || null;
  if (id) {
    if (ytCache.size > 2000) ytCache.clear();
    ytCache.set(key, id);
  }
  return id;
}

app.get("/search", async (req, res) => {
  const q = String(req.query.q || "")
    .trim()
    .toLowerCase();
  if (q.length < 2) return res.json([]);

  const hit = searchCache.get(q);
  if (hit && Date.now() - hit.at < CACHE_TTL) return res.json(hit.data);

  try {
    console.log("🔍 Searching:", q);
    const spotifyRes = await spotifySearch(q);
    const tracks = spotifyRes.data.tracks.items;

    const results = await Promise.all(
      tracks.map(async (track) => {
        try {
          const videoId = await findVideoId(
            `${track.name} ${track.artists[0].name}`,
          );
          if (!videoId) return null;
          return {
            title: track.name,
            artist: track.artists[0].name,
            thumbnail: track.album.images[0]?.url,
            videoId,
            votes: 0,
            voters: [],
          };
        } catch (err) {
          console.log("YouTube error:", err.message);
          return null;
        }
      }),
    );

    const data = results.filter(Boolean);
    if (data.length) {
      if (searchCache.size > 500) searchCache.clear();
      searchCache.set(q, { at: Date.now(), data });
    }
    res.json(data);
  } catch (err) {
    console.error("Search error ❌:", err.message);
    res.status(500).json({ error: "Search failed" });
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const VIDEO_ID = /^[\w-]{11}$/;
const MAX_QUEUE = 50;

// current song + how many seconds into it we are right now
function withPosition(room) {
  if (!room.currentSong) return null;
  return {
    ...room.currentSong,
    position: Math.max(0, (Date.now() - room.startedAt) / 1000),
  };
}

function setCurrent(room, song) {
  room.currentSong = song;
  room.startedAt = song ? Date.now() : 0;
}

// keep the playing song first, sort the rest by votes
function sortQueue(room) {
  const cur = room.currentSong?.videoId;
  room.queue.sort(
    (a, b) => (b.videoId === cur) - (a.videoId === cur) || b.votes - a.votes,
  );
}

// remove the current song and start the next one
async function advance(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  const cur = room.currentSong?.videoId;
  room.queue = room.queue.filter((s) => s.videoId !== cur);
  setCurrent(room, room.queue[0] || null);
  room.lastActivity = Date.now();
  io.to(roomId).emit("update-queue", room.queue);
  io.to(roomId).emit("play-song", withPosition(room));
  await saveRoom(roomId);
}

// ---------------------------------------------------------------------------
// Socket logic
// ---------------------------------------------------------------------------
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("create-room", async () => {
    const roomId = Math.random().toString(36).substring(2, 8);
    rooms[roomId] = {
      queue: [],
      currentSong: null,
      startedAt: 0,
      hostId: socket.id,
      lastActivity: Date.now(),
    };
    socket.join(roomId);
    socket.emit("room-created", roomId);
    await saveRoom(roomId);
    console.log(`Room ${roomId} created by ${socket.id}`);
  });

  socket.on("join-room", async (roomId) => {
    const room = rooms[roomId];
    if (!room) {
      socket.emit("room-error", "Room not found");
      return;
    }
    socket.join(roomId);
    room.lastActivity = Date.now();
    socket.emit("joined-room", roomId);
    socket.emit("room-state", {
      queue: room.queue,
      currentSong: withPosition(room), // includes position
    });

    // if the host is gone (refresh, closed tab, server restart), this person becomes host
    if (!io.sockets.sockets.has(room.hostId)) {
      room.hostId = socket.id;
      socket.emit("promoted-to-host");
    }
    await saveRoom(roomId);
  });

  socket.on("add-song", async ({ roomId, song } = {}) => {
    const room = rooms[roomId];
    if (!room || !socket.rooms.has(roomId)) return;
    if (!song || !VIDEO_ID.test(song.videoId)) return;
    if (room.queue.length >= MAX_QUEUE) return;
    if (room.queue.some((s) => s.videoId === song.videoId)) return;

    // never trust the client's object, keep only the fields we need
    const clean = {
      videoId: song.videoId,
      title: String(song.title || "").slice(0, 150),
      artist: String(song.artist || "").slice(0, 100),
      thumbnail:
        typeof song.thumbnail === "string" &&
        song.thumbnail.startsWith("https://")
          ? song.thumbnail
          : "",
      votes: 0,
      voters: [],
    };
    room.queue.push(clean);
    room.lastActivity = Date.now();

    if (!room.currentSong) {
      setCurrent(room, clean);
      io.to(roomId).emit("play-song", withPosition(room));
    }
    io.to(roomId).emit("update-queue", room.queue);
    await saveRoom(roomId);
  });

  socket.on("vote-song", async ({ roomId, videoId } = {}) => {
    const room = rooms[roomId];
    if (!room || !socket.rooms.has(roomId)) return;

    const song = room.queue.find((s) => s.videoId === videoId);
    // use socket.id, not a client-supplied userId
    if (!song || song.voters.includes(socket.id)) return;

    song.voters.push(socket.id);
    song.votes += 1;
    sortQueue(room);
    room.lastActivity = Date.now();
    io.to(roomId).emit("update-queue", room.queue);
    await saveRoom(roomId);
  });

  // host pressed Skip
  socket.on("next-song", async (roomId) => {
    const room = rooms[roomId];
    if (!room || !room.currentSong) return;
    if (socket.id !== room.hostId) return;
    await advance(roomId);
  });

  // a player reached the end (or failed to load). Any member can report it,
  // but only the first report for the current song counts.
  socket.on("song-ended", async ({ roomId, videoId } = {}) => {
    const room = rooms[roomId];
    if (!room || !socket.rooms.has(roomId)) return;
    if (!room.currentSong || room.currentSong.videoId !== videoId) return;
    await advance(roomId);
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
