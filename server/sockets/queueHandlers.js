// add-song and vote-song
const { rooms, saveRoom } = require("../roomStore");
const {
  withPosition,
  setCurrent,
  sortQueue,
  publicQueue,
  voterIdOf,
} = require("../roomLogic");
const spotify = require("../services/spotify");
const resolver = require("../services/videoResolver");
const {
  MAX_QUEUE,
  MAX_SONGS_PER_PERSON,
  ADD_COOLDOWN_MS,
  SPOTIFY_ID,
} = require("../config");

const pendingAdds = new Set(); // "roomId:spotifyId" lookups in progress

module.exports = function queueHandlers(io, socket) {
  // The client sends only a Spotify id. The server fetches the real title,
  // artist and thumbnail from Spotify, then finds the YouTube video.
  socket.on("add-song", async (payload) => {
    const { roomId, spotifyId } = payload || {};
    const room = rooms[roomId];
    if (!room || !socket.rooms.has(roomId)) return;
    if (!SPOTIFY_ID.test(spotifyId || "")) return;

    const fail = (message) => socket.emit("add-error", { spotifyId, message });
    const adder = voterIdOf(socket);
    const mine = () => room.queue.filter((s) => s.addedBy === adder).length;
    const tooMany = `You can have ${MAX_SONGS_PER_PERSON} songs in the queue at a time`;

    if (room.queue.length >= MAX_QUEUE) return fail("The queue is full");
    if (room.queue.some((s) => s.spotifyId === spotifyId))
      return fail("Already in the queue");
    if (mine() >= MAX_SONGS_PER_PERSON) return fail(tooMany);

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
      const videoId = await resolver.resolveVideoId(spotifyId, track);
      if (!videoId) return fail("Couldn't find this song on YouTube");

      // the room may have changed while we were waiting: check again
      if (!rooms[roomId]) return;
      if (room.queue.length >= MAX_QUEUE) return fail("The queue is full");
      if (room.queue.some((s) => s.videoId === videoId || s.spotifyId === spotifyId))
        return fail("Already in the queue");
      if (mine() >= MAX_SONGS_PER_PERSON) return fail(tooMany);

      const song = {
        spotifyId,
        videoId,
        title: track.title.slice(0, 150),
        artist: track.artist.slice(0, 100),
        thumbnail: track.thumbnail,
        votes: 0,
        voters: [], // private: never sent to clients
        addedBy: adder, // private: never sent to clients
      };
      room.queue.push(song);
      room.lastActivity = Date.now();

      if (!room.currentSong) {
        setCurrent(room, song);
        io.to(roomId).emit("play-song", withPosition(room));
      }
      io.to(roomId).emit("update-queue", publicQueue(room.queue));
      await saveRoom(roomId);
    } catch (err) {
      console.error("Add song error ❌:", err.isQuota ? "quota used up" : err.message);
      if (err.isQuota) {
        fail("YouTube daily limit reached, try again later");
      } else {
        fail("Couldn't add that song, try again");
      }
    } finally {
      pendingAdds.delete(key);
    }
  });

  socket.on("vote-song", async (payload) => {
    const { roomId, videoId } = payload || {};
    const room = rooms[roomId];
    if (!room || !socket.rooms.has(roomId)) return;

    const song = room.queue.find((s) => s.videoId === videoId);
    // Who is voting comes from the server's own record of this connection,
    // never from the message, so nobody can vote many times with made-up ids.
    const voterId = voterIdOf(socket);
    if (!song || song.voters.includes(voterId)) return;

    song.voters.push(voterId);
    song.votes += 1;
    sortQueue(room);
    room.lastActivity = Date.now();
    io.to(roomId).emit("update-queue", publicQueue(room.queue));
    await saveRoom(roomId);
  });
};
