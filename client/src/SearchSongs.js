import { useState } from "react";
import axios from "axios";
import { socket } from "./socket";

function SearchSongs({ roomId }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const searchSongs = async () => {
    if (!query) return;
    setIsSearching(true);
    try {
      const res = await axios.get(
        `http://localhost:5000/youtube-search?q=${query}`
      );
      setResults(res.data);
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const addSong = (video) => {
    const song = {
      title: video.snippet.title,
      // Using medium thumbnail for better quality in the crazy UI
      thumbnail: video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default.url,
      videoId: video.id.videoId,
      votes: 0,
    };

    socket.emit("add-song", { roomId, song });
  };

  return (
    <div className="search-container">
      <h3 style={{ marginBottom: '15px', fontSize: '1.2rem', opacity: 0.8 }}>
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
          {isSearching ? "..." : "SEARCH"}
        </button>
      </div>

      <div className="results-grid">
        {results.map((video) => (
          <div key={video.id.videoId} className="result-card">
            <div className="result-thumb-container">
              <img 
                src={video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default.url} 
                className="result-thumb" 
                alt="" 
              />
              <div className="result-overlay">
                <button className="add-btn-small" onClick={() => addSong(video)}>
                  + Add to Queue
                </button>
              </div>
            </div>
            <div className="result-info">
              <p className="result-title">{video.snippet.title}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SearchSongs;