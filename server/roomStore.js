// Rooms: in-memory copy (fast) + MongoDB copy (survives restarts).
const mongoose = require("mongoose");
const { MONGODB_URI, ROOM_TTL_MS } = require("./config");

const roomSchema = new mongoose.Schema({
  roomId: { type: String, unique: true },
  queue: { type: Array, default: [] },
  currentSong: { type: Object, default: null },
  startedAt: { type: Number, default: 0 }, // when the current song started (ms)
  hostId: { type: String, default: "" },
  hostClientId: { type: String, default: "" }, // the host's permanent browser id
  lastActivity: { type: Date, default: Date.now },
});

const Room = mongoose.model("Room", roomSchema);

// roomId -> { queue, currentSong, startedAt, hostId, lastActivity }
// No prototype, so a made-up room code like "__proto__" or "constructor"
// can't match anything built into JavaScript.
const rooms = Object.create(null);

function connectDB() {
  return mongoose
    .connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      family: 4, // force IPv4 (fixes DNS issues on some ISPs)
    })
    .then(() => console.log("MongoDB connected ✅"))
    .catch((err) => console.error("MongoDB error ❌", err.message));
}

async function loadRooms() {
  try {
    const allRooms = await Room.find({});
    allRooms.forEach((room) => {
      rooms[room.roomId] = {
        queue: room.queue,
        currentSong: room.currentSong,
        // rooms saved before sync existed have no start time
        startedAt: room.startedAt || (room.currentSong ? Date.now() : 0),
        hostId: room.hostId,
        hostClientId: room.hostClientId || "",
        lastActivity: room.lastActivity,
      };
    });
    console.log(`Loaded ${allRooms.length} rooms from DB ✅`);
  } catch (err) {
    console.error("Load rooms error ❌", err.message);
  }
}

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
        hostClientId: room.hostClientId || "",
        lastActivity: room.lastActivity,
      },
      { upsert: true }
    );
  } catch (err) {
    console.error("Save room error ❌", err.message);
  }
}

// every 10 minutes, remove rooms nobody has touched for ROOM_TTL_MS
function startCleanup() {
  setInterval(async () => {
    const now = Date.now();
    for (const roomId in rooms) {
      if (now - new Date(rooms[roomId].lastActivity).getTime() > ROOM_TTL_MS) {
        clearTimeout(rooms[roomId].graceTimer);
        delete rooms[roomId];
        try {
          await Room.deleteOne({ roomId });
        } catch (err) {
          console.error("Delete room error ❌", err.message);
        }
        console.log(`Room ${roomId} expired and removed`);
      }
    }
  }, 10 * 60 * 1000);
}

module.exports = { rooms, connectDB, loadRooms, saveRoom, startCleanup };
