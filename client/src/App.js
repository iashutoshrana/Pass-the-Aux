import { useState, useEffect, useRef } from "react";
import { socket, onConnectionChange } from "./socket";
import SearchSongs from "./SearchSongs";
import SyncedPlayer from "./SyncedPlayer";
import "./App.css";
import QRSection from "./QRSection";

// stamp the moment we received the song so the player knows how old `position` is
const receive = (song) => (song ? { ...song, receivedAt: Date.now() } : null);

function App() {
  const [roomId, setRoomId] = useState("");
  const [currentRoom, setCurrentRoom] = useState("");
  const [queue, setQueue] = useState([]);
  const [currentSong, setCurrentSong] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [votedSongs, setVotedSongs] = useState(new Set());
  const [partyStarted, setPartyStarted] = useState(false);
  const [roomError, setRoomError] = useState("");
  const [connectionStatus, setConnectionStatus] = useState({
    status: "connected",
  });

  const roomRef = useRef("");
  useEffect(() => {
    roomRef.current = currentRoom;
  }, [currentRoom]);

  // Auto-join from QR link
  useEffect(() => {
    const roomFromUrl = new URLSearchParams(window.location.search).get("room");
    if (!roomFromUrl) return;

    const join = () => socket.emit("join-room", roomFromUrl);
    if (socket.connected) join();
    else socket.once("connect", join);

    return () => socket.off("connect", join);
  }, []);

  // After a reconnect the socket has a new id and left its rooms: rejoin
  useEffect(() => {
    const rejoin = () => {
      if (roomRef.current) socket.emit("join-room", roomRef.current);
    };
    socket.on("connect", rejoin);
    return () => socket.off("connect", rejoin);
  }, []);

  // Track connection status for reconnect banner
  useEffect(() => {
    const unsubscribe = onConnectionChange((state) => {
      setConnectionStatus(state);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    socket.on("room-created", (id) => {
      setCurrentRoom(id);
      setIsHost(true);
    });

    socket.on("joined-room", (id) => {
      setCurrentRoom(id);
      setIsHost(false);
      setRoomError("");
    });

    socket.on("room-error", (msg) => setRoomError(msg));

    socket.on("update-queue", (q) => {
      setQueue(q);
    });

    socket.on("play-song", (song) => {
      setCurrentSong(receive(song));
    });

    // Late joiner gets current state (with position)
    socket.on("room-state", ({ queue: q, currentSong: cs }) => {
      setQueue(q);
      setCurrentSong(receive(cs));
    });

    socket.on("promoted-to-host", () => {
      setIsHost(true);
    });

    return () => {
      socket.off("room-created");
      socket.off("joined-room");
      socket.off("room-error");
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
    socket.emit("vote-song", { roomId: currentRoom, videoId });
    setVotedSongs((prev) => new Set(prev).add(videoId));
  };

  const nextSong = () => {
    if (!isHost) return;
    socket.emit("next-song", currentRoom);
  };

  return (
    <div className="app-container">
      {connectionStatus.status !== "connected" && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1000,
            textAlign: "center",
            padding: "10px",
            fontSize: "0.85rem",
            fontWeight: 600,
            background:
              connectionStatus.status === "failed"
                ? "rgba(220,38,38,0.9)"
                : "rgba(234,179,8,0.9)",
            color: "#fff",
          }}
        >
          {connectionStatus.status === "reconnecting" &&
            `🔄 Reconnecting to server... (attempt ${connectionStatus.attempt})`}
          {connectionStatus.status === "disconnected" &&
            "⚠️ Disconnected from server..."}
          {connectionStatus.status === "error" &&
            "⚠️ Connection error, retrying..."}
          {connectionStatus.status === "failed" &&
            "❌ Could not reconnect. Please refresh the page."}
        </div>
      )}

      <div className="blob blob-1"></div>
      <div className="blob blob-2"></div>

      <h1 className="title">Pass the Aux 🎵</h1>

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

          <div
            style={{
              margin: "24px 0",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div
              style={{
                flex: 1,
                height: "1px",
                background: "rgba(255,255,255,0.1)",
              }}
            />
            <span
              style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.85rem" }}
            >
              OR
            </span>
            <div
              style={{
                flex: 1,
                height: "1px",
                background: "rgba(255,255,255,0.1)",
              }}
            />
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

          {roomError && (
            <p
              style={{
                color: "#f87171",
                marginTop: "14px",
                fontSize: "0.9rem",
              }}
            >
              ❌ {roomError}
            </p>
          )}
        </div>
      )}

      {currentRoom && (
        <div className="room-layout">
          {/* LEFT COLUMN: search on top, then header + player */}
          <div className="main-stage">
            {/* Search: top left, same width as the player */}
            <SearchSongs roomId={currentRoom} queue={queue} />

            {/* Room header */}
            <div
              className="room-header"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "8px",
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: "1.1rem",
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.8)",
                }}
              >
                Now Playing in{" "}
                <span style={{ color: "#a855f7", fontWeight: 800 }}>
                  {currentRoom}
                </span>
                {isHost && (
                  <span
                    style={{
                      marginLeft: "8px",
                      fontSize: "0.65rem",
                      background: "linear-gradient(135deg, #7c3aed, #a855f7)",
                      padding: "3px 10px",
                      borderRadius: "20px",
                      verticalAlign: "middle",
                      fontWeight: 700,
                      letterSpacing: "0.5px",
                    }}
                  >
                    HOST
                  </span>
                )}
              </h2>

              {/* Only host sees Skip (server also checks) */}
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
                  onMouseEnter={(e) =>
                    (e.target.style.background = "rgba(168,85,247,0.3)")
                  }
                  onMouseLeave={(e) =>
                    (e.target.style.background = "rgba(168,85,247,0.15)")
                  }
                >
                  ⏭ Skip
                </button>
              )}
            </div>

            {/* Player */}
            <div className="player-frame">
              {currentSong ? (
                !partyStarted ? (
                  <div
                    style={{
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "linear-gradient(135deg, #0d0d1a, #1a0030)",
                      gap: "16px",
                    }}
                  >
                    <img
                      src={currentSong.thumbnail}
                      alt=""
                      style={{
                        width: "100px",
                        borderRadius: "12px",
                        opacity: 0.85,
                        boxShadow: "0 8px 30px rgba(0,0,0,0.6)",
                      }}
                    />
                    <p
                      style={{
                        opacity: 0.8,
                        margin: 0,
                        fontSize: "0.95rem",
                        fontWeight: 500,
                      }}
                    >
                      {currentSong.title}
                    </p>
                    {/* One tap is required: browsers block autoplay with sound until the user interacts */}
                    <button
                      onClick={() => setPartyStarted(true)}
                      className="btn-primary"
                      style={{
                        padding: "12px 32px",
                        borderRadius: "30px",
                        fontSize: "1rem",
                      }}
                    >
                      ▶ Join the Party
                    </button>
                  </div>
                ) : (
                  <SyncedPlayer song={currentSong} roomId={currentRoom} />
                )
              ) : (
                <div
                  style={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "linear-gradient(135deg, #0d0d1a, #1a0030)",
                    gap: "12px",
                  }}
                >
                  <p style={{ opacity: 0.4, margin: 0, fontSize: "1.1rem" }}>
                    🎶
                  </p>
                  <p style={{ opacity: 0.4, margin: 0, fontSize: "0.9rem" }}>
                    Queue a song to start the vibe
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: QR on top, then the queue */}
          <div className="queue-sidebar">
            <QRSection roomId={currentRoom} />

            <h3>Up Next</h3>

            {queue.length === 0 && (
              <p
                style={{
                  opacity: 0.35,
                  fontSize: "0.85rem",
                  textAlign: "center",
                  marginTop: "30px",
                }}
              >
                Queue is empty
                <br />
                add a song! 🎵
              </p>
            )}

            {queue.map((song) => {
              const hasVoted = votedSongs.has(song.videoId);
              const isPlaying = currentSong?.videoId === song.videoId;
              return (
                <div
                  key={song.videoId}
                  className="song-card"
                  style={
                    isPlaying
                      ? {
                          borderColor: "rgba(168,85,247,0.5)",
                          background: "rgba(168,85,247,0.1)",
                        }
                      : {}
                  }
                >
                  <div style={{ position: "relative" }}>
                    <img src={song.thumbnail} alt="" className="thumbnail" />
                    {isPlaying && (
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          background: "rgba(168,85,247,0.4)",
                          borderRadius: "8px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "1.2rem",
                        }}
                      >
                        ▶
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: "0.82rem",
                        margin: "0 0 6px 0",
                        fontWeight: 600,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        color: isPlaying ? "#a855f7" : "inherit",
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
                          fontSize: "0.75rem",
                          color: "#ec4899",
                          fontWeight: 600,
                        }}
                      >
                        🔥 {song.votes}
                      </span>
                      <button
                        onClick={() => voteSong(song.videoId)}
                        disabled={hasVoted}
                        style={{
                          background: hasVoted
                            ? "rgba(168,85,247,0.15)"
                            : "transparent",
                          border: "1px solid",
                          borderColor: hasVoted
                            ? "rgba(168,85,247,0.3)"
                            : "rgba(168,85,247,0.6)",
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
