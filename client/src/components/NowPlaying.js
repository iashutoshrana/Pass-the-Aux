// Title and artist under the video.
export default function NowPlaying({ song }) {
  if (!song) return null;

  return (
    <div style={{ margin: "12px 4px 0" }}>
      <div
        style={{
          fontSize: "1rem",
          fontWeight: 700,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        🎵 {song.title}
      </div>
      <div style={{ fontSize: "0.85rem", opacity: 0.6 }}>{song.artist}</div>
    </div>
  );
}
