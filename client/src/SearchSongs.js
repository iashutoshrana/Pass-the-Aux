import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { socket } from "./socket";

const SERVER_URL = process.env.REACT_APP_SERVER_URL || "http://localhost:5000";

const MIN_CHARS = 3;
const DEBOUNCE_MS = 600;

function SearchSongs({ roomId, queue }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [addedIds, setAddedIds] = useState(new Set());
  const abortRef = useRef(null);

  // Clear the "just added" markers once the server sends the updated queue
  useEffect(() => {
    setAddedIds(new Set());
  }, [queue]);

  const runSearch = async (text) => {
    const q = text.trim();
    if (q.length < MIN_CHARS) return;

    // cancel any older in-flight request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsSearching(true);
    try {
      const res = await axios.get(`${SERVER_URL}/search`, {
        headers: { "ngrok-skip-browser-warning": "true" },
        params: { q },
        signal: controller.signal,
      });
      setResults(res.data.filter((song) => song && song.videoId).slice(0, 4));
      setHasSearched(true);
      setIsSearching(false);
    } catch (err) {
      if (axios.isCancel(err)) return; // newer search replaced this one
      console.error("Search error:", err.message);
      setResults([]);
      setHasSearched(true);
      setIsSearching(false);
    }
  };

  // Search automatically after the user pauses typing
  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_CHARS) {
      if (abortRef.current) abortRef.current.abort();
      setIsSearching(false);
      if (q.length === 0) {
        setResults([]);
        setHasSearched(false);
      }
      return;
    }
    const timer = setTimeout(() => runSearch(q), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const addSong = (song) => {
    if (!song.videoId) return;
    const alreadyInQueue = queue?.some((s) => s.videoId === song.videoId);
    if (alreadyInQueue || addedIds.has(song.videoId)) return;

    socket.emit("add-song", { roomId, song });
    setAddedIds((prev) => new Set(prev).add(song.videoId));
  };

  return (
    <div className="search-container">
      <h3 style={{ marginBottom: "15px", fontSize: "1.2rem", opacity: 0.8 }}>
        Find Your Vibe 🔍
      </h3>

      <div className="search-input-group">
        <input
          className="input-glow"
          placeholder="Search for songs or artists..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runSearch(query)}
        />
        <button
          className="btn-primary"
          onClick={() => runSearch(query)}
          disabled={isSearching}
        >
          {isSearching ? "Searching..." : "SEARCH"}
        </button>
      </div>

      <div className="results-grid">
        {hasSearched && results.length === 0 && !isSearching && (
          <p style={{ opacity: 0.5, marginTop: "20px" }}>No songs found...</p>
        )}

        {results.map((song) => {
          const inQueue =
            queue?.some((s) => s.videoId === song.videoId) ||
            addedIds.has(song.videoId);

          return (
            <div key={song.videoId} className="result-card">
              <div className="result-thumb-container">
                <img
                  src={
                    song.thumbnail ||
                    "https://via.placeholder.com/300x200?text=No+Image"
                  }
                  className="result-thumb"
                  alt="thumbnail"
                />
                <div className="result-overlay">
                  <button
                    className="add-btn-small"
                    onClick={() => addSong(song)}
                    disabled={inQueue}
                    style={{
                      opacity: inQueue ? 0.4 : 1,
                      cursor: inQueue ? "not-allowed" : "pointer",
                    }}
                  >
                    {inQueue ? "✓ Added" : "+ Add to Queue"}
                  </button>
                </div>
              </div>
              <div className="result-info">
                <p className="result-title">{song.title}</p>
                <p style={{ fontSize: "0.8rem", opacity: 0.6 }}>
                  {song.artist}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default SearchSongs;
