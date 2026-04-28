import { useState, useEffect, useRef } from "react";
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
  const [isHost, setIsHost] = useState(false);
  const [votedSongs, setVotedSongs] = useState(new Set());
  const [partyStarted, setPartyStarted] = useState(false); // ✅ autoplay fix

  // ✅ Auto-join from QR link
  useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const roomFromUrl = params.get("room");
  if (!roomFromUrl) return;

  // If already connected, join immediately
  if (socket.connected) {
    socket.emit("join-room", roomFromUrl);
  } else {
    // Wait for connection first
    socket.on("connect", () => {
      socket.emit("join-room", roomFromUrl);
    });
  }

  return () => socket.off("connect");
}, []);

  useEffect(() => {
    socket.on("room-created", (id) => {
      setCreatedRoom(id);
      setCurrentRoom(id);
      setIsHost(true); // ✅ creator is host
    });

    socket.on("joined-room", (id) => {
      setCurrentRoom(id);
      setIsHost(false);
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

    // ✅ Late joiner gets current state
    socket.on("room-state", ({ queue: q, currentSong: cs }) => {
      setQueue(q);
      if (cs) setCurrentSong(cs);
    });

    return () => {
      socket.off("room-created");
      socket.off("joined-room");
      socket.off("update-queue");
      socket.off("play-song");
      socket.off("room-state");
    };
  }, [currentSong]);

  const createRoom = () => socket.emit("create-room");
  const joinRoom = () => {
    if (roomId.trim()) socket.emit("join-room", roomId.trim());
  };

  const voteSong = (videoId) => {
    if (votedSongs.has(videoId)) return; // ✅ already voted
    socket.emit("vote-song", { roomId: currentRoom, videoId, userId: socket.id });
    setVotedSongs((prev) => new Set(prev).add(videoId));
  };

  const nextSong = () => {
    if (!isHost) return; // ✅ host only
    socket.emit("next-song", currentRoom);
  };

  return (
    <div className="app-container">
      <div className="blob blob-1"></div>
      <div className="blob blob-2"></div>

      <h1 className="title">Pass the Aux 🎵</h1>

      <QRSection roomId={currentRoom} />

      {!currentRoom && (
        <div
          className="glass-card"
          style={{ maxWidth: "500px", margin: "0 auto", textAlign: "center" }}
        >
          <button className="btn-primary" style={{ width: "100%" }} onClick={createRoom}>
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
              onKeyDown={(e) => e.key === "Enter" && joinRoom()}
            />
            <button className="btn-primary" onClick={joinRoom}>
              Join
            </button>
          </div>
        </div>
      )}

      {currentRoom && (
        <div className="room-layout">
          <div className="main-stage">
            <h2 style={{ marginBottom: "20px" }}>
              Now Playing in{" "}
              <span style={{ color: "#a855f7" }}>{currentRoom}</span>
              {isHost && (
                <span
                  style={{
                    marginLeft: "10px",
                    fontSize: "0.7rem",
                    background: "#a855f7",
                    padding: "2px 8px",
                    borderRadius: "10px",
                    verticalAlign: "middle",
                  }}
                >
                  HOST
                </span>
              )}
            </h2>

            <div className="player-frame">
              {currentSong ? (
                !partyStarted ? (
                  // ✅ Autoplay fix — browser requires user gesture first
                  <div
                    style={{
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "#000",
                      gap: "15px",
                    }}
                  >
                    <img
                      src={currentSong.thumbnail}
                      alt=""
                      style={{ width: "120px", borderRadius: "8px", opacity: 0.7 }}
                    />
                    <p style={{ opacity: 0.7 }}>{currentSong.title}</p>
                    <button
                      onClick={() => setPartyStarted(true)}
                      style={{
                        padding: "12px 30px",
                        borderRadius: "30px",
                        border: "none",
                        background: "#a855f7",
                        color: "#fff",
                        fontSize: "1rem",
                        cursor: "pointer",
                      }}
                    >
                      ▶ Start the Party
                    </button>
                  </div>
                ) : (
                  <iframe
                    width="100%"
                    height="100%"
                    src={`https://www.youtube.com/embed/${currentSong.videoId}?autoplay=1`}
                    title="player"
                    frameBorder="0"
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                  ></iframe>
                )
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
                  <p>Queue a song to start the vibe... 🎶</p>
                </div>
              )}
            </div>

            {/* ✅ Only host sees Next button */}
            {isHost && (
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
            )}

            <SearchSongs roomId={currentRoom} queue={queue} />
          </div>

          <div className="queue-sidebar">
            <h3 style={{ marginBottom: "20px", paddingLeft: "10px" }}>Up Next</h3>

            {queue.length === 0 && (
              <p style={{ opacity: 0.4, paddingLeft: "10px", fontSize: "0.85rem" }}>
                Queue is empty — add a song! 🎵
              </p>
            )}

            {queue.map((song, index) => {
              const hasVoted = votedSongs.has(song.videoId);
              return (
                <div key={index} className="song-card">
                  <img src={song.thumbnail} alt="" className="thumbnail" />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: "0.9rem", margin: "0 0 5px 0", fontWeight: "bold" }}>
                      {song.title}
                    </p>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "0.8rem", color: "#ec4899" }}>
                        🔥 {song.votes}
                      </span>
                      <button
                        onClick={() => voteSong(song.videoId)}
                        disabled={hasVoted}
                        style={{
                          background: hasVoted ? "rgba(168,85,247,0.2)" : "none",
                          border: "1px solid #a855f7",
                          color: hasVoted ? "#888" : "#a855f7",
                          borderRadius: "4px",
                          cursor: hasVoted ? "not-allowed" : "pointer",
                          fontSize: "0.7rem",
                          padding: "3px 8px",
                        }}
                      >
                        {hasVoted ? "✓ Voted" : "VOTE"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;