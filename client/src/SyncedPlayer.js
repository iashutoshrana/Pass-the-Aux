import { useEffect, useRef } from "react";
import { socket } from "./socket";

let apiPromise;
function loadYT() {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    if (window.YT && window.YT.Player) return resolve(window.YT);
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    window.onYouTubeIframeAPIReady = () => resolve(window.YT);
    document.body.appendChild(tag);
  });
  return apiPromise;
}

const DRIFT_LIMIT = 3; // seconds

// song = { videoId, position, receivedAt, ... }
export default function SyncedPlayer({ song, roomId }) {
  const holderRef = useRef(null);
  const playerRef = useRef(null);
  const songRef = useRef(song);
  const roomRef = useRef(roomId);
  roomRef.current = roomId;

  // where the song should be right now
  const expected = () => {
    const s = songRef.current;
    return (
      (s.position || 0) + (Date.now() - (s.receivedAt || Date.now())) / 1000
    );
  };

  const reportEnded = () =>
    socket.emit("song-ended", {
      roomId: roomRef.current,
      videoId: songRef.current.videoId,
    });

  // create the player once
  useEffect(() => {
    let destroyed = false;

    loadYT().then((YT) => {
      if (destroyed || !holderRef.current) return;
      // YouTube replaces the element it is given with an iframe. Give it a
      // throwaway child so React's own wrapper div is never swapped out
      // (that swap caused the "removeChild" crash when the player unmounted).
      const mount = document.createElement("div");
      holderRef.current.appendChild(mount);
      playerRef.current = new YT.Player(mount, {
        width: "100%",
        height: "100%",
        videoId: songRef.current.videoId,
        playerVars: {
          autoplay: 1,
          start: Math.floor(expected()),
          controls: 0,
          rel: 0,
          playsinline: 1,
        },
        events: {
          onReady: (e) => e.target.playVideo(),
          onStateChange: (e) => {
            if (e.data === 0) reportEnded(); // ended
          },
          // unplayable / non-embeddable video: skip it for everyone
          onError: () => reportEnded(),
        },
      });
    });

    // drift check every 5 seconds
    const interval = setInterval(() => {
      const p = playerRef.current;
      if (!p || !p.getCurrentTime) return;
      const target = expected();
      if (Math.abs(p.getCurrentTime() - target) > DRIFT_LIMIT) {
        p.seekTo(target, true);
      }
    }, 5000);

    return () => {
      destroyed = true;
      clearInterval(interval);
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // when the song changes (new song, or fresh position from the server)
  useEffect(() => {
    songRef.current = song;
    const p = playerRef.current;
    if (p && p.loadVideoById) {
      p.loadVideoById({ videoId: song.videoId, startSeconds: expected() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song]);

  return <div ref={holderRef} style={{ width: "100%", height: "100%" }} />;
}
