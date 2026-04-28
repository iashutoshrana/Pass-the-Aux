import { useState } from "react";
import axios from "axios";
import { socket } from "./socket";

const SERVER_URL =
  process.env.REACT_APP_SERVER_URL || "http://localhost:5000";

function SearchSongs({ roomId, queue }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addedIds, setAddedIds] = useState(new Set());

  const searchSongs = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    try {
      const res = await axios.get(`${SERVER_URL}/search`, {
        headers: {
          "ngrok-skip-browser-warning": "true", // ✅ bypasses ngrok interstitial
        },
        params: { q: query },
      });
      const validResults = res.data.filter((song) => song && song.videoId);
      setResults(validResults);
    } catch (err) {
      console.error("Search error:", err.message);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const addSong = (song) => {
    if (!song.videoId) {
      alert("Song not playable ❌");
      return;
    }

    const alreadyInQueue = queue?.some((s) => s.videoId === song.videoId);
    if (alreadyInQueue || addedIds.has(song.videoId)) {
      alert("Song is already in the queue!");
      return;
    }

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
          onKeyDown={(e) => e.key === "Enter" && searchSongs()}
        />
        <button className="btn-primary" onClick={searchSongs} disabled={isSearching}>
          {isSearching ? "Searching..." : "SEARCH"}
        </button>
      </div>

      <div className="results-grid">
        {results.length === 0 && !isSearching && (
          <p style={{ opacity: 0.5, marginTop: "20px" }}>No songs found...</p>
        )}

        {results.map((song, index) => {
          const inQueue =
            queue?.some((s) => s.videoId === song.videoId) ||
            addedIds.has(song.videoId);

          return (
            <div key={index} className="result-card">
              <div className="result-thumb-container">
                <img
                  src={song.thumbnail || "https://via.placeholder.com/300x200?text=No+Image"}
                  className="result-thumb"
                  alt="thumbnail"
                />
                <div className="result-overlay">
                  <button
                    className="add-btn-small"
                    onClick={() => addSong(song)}
                    disabled={inQueue}
                    style={{ opacity: inQueue ? 0.4 : 1, cursor: inQueue ? "not-allowed" : "pointer" }}
                  >
                    {inQueue ? "✓ Added" : "+ Add to Queue"}
                  </button>
                </div>
              </div>
              <div className="result-info">
                <p className="result-title">{song.title}</p>
                <p style={{ fontSize: "0.8rem", opacity: 0.6 }}>{song.artist}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default SearchSongs;