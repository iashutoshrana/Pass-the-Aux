// The video box. Shows one of: the join overlay, the synced player,
// "party ended", or the empty "queue a song" message.
import SyncedPlayer from "../SyncedPlayer";
import JoinOverlay from "./JoinOverlay";
import PartyEnded from "./PartyEnded";

const centered = {
  height: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(135deg, #0d0d1a, #1a0030)",
  gap: "12px",
};

export default function PlayerArea({
  roomCode,
  currentSong,
  partyStarted,
  hasPlayed,
  onStart,
  onExit,
}) {
  let content;

  if (currentSong && !partyStarted) {
    content = <JoinOverlay song={currentSong} onStart={onStart} />;
  } else if (currentSong) {
    content = <SyncedPlayer song={currentSong} roomId={roomCode} />;
  } else {
    content = (
      <div style={centered}>
        {hasPlayed ? (
          <PartyEnded onExit={onExit} />
        ) : (
          <>
            <p style={{ opacity: 0.4, margin: 0, fontSize: "1.1rem" }}>🎶</p>
            <p style={{ opacity: 0.4, margin: 0, fontSize: "0.9rem" }}>
              Queue a song to start the vibe
            </p>
          </>
        )}
      </div>
    );
  }

  return <div className="player-frame">{content}</div>;
}
