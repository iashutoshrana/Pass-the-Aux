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

  // If the host disconnects (refresh, bad signal), wait this long before
  // handing the party to someone else. A quick refresh keeps host control.
  HOST_GRACE_MS: Number(process.env.HOST_GRACE_MS) || 20000,

  // ---- Limits (each can be changed with an environment variable) ----
  MAX_PEOPLE: Number(process.env.MAX_PEOPLE) || 50, // people in one party
  MAX_SONGS_PER_PERSON: Number(process.env.MAX_SONGS_PER_PERSON) || 10, // waiting in the queue
  ROOMS_PER_HOUR: Number(process.env.ROOMS_PER_HOUR) || 5, // new parties per person per hour
  JOIN_FAILS_PER_MIN: Number(process.env.JOIN_FAILS_PER_MIN) || 20, // wrong codes per minute
  // How many proxies sit in front of the server (Render = 1). Used to find the
  // visitor's real address from the X-Forwarded-For header.
  TRUST_PROXY_HOPS: Number(process.env.TRUST_PROXY_HOPS) || 1,
  // Limits are skipped for your own computer, so testing isn't blocked.
  LIMIT_LOOPBACK: process.env.LIMIT_LOOPBACK === "true",
};
