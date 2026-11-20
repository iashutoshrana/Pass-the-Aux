// YouTube: costs quota, so it is only used when a song is actually added.
const axios = require("axios");
const { YOUTUBE_API_KEY } = require("../config");

const ytCache = new Map(); // "title artist" -> videoId

async function findVideoId(searchQuery) {
  const key = searchQuery.toLowerCase();
  if (ytCache.has(key)) return ytCache.get(key);

  const res = await axios.get("https://www.googleapis.com/youtube/v3/search", {
    params: {
      part: "snippet",
      q: searchQuery,
      key: YOUTUBE_API_KEY,
      type: "video",
      videoEmbeddable: "true", // skip videos that can't play inside our player
      maxResults: 1,
    },
  });
  const id = res.data.items?.[0]?.id?.videoId || null;
  if (id) {
    if (ytCache.size > 2000) ytCache.clear();
    ytCache.set(key, id);
  }
  return id;
}

module.exports = { findVideoId };
