// db.js
// ローカル環境の場合のみ dotenv を使う
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
  }
  console.log("DATABASE_URL:", process.env.DATABASE_URL);
  
  const { Pool } = require('pg');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  module.exports = { pool };
  