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
  room.skipVoters = []; // skip votes belong to one song only
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
  io.to(roomId).emit("skip-state", skipState(io, roomId));
  await saveRoom(roomId);
}

// ---------------------------------------------------------------------------
// Skip voting. Votes are tracked by socket id, so a vote only counts while
// that person is still in the room. A majority of the people in the room
// (more than half) skips the song.
// ---------------------------------------------------------------------------
function skipState(io, roomId) {
  const room = rooms[roomId];
  const clients = io.sockets.adapter.rooms.get(roomId) || new Set();
  const voters = (room.skipVoters || []).filter((id) => clients.has(id));
  room.skipVoters = voters; // drop votes from people who left
  return {
    videoId: room.currentSong?.videoId || null,
    votes: voters.length,
    needed: Math.floor(clients.size / 2) + 1,
    participants: clients.size,
    voters,
  };
}

// Call after anything that changes who is in the room, or the votes.
// Skips if the votes now reach a majority, otherwise tells everyone the count.
async function afterRoomChange(io, roomId) {
  const room = rooms[roomId];
  if (!room) return;
  const state = skipState(io, roomId);
  if (room.currentSong && state.votes > 0 && state.votes >= state.needed) {
    await advance(io, roomId); // advance() sends the fresh skip-state
    return;
  }
  io.to(roomId).emit("skip-state", state);
}

module.exports = {
  withPosition,
  setCurrent,
  sortQueue,
  advance,
  skipState,
  afterRoomChange,
};
