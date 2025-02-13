const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // 環境変数から接続文字列を取得
  ssl: { rejectUnauthorized: false } // Railway では SSL が必要な場合が多い
});

module.exports = { pool };
