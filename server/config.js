// All settings and constants live here. Reads .env once.
require("dotenv").config();

module.exports = {
  PORT: process.env.PORT || 5000,
  CLIENT_URL: process.env.CLIENT_URL || "*",
  MONGODB_URI: process.env.MONGODB_URI,

  SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET,
  YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY,

  ROOM_TTL_MS: 3 * 60 * 60 * 1000, // delete rooms idle for 3 hours
  CACHE_TTL: 60 * 60 * 1000, // search cache lifetime: 1 hour
  MAX_QUEUE: 50,
  ADD_COOLDOWN_MS: 1500, // minimum gap between adds per user
  SEARCH_LIMIT: 4,

  SPOTIFY_ID: /^[A-Za-z0-9]{22}$/,
};
