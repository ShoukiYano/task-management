const { Pool } = require('pg');

// 接続文字列を直接コード内に記述（例：Railway の PostgreSQL 接続情報）
const connectionString = "postgresql://postgres:XmuQMfyOkrrugmLpWFweqzidUqlozhsq@postgres.railway.internal:5432/railway?sslmode=require";

const pool = new Pool({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

module.exports = { pool };
