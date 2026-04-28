import { useState, useEffect } from "react";
import { socket } from "./socket";
import SearchSongs from "./SearchSongs";
import "./App.css";
import QRSection from "./QRSection";

function App() {
  const [roomId, setRoomId] = useState("");
  const [currentRoom, setCurrentRoom] = useState("");
  const [queue, setQueue] = useState([]);
  const [currentSong, setCurrentSong] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [votedSongs, setVotedSongs] = useState(new Set());
  const [partyStarted, setPartyStarted] = useState(false);

  // ✅ Auto-join from QR link
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomFromUrl = params.get("room");
    if (!roomFromUrl) return;

    if (socket.connected) {
      socket.emit("join-room", roomFromUrl);
    } else {
      socket.on("connect", () => {
        socket.emit("join-room", roomFromUrl);
      });
    }

    return () => socket.off("connect");
  }, []);

  useEffect(() => {
    socket.on("room-created", (id) => {
      setCurrentRoom(id);
      setIsHost(true);
    });

    socket.on("joined-room", (id) => {
      setCurrentRoom(id);
      setIsHost(false);
    });

    socket.on("update-queue", (q) => {
      setQueue(q);
    });

    socket.on("play-song", (song) => {
      setCurrentSong(song);
      if (song) setPartyStarted(true); // ✅ auto-start for all users
    });

    // ✅ Late joiner gets current state
    socket.on("room-state", ({ queue: q, currentSong: cs }) => {
      setQueue(q);
      if (cs) {
        setCurrentSong(cs);
        setPartyStarted(true); // ✅ late joiners also auto-start
      }
    });

    socket.on("promoted-to-host", () => {
      setIsHost(true); // ✅ handle host promotion
    });

    return () => {
      socket.off("room-created");
      socket.off("joined-room");
      socket.off("update-queue");
      socket.off("play-song");
      socket.off("room-state");
      socket.off("promoted-to-host");
    };
  }, []);

  const createRoom = () => socket.emit("create-room");
  const joinRoom = () => {
    if (roomId.trim()) socket.emit("join-room", roomId.trim());
  };

  const voteSong = (videoId) => {
    if (votedSongs.has(videoId)) return;
    socket.emit("vote-song", { roomId: currentRoom, videoId, userId: socket.id });
    setVotedSongs((prev) => new Set(prev).add(videoId));
  };

  const nextSong = () => {
    if (!isHost) return;
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
          style={{ maxWidth: "480px", margin: "0 auto", textAlign: "center" }}
        >
          <button
            className="btn-primary"
            style={{ width: "100%", fontSize: "1rem", padding: "16px" }}
            onClick={createRoom}
          >
            🚀 Start a New Party
          </button>

          <div style={{ margin: "24px 0", display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.1)" }} />
            <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.85rem" }}>OR</span>
            <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.1)" }} />
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <input
              className="input-glow"
              style={{ flex: 1 }}
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

            {/* Room header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>
                Now Playing in{" "}
                <span style={{ color: "#a855f7", fontWeight: 800 }}>{currentRoom}</span>
                {isHost && (
                  <span style={{
                    marginLeft: "8px",
                    fontSize: "0.65rem",
                    background: "linear-gradient(135deg, #7c3aed, #a855f7)",
                    padding: "3px 10px",
                    borderRadius: "20px",
                    verticalAlign: "middle",
                    fontWeight: 700,
                    letterSpacing: "0.5px",
                  }}>
                    HOST
                  </span>
                )}
              </h2>

              {/* ✅ Only host sees Next button — moved to header */}
              {isHost && (
                <button
                  onClick={nextSong}
                  style={{
                    padding: "8px 18px",
                    borderRadius: "20px",
                    border: "1px solid rgba(168,85,247,0.4)",
                    background: "rgba(168,85,247,0.15)",
                    color: "#a855f7",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={e => e.target.style.background = "rgba(168,85,247,0.3)"}
                  onMouseLeave={e => e.target.style.background = "rgba(168,85,247,0.15)"}
                >
                  ⏭ Skip
                </button>
              )}
            </div>

            {/* Player */}
            <div className="player-frame">
              {currentSong ? (
                !partyStarted ? (
                  <div style={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "linear-gradient(135deg, #0d0d1a, #1a0030)",
                    gap: "16px",
                  }}>
                    <img
                      src={currentSong.thumbnail}
                      alt=""
                      style={{ width: "100px", borderRadius: "12px", opacity: 0.85, boxShadow: "0 8px 30px rgba(0,0,0,0.6)" }}
                    />
                    <p style={{ opacity: 0.8, margin: 0, fontSize: "0.95rem", fontWeight: 500 }}>
                      {currentSong.title}
                    </p>
                    <button
                      onClick={() => setPartyStarted(true)}
                      className="btn-primary"
                      style={{ padding: "12px 32px", borderRadius: "30px", fontSize: "1rem" }}
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
                  />
                )
              ) : (
                <div style={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "linear-gradient(135deg, #0d0d1a, #1a0030)",
                  gap: "12px",
                }}>
                  <p style={{ opacity: 0.4, margin: 0, fontSize: "1.1rem" }}>🎶</p>
                  <p style={{ opacity: 0.4, margin: 0, fontSize: "0.9rem" }}>Queue a song to start the vibe</p>
                </div>
              )}
            </div>

            {/* Search */}
            <SearchSongs roomId={currentRoom} queue={queue} />
          </div>

          {/* Queue Sidebar */}
          <div className="queue-sidebar">
            <h3>Up Next</h3>

            {queue.length === 0 && (
              <p style={{ opacity: 0.35, fontSize: "0.85rem", textAlign: "center", marginTop: "30px" }}>
                Queue is empty<br />add a song! 🎵
              </p>
            )}

            {queue.map((song, index) => {
              const hasVoted = votedSongs.has(song.videoId);
              const isPlaying = currentSong?.videoId === song.videoId;
              return (
                <div
                  key={index}
                  className="song-card"
                  style={isPlaying ? { borderColor: "rgba(168,85,247,0.5)", background: "rgba(168,85,247,0.1)" } : {}}
                >
                  <div style={{ position: "relative" }}>
                    <img src={song.thumbnail} alt="" className="thumbnail" />
                    {isPlaying && (
                      <div style={{
                        position: "absolute",
                        inset: 0,
                        background: "rgba(168,85,247,0.4)",
                        borderRadius: "8px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "1.2rem",
                      }}>▶</div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: "0.82rem",
                      margin: "0 0 6px 0",
                      fontWeight: 600,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      color: isPlaying ? "#a855f7" : "inherit",
                    }}>
                      {song.title}
                    </p>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "0.75rem", color: "#ec4899", fontWeight: 600 }}>
                        🔥 {song.votes}
                      </span>
                      <button
                        onClick={() => voteSong(song.videoId)}
                        disabled={hasVoted}
                        style={{
                          background: hasVoted ? "rgba(168,85,247,0.15)" : "transparent",
                          border: "1px solid",
                          borderColor: hasVoted ? "rgba(168,85,247,0.3)" : "rgba(168,85,247,0.6)",
                          color: hasVoted ? "rgba(168,85,247,0.4)" : "#a855f7",
                          borderRadius: "6px",
                          cursor: hasVoted ? "not-allowed" : "pointer",
                          fontSize: "0.68rem",
                          padding: "3px 8px",
                          fontWeight: 700,
                          letterSpacing: "0.3px",
                          transition: "all 0.2s ease",
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