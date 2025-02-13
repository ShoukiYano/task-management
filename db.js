// db.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Railway の場合、SSL 接続が必要な場合があります（本番環境では true にする）
  ssl: { rejectUnauthorized: false }
});

module.exports = { pool };
