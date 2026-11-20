// Pure room/queue helpers shared by the socket handlers.
const { rooms, saveRoom } = require("./roomStore");

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
    (a, b) => (b.videoId === cur) - (a.videoId === cur) || b.votes - a.votes
  );
}

// remove the current song and start the next one
async function advance(io, roomId) {
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

module.exports = { withPosition, setCurrent, sortQueue, advance };
