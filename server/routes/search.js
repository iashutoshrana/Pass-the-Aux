// GET /search?q=...  (Spotify only, cached, rate limited)
const express = require("express");
const rateLimit = require("express-rate-limit");
const spotify = require("../services/spotify");
const { CACHE_TTL } = require("../config");

const router = express.Router();
router.use(rateLimit({ windowMs: 60_000, max: 40 }));

const searchCache = new Map(); // query -> { at, data }

router.get("/", async (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  if (q.length < 2) return res.json([]);

  const hit = searchCache.get(q);
  if (hit && Date.now() - hit.at < CACHE_TTL) return res.json(hit.data);

  try {
    console.log("🔍 Searching:", q);
    const data = await spotify.searchTracks(q);
    if (data.length) {
      if (searchCache.size > 500) searchCache.clear();
      searchCache.set(q, { at: Date.now(), data });
    }
    res.json(data);
  } catch (err) {
    console.error("Search error ❌:", err.response?.data?.error || err.message);
    res.status(500).json({ error: "Search failed" });
  }
});

module.exports = router;
