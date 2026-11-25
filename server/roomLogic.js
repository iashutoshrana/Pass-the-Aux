// Pure room/queue helpers shared by the socket handlers.
const { rooms, saveRoom } = require("./roomStore");
const { HOST_GRACE_MS } = require("./config");

// What is safe to send to everyone. Songs also carry who voted for them and
// who added them. Those are people's permanent ids, which must stay private
// (the host's id is what proves who the host is).
function publicSong(song) {
  const { voters, addedBy, ...rest } = song; // eslint-disable-line no-unused-vars
  return rest;
}
const publicQueue = (queue) => queue.map(publicSong);

// the id that identifies a person for voting: permanent id, else connection id
const voterIdOf = (socket) => socket.data.clientId || socket.id;

// current song + how many seconds into it we are right now
function withPosition(room) {
  if (!room.currentSong) return null;
  if (!room.startedAt) room.startedAt = Date.now();
  return {
    ...publicSong(room.currentSong),
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
  io.to(roomId).emit("update-queue", publicQueue(room.queue));
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

// ---------------------------------------------------------------------------
// Host handling. A person is recognised by a permanent id kept in their
// browser (clientId), not by their connection, so a refresh doesn't lose them.
// ---------------------------------------------------------------------------

// a clientId from the browser: only accept a sensible string
function cleanClientId(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 64
    ? value
    : "";
}

// Give the party to the first person in the room. False if the room is empty.
async function handOverHost(io, roomId) {
  const room = rooms[roomId];
  if (!room) return false;
  const clients = io.sockets.adapter.rooms.get(roomId);
  if (!clients || clients.size === 0) return false;

  const newHost = [...clients][0];
  room.hostId = newHost;
  room.hostClientId = io.sockets.sockets.get(newHost)?.data.clientId || "";
  io.to(newHost).emit("promoted-to-host");
  await saveRoom(roomId);
  return true;
}

// The host's connection dropped. Wait a little before giving the party away:
// if they come straight back (a refresh), they keep control.
function startHostGrace(io, roomId, deadSocketId) {
  const room = rooms[roomId];
  if (!room) return;
  clearTimeout(room.graceTimer);
  room.graceTimer = setTimeout(async () => {
    room.graceTimer = null;
    if (rooms[roomId] !== room || room.hostId !== deadSocketId) return; // host is back
    await handOverHost(io, roomId);
  }, HOST_GRACE_MS);
}

module.exports = {
  publicSong,
  publicQueue,
  voterIdOf,
  cleanClientId,
  handOverHost,
  startHostGrace,
  withPosition,
  setCurrent,
  sortQueue,
  advance,
  skipState,
  afterRoomChange,
};
