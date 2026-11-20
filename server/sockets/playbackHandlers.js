// next-song (host Skip) and song-ended (player finished)
const { rooms } = require("../roomStore");
const { advance } = require("../roomLogic");

module.exports = function playbackHandlers(io, socket) {
  // host pressed Skip
  socket.on("next-song", async (roomId) => {
    const room = rooms[roomId];
    if (!room || !room.currentSong) return;
    if (socket.id !== room.hostId) return; // only the host may skip
    await advance(io, roomId);
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
