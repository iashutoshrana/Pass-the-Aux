import { useState, useEffect } from "react";
import { socket } from "./socket";
import SearchSongs from "./SearchSongs";
import "./App.css";
import QRSection from "./QRSection";

function App() {
  const [roomId, setRoomId] = useState("");
  const [createdRoom, setCreatedRoom] = useState("");
  const [currentRoom, setCurrentRoom] = useState("");
  const [queue, setQueue] = useState([]);
  const [currentSong, setCurrentSong] = useState(null);

  useEffect(() => {
    socket.on("room-created", (id) => {
      setCreatedRoom(id);
      setCurrentRoom(id);
    });

    socket.on("joined-room", (id) => {
      setCurrentRoom(id);
    });

    socket.on("update-queue", (q) => {
      setQueue(q);

      if (!currentSong && q.length > 0) {
        setCurrentSong(q[0]);
      }
    });

    socket.on("play-song", (song) => {
      setCurrentSong(song);
    });

    return () => {
      socket.off("room-created");
      socket.off("joined-room");
      socket.off("update-queue");
      socket.off("play-song");
    };
  }, [currentSong]);

  const createRoom = () => socket.emit("create-room");
  const joinRoom = () => socket.emit("join-room", roomId);

  const voteSong = (videoId) => {
    socket.emit("vote-song", {
      roomId: currentRoom,
      videoId,
      userId: socket.id,
    });
  };

  const nextSong = () => {
    socket.emit("next-song", currentRoom);
  };

  return (
    <div className="app-container">
      <div className="blob blob-1"></div>
      <div className="blob blob-2"></div>

      <h1 className="title">Pass the Aux 🎵</h1>

      {/* ✅ ALWAYS SHOW QR WHEN ROOM EXISTS */}
      <QRSection roomId={createdRoom} />

      {/* 👇 SHOW CREATE/JOIN ONLY IF NO ROOM */}
      {!currentRoom && (
        <div
          className="glass-card"
          style={{
            maxWidth: "500px",
            margin: "0 auto",
            textAlign: "center",
          }}
        >
          <button
            className="btn-primary"
            style={{ width: "100%" }}
            onClick={createRoom}
          >
            🚀 Start a New Party
          </button>

          <div style={{ margin: "25px 0", opacity: 0.3 }}>— OR —</div>

          <div style={{ display: "flex", gap: "10px" }}>
            <input
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: "10px",
                border: "1px solid #333",
                background: "#000",
                color: "#fff",
              }}
              placeholder="Enter Room ID"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
            />
            <button className="btn-primary" onClick={joinRoom}>
              Join
            </button>
          </div>
        </div>
      )}

      {/* 👇 ROOM UI */}
      {currentRoom && (
        <div className="room-layout">
          <div className="main-stage">
            <h2 style={{ marginBottom: "20px" }}>
              Now Playing in{" "}
              <span style={{ color: "#a855f7" }}>{currentRoom}</span>
            </h2>

            <div className="player-frame">
              {currentSong ? (
                <iframe
                  width="100%"
                  height="100%"
                  src={`https://www.youtube.com/embed/${currentSong.videoId}?autoplay=1`}
                  title="player"
                  frameBorder="0"
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                ></iframe>
              ) : (
                <div
                  style={{
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#000",
                  }}
                >
                  <p>Queue a song to start the vibe...</p>
                </div>
              )}
            </div>

            {/* NEXT BUTTON */}
            <button
              onClick={nextSong}
              style={{
                marginTop: "15px",
                padding: "10px 20px",
                borderRadius: "8px",
                border: "none",
                background: "#a855f7",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              ⏭ Next Song
            </button>

            <SearchSongs roomId={currentRoom} />
          </div>

          <div className="queue-sidebar">
            <h3 style={{ marginBottom: "20px", paddingLeft: "10px" }}>
              Up Next
            </h3>

            {queue.map((song, index) => (
              <div key={index} className="song-card">
                <img src={song.thumbnail} alt="" className="thumbnail" />

                <div style={{ flex: 1 }}>
                  <p
                    style={{
                      fontSize: "0.9rem",
                      margin: "0 0 5px 0",
                      fontWeight: "bold",
                    }}
                  >
                    {song.title}
                  </p>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.8rem",
                        color: "#ec4899",
                      }}
                    >
                      🔥 {song.votes}
                    </span>

                    <button
                      onClick={() => voteSong(song.videoId)}
                      style={{
                        background: "none",
                        border: "1px solid #a855f7",
                        color: "#a855f7",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "0.7rem",
                      }}
                    >
                      VOTE
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;