// next-song (host Skip) and song-ended (player finished)
const { rooms } = require("../roomStore");
const { advance, afterRoomChange } = require("../roomLogic");

module.exports = function playbackHandlers(io, socket) {
  // host pressed Skip
  socket.on("next-song", async (roomId) => {
    const room = rooms[roomId];
    if (!room || !room.currentSong) return;
    if (socket.id !== room.hostId) return; // only the host may skip
    await advance(io, roomId);
  });

  // a guest votes to skip. The client sends the id of the song it is looking
  // at, so a late vote for the previous song can't count against the next one.
  socket.on("vote-skip", async ({ roomId, videoId } = {}) => {
    const room = rooms[roomId];
    if (!room || !room.currentSong || !socket.rooms.has(roomId)) return;
    if (room.currentSong.videoId !== videoId) return;

    if (!room.skipVoters) room.skipVoters = [];
    if (!room.skipVoters.includes(socket.id)) room.skipVoters.push(socket.id);
    await afterRoomChange(io, roomId);
  });

  // a player reached the end (or failed to load). Any member can report it,
  // but only the first report for the current song counts.
  socket.on("song-ended", async ({ roomId, videoId } = {}) => {
    const room = rooms[roomId];
    if (!room || !socket.rooms.has(roomId)) return;
    if (!room.currentSong || room.currentSong.videoId !== videoId) return;
    await advance(io, roomId);
  });
};
