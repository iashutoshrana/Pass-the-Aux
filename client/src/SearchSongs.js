import { useState } from "react";
import axios from "axios";
import { socket } from "./socket";

function SearchSongs({ roomId }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);

  const searchSongs = async () => {
    if (!query) return;

    try {
      const res = await axios.get(
        `http://localhost:5000/youtube-search?q=${query}`
      );

      setResults(res.data);
    } catch (err) {
      console.error("Search error:", err);
    }
  };

  const addSong = (video) => {
    const song = {
      title: video.snippet.title,
      thumbnail: video.snippet.thumbnails.default.url,
      videoId: video.id.videoId,
      votes: 0,
    };

    socket.emit("add-song", { roomId, song });
  };

  return (
    <div style={{ marginTop: "20px" }}>
      <h3>Search Songs</h3>

      <input
        placeholder="Search song..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <button onClick={searchSongs}>Search</button>

      {/* RESULTS */}
      {results.map((video) => (
        <div key={video.id.videoId} style={{ margin: "10px" }}>
          <img src={video.snippet.thumbnails.default.url} alt="" />
          <p>{video.snippet.title}</p>

          <button onClick={() => addSong(video)}>Add</button>
        </div>
      ))}
    </div>
  );
}

export default SearchSongs;