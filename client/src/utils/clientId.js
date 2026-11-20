// Stable id for this browser, so a refresh doesn't give you extra votes.
function getClientId() {
  try {
    let id = localStorage.getItem("aux-client-id");
    if (!id) {
      id =
        (window.crypto && window.crypto.randomUUID && window.crypto.randomUUID()) ||
        Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("aux-client-id", id);
    }
    return id;
  } catch {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

export const clientId = getClientId();
