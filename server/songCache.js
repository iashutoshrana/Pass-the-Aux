// A permanent memory of "this Spotify song = this YouTube video", kept in
// MongoDB. A song costs one YouTube lookup ever, not one per party or restart.
const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  spotifyId: { type: String, unique: true, index: true },
  videoId: { type: String, required: true },
  title: String,
  artist: String,
  // MongoDB removes the entry 90 days later, so a video that was deleted from
  // YouTube is looked up again some day instead of failing forever
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 90 },
});

const SongCache = mongoose.model("SongCache", schema);

// never let a slow or missing database hold up adding a song
function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function get(spotifyId) {
  try {
    const doc = await withTimeout(SongCache.findOne({ spotifyId }).lean(), 1500);
    return doc?.videoId || null;
  } catch (err) {
    console.error("Song cache read error ❌", err.message);
    return null;
  }
}

// fire and forget: saving must not slow the person who added the song
function save(spotifyId, videoId, track) {
  SongCache.updateOne(
    { spotifyId },
    {
      $set: {
        videoId,
        title: track.title,
        artist: track.artist,
        createdAt: new Date(),
      },
    },
    { upsert: true }
  ).catch((err) => console.error("Song cache save error ❌", err.message));
}

module.exports = { get, save };
