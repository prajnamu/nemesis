const { createClient } = require("@libsql/client");
const { TURSO_URL, TURSO_TOKEN } = require("./config");

function openDatabase() {
  if (!TURSO_URL || !TURSO_TOKEN) {
    throw new Error("TURSO_URL and TURSO_TOKEN environment variables are required.");
  }

  return createClient({
    url: TURSO_URL,
    authToken: TURSO_TOKEN,
  });
}

module.exports = { openDatabase };