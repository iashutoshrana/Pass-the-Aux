// add-song and vote-song
const { rooms, saveRoom } = require("../roomStore");
const { withPosition, setCurrent, sortQueue } = require("../roomLogic");
const spotify = require("../services/spotify");
const youtube = require("../services/youtube");
const { MAX_QUEUE, ADD_COOLDOWN_MS, SPOTIFY_ID } = require("../config");

const pendingAdds = new Set(); // "roomId:spotifyId" lookups in progress

module.exports = function queueHandlers(io, socket) {
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
      const track = await spotify.getTrack(spotifyId);
      const videoId = await youtube.findVideoId(`${track.title} ${track.artist}`);
      if (!videoId) return fail("Couldn't find this song on YouTube");

      // the room may have changed while we were waiting: check again
      if (!rooms[roomId]) return;
      if (room.queue.length >= MAX_QUEUE) return fail("The queue is full");
      if (room.queue.some((s) => s.videoId === videoId || s.spotifyId === spotifyId))
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
      typeof clientId === "string" && clientId.length > 0 && clientId.length <= 64
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
};
