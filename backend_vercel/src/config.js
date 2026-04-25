const dotenv = require("dotenv");

dotenv.config();

module.exports = {
  TURSO_URL: process.env.TURSO_URL,
  TURSO_TOKEN: process.env.TURSO_TOKEN,
  CORS_ORIGIN: process.env.CORS_ORIGIN || "*",
  DEFAULT_REGION_PAGE_SIZE: 25,
  MAX_REGION_PAGE_SIZE: 100,
};