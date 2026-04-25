const { openDatabase } = require("../src/db");
const { createApp } = require("../src/app");

const db = openDatabase();
const handler = createApp(db);

module.exports = handler;