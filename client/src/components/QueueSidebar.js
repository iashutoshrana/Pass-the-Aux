// Right column: QR card on top, then the "Up Next" list.
import QRSection from "../QRSection";
import SongCard from "./SongCard";
import { clientId } from "../utils/clientId";

export default function QueueSidebar({
  roomCode,
  queue,
  currentSong,
  votedSongs,
  onVote,
}) {
  return (
    <div className="queue-sidebar">
      <QRSection roomId={roomCode} />

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

      {queue.map((song) => (
        <SongCard
          key={song.videoId}
          song={song}
          isPlaying={currentSong?.videoId === song.videoId}
          hasVoted={
            votedSongs.has(song.videoId) || !!song.voters?.includes(clientId)
          }
          onVote={() => onVote(song.videoId)}
        />
      ))}
    </div>
  );
}
