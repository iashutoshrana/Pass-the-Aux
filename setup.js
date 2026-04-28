const { execSync, spawn } = require("child_process");
const fs = require("fs");
const axios = require("axios");

// Start ngrok for server
const ngrok = spawn("ngrok", ["http", "5000"], { shell: true });

// Wait for ngrok to start then get URL
setTimeout(async () => {
  try {
    const res = await axios.get("http://localhost:4040/api/tunnels");
    const serverUrl = res.data.tunnels[0].public_url;
    console.log("Server ngrok URL:", serverUrl);

    // Auto-update client/.env
    const envPath = "./client/.env";
    let env = fs.readFileSync(envPath, "utf8");
    env = env.replace(/REACT_APP_SERVER_URL=.*/,`REACT_APP_SERVER_URL=${serverUrl}`);
    fs.writeFileSync(envPath, env);
    console.log("client/.env updated ✅");
  } catch (err) {
    console.error("Failed to get ngrok URL:", err.message);
  }
}, 3000);