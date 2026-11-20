// Spotify: free, used for searching while the user types.
const axios = require("axios");
const {
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
  SEARCH_LIMIT,
} = require("../config");

let token = "";
const trackCache = new Map(); // spotifyId -> { title, artist, thumbnail }

async function refreshToken() {
  try {
    const res = await axios.post(
      "https://accounts.spotify.com/api/token",
      new URLSearchParams({ grant_type: "client_credentials" }),
      {
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString(
              "base64"
            ),
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );
    token = res.data.access_token;
    console.log("Spotify token fetched ✅");
  } catch (err) {
    console.error("Spotify token error ❌", err.message);
  }
}

// fetch a token now and renew it every 50 minutes
function initSpotify() {
  setInterval(refreshToken, 50 * 60 * 1000);
  return refreshToken();
}

// GET from Spotify; if the token is missing/expired, refresh once and retry
async function spotifyGet(url, params) {
  const call = () =>
    axios.get(url, { headers: { Authorization: `Bearer ${token}` }, params });
  try {
    return await call();
  } catch (err) {
    if (err.response?.status === 401) {
      await refreshToken();
      return call();
    }
    throw err;
  }
}

function toTrack(t) {
  return {
    title: t.name,
    artist: t.artists?.[0]?.name || "",
    thumbnail: t.album?.images?.[0]?.url || "",
  };
}

function remember(id, track) {
  if (trackCache.size > 5000) trackCache.clear();
  trackCache.set(id, track);
}

// search tracks by text -> [{ spotifyId, title, artist, thumbnail }]
async function searchTracks(q) {
  const res = await spotifyGet("https://api.spotify.com/v1/search", {
    q,
    type: "track",
    limit: SEARCH_LIMIT,
  });
  return res.data.tracks.items.map((t) => {
    const track = toTrack(t);
    remember(t.id, track); // so add-song needn't ask Spotify again
    return { spotifyId: t.id, ...track };
  });
}

// trusted metadata for one track (never use what the client sends)
async function getTrack(spotifyId) {
  if (trackCache.has(spotifyId)) return trackCache.get(spotifyId);
  const res = await spotifyGet(`https://api.spotify.com/v1/tracks/${spotifyId}`);
  const track = toTrack(res.data);
  remember(spotifyId, track);
  return track;
}

module.exports = { initSpotify, searchTracks, getTrack };
