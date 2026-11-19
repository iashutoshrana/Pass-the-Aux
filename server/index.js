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
app.set("trust proxy", 1); // needed behind Render

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
        // rooms saved before sync existed have no start time
        startedAt: room.startedAt || (room.currentSong ? Date.now() : 0),
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
// Spotify (free: used for searching while typing)
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

// GET from Spotify; if the token is missing/expired, refresh once and retry
async function spotifyGet(url, params) {
  const call = () =>
    axios.get(url, {
      headers: { Authorization: `Bearer ${spotifyToken}` },
      params,
    });
  try {
    return await call();
  } catch (err) {
    if (err.response?.status === 401) {
      await getSpotifyToken();
      return call();
    }
    throw err;
  }
}

const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;
const SEARCH_LIMIT = 4;

const trackCache = new Map(); // spotifyId -> { title, artist, thumbnail }

function toTrack(t) {
  return {
    title: t.name,
    artist: t.artists?.[0]?.name || "",
    thumbnail: t.album?.images?.[0]?.url || "",
  };
}

// trusted metadata for a track (never use what the client sends)
async function getTrack(spotifyId) {
  if (trackCache.has(spotifyId)) return trackCache.get(spotifyId);
  const res = await spotifyGet(
    `https://api.spotify.com/v1/tracks/${spotifyId}`,
  );
  const track = toTrack(res.data);
  if (trackCache.size > 5000) trackCache.clear();
  trackCache.set(spotifyId, track);
  return track;
}

// ---------------------------------------------------------------------------
// Search route: Spotify only, so typing costs no YouTube quota
// ---------------------------------------------------------------------------
app.use("/search", rateLimit({ windowMs: 60_000, max: 40 }));

const searchCache = new Map(); // query -> { at, data }
const CACHE_TTL = 60 * 60 * 1000;

app.get("/search", async (req, res) => {
  const q = String(req.query.q || "")
    .trim()
    .toLowerCase();
  if (q.length < 2) return res.json([]);

  const hit = searchCache.get(q);
  if (hit && Date.now() - hit.at < CACHE_TTL) return res.json(hit.data);

  try {
    console.log("🔍 Searching:", q);
    const spotifyRes = await spotifyGet("https://api.spotify.com/v1/search", {
      q,
      type: "track",
      limit: SEARCH_LIMIT,
    });

    const data = spotifyRes.data.tracks.items.map((t) => {
      const track = toTrack(t);
      trackCache.set(t.id, track); // remember it for add-song
      return { spotifyId: t.id, ...track };
    });

    if (data.length) {
      if (searchCache.size > 500) searchCache.clear();
      searchCache.set(q, { at: Date.now(), data });
    }
    res.json(data);
  } catch (err) {
    console.error("Search error ❌:", err.response?.data?.error || err.message);
    res.status(500).json({ error: "Search failed" });
  }
});

// ---------------------------------------------------------------------------
// YouTube (costs quota: only used when a song is actually added)
// ---------------------------------------------------------------------------
const ytCache = new Map(); // "title artist" -> videoId

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
        videoEmbeddable: "true", // skip videos that can't play inside our player
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const MAX_QUEUE = 50;
const ADD_COOLDOWN_MS = 1500;
const pendingAdds = new Set(); // "roomId:spotifyId" lookups in progress

// current song + how many seconds into it we are right now
function withPosition(room) {
  if (!room.currentSong) return null;
  if (!room.startedAt) room.startedAt = Date.now();
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

  // The client sends only a Spotify id. The server fetches the real title,
  // artist and thumbnail from Spotify, then finds the YouTube video.
  socket.on("add-song", async ({ roomId, spotifyId } = {}) => {
    const room = rooms[roomId];
    if (!room || !socket.rooms.has(roomId)) return;
    if (!SPOTIFY_ID.test(spotifyId || "")) return;

    const fail = (message) => socket.emit("add-error", { spotifyId, message });

    if (room.queue.length >= MAX_QUEUE) return fail("The queue is full");
    if (room.queue.some((s) => s.spotifyId === spotifyId))
      return fail("Already in the queue");

    // per-user cooldown so nobody can burn the YouTube quota
    const now = Date.now();
    if (now - (socket.data.lastAdd || 0) < ADD_COOLDOWN_MS)
      return fail("Slow down a little");
    socket.data.lastAdd = now;

    const key = `${roomId}:${spotifyId}`;
    if (pendingAdds.has(key)) return;
    pendingAdds.add(key);

    try {
      const track = await getTrack(spotifyId);
      const videoId = await findVideoId(`${track.title} ${track.artist}`);
      if (!videoId) return fail("Couldn't find this song on YouTube");

      // the room may have changed while we were waiting: check again
      if (!rooms[roomId]) return;
      if (room.queue.length >= MAX_QUEUE) return fail("The queue is full");
      if (
        room.queue.some(
          (s) => s.videoId === videoId || s.spotifyId === spotifyId,
        )
      )
        return fail("Already in the queue");

      const song = {
        spotifyId,
        videoId,
        title: track.title.slice(0, 150),
        artist: track.artist.slice(0, 100),
        thumbnail: track.thumbnail,
        votes: 0,
        voters: [],
      };
      room.queue.push(song);
      room.lastActivity = Date.now();

      if (!room.currentSong) {
        setCurrent(room, song);
        io.to(roomId).emit("play-song", withPosition(room));
      }
      io.to(roomId).emit("update-queue", room.queue);
      await saveRoom(roomId);
    } catch (err) {
      const reason = err.response?.data?.error?.errors?.[0]?.reason;
      console.error("Add song error ❌:", reason || err.message);
      if (reason === "quotaExceeded" || reason === "dailyLimitExceeded") {
        fail("YouTube daily limit reached, try again later");
      } else {
        fail("Couldn't add that song, try again");
      }
    } finally {
      pendingAdds.delete(key);
    }
  });

  socket.on("vote-song", async ({ roomId, videoId, clientId } = {}) => {
    const room = rooms[roomId];
    if (!room || !socket.rooms.has(roomId)) return;

    const song = room.queue.find((s) => s.videoId === videoId);
    // stable per-browser id (survives refresh); fall back to the socket id
    const voterId =
      typeof clientId === "string" &&
      clientId.length > 0 &&
      clientId.length <= 64
        ? clientId
        : socket.id;
    if (!song || song.voters.includes(voterId)) return;

    song.voters.push(voterId);
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

  // someone pressed "Leave"
  socket.on("leave-room", async (roomId) => {
    const room = rooms[roomId];
    if (!room || !socket.rooms.has(roomId)) return;
    socket.leave(roomId);

    if (room.hostId === socket.id) {
      const clients = io.sockets.adapter.rooms.get(roomId);
      if (clients && clients.size > 0) {
        const newHost = [...clients][0];
        room.hostId = newHost;
        io.to(newHost).emit("promoted-to-host");
      } else {
        room.hostId = ""; // empty room: next person to join becomes host
      }
    }
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
