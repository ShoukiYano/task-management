// db.js
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";  // これを追加

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

module.exports = { pool };
