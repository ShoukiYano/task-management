// server.js
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { pool } = require('./db'); // db.js から接続プールを読み込み

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());
app.use(express.static("public"));

// 🔹 ログイン API
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const userResult = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: "ユーザーが見つかりません" });
    }
    const user = userResult.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: "パスワードが正しくありません" });
    }
    console.log(`✅ ログイン成功 - ユーザー名: ${user.username}`);
    res.json({ username: user.username, email: user.email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "ログイン中にエラーが発生しました" });
  }
});

// 🔹 新規ユーザー登録 API
app.post('/register', async (req, res) => {
  const { email, username, password } = req.body;
  if (!email || !username || !password) {
    return res.status(400).json({ message: "全てのフィールドを入力してください" });
  }
  try {
    const userExists = await pool.query("SELECT * FROM users WHERE email = $1 OR username = $2", [email, username]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: "ユーザーは既に存在します" });
    }
    const hash = await bcrypt.hash(password, 10);
    const newUserResult = await pool.query(
      "INSERT INTO users (id, email, username, password) VALUES ($1, $2, $3, $4) RETURNING *",
      [uuidv4(), email, username, hash]
    );
    res.status(201).json({ message: "登録成功！", user: newUserResult.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "登録中にエラーが発生しました" });
  }
});

// 🔹 ユーザー一覧取得 API（担当者プルダウン用）
app.get('/users', async (req, res) => {
  try {
    const result = await pool.query("SELECT username, email FROM users");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "ユーザー取得エラー" });
  }
});

// 🔹 タスク取得 API（作成者・担当者・管理者のみ表示）
app.get('/tasks/:username', async (req, res) => {
  const username = decodeURIComponent(req.params.username);
  if (!username) {
    return res.status(400).json({ message: "ユーザー名が指定されていません" });
  }
  try {
    const result = await pool.query(
      `SELECT * FROM tasks WHERE creator = $1 OR assignee = $1 OR $1 = 'admin'`,
      [username]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "タスク取得エラー" });
  }
});

// 🔹 タスク追加 API
app.post('/tasks', async (req, res) => {
  const { name, description, status, priority, assignee, creator, deadline } = req.body;
  if (!name || !description || !status || !priority || !assignee || !creator || !deadline) {
    return res.status(400).json({ message: "すべてのフィールドを入力してください" });
  }
  try {
    const now = new Date().toISOString();
    const result = await pool.query(
      `INSERT INTO tasks (id, name, description, status, priority, assignee, creator, deadline, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9) RETURNING *`,
      [uuidv4(), name, description, status, priority, assignee, creator, deadline, now]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "タスク追加エラー" });
  }
});

// 🔹 タスク更新 API
app.put('/tasks/:id', async (req, res) => {
  const taskId = req.params.id;
  const { name, description, status, priority, assignee, deadline } = req.body;
  try {
    // まずタスクが存在するかチェック
    const taskResult = await pool.query("SELECT * FROM tasks WHERE id = $1", [taskId]);
    if (taskResult.rows.length === 0) {
      return res.status(404).json({ message: "タスクが見つかりません" });
    }
    const now = new Date().toISOString();
    const updatedTaskResult = await pool.query(
      `UPDATE tasks SET
         name = COALESCE($2, name),
         description = COALESCE($3, description),
         status = COALESCE($4, status),
         priority = COALESCE($5, priority),
         assignee = COALESCE($6, assignee),
         deadline = COALESCE($7, deadline),
         updated_at = $8
       WHERE id = $1 RETURNING *`,
      [taskId, name, description, status, priority, assignee, deadline, now]
    );
    res.json(updatedTaskResult.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "タスク更新エラー" });
  }
});

// 🔹 タスク削除 API
app.delete('/tasks/:id', async (req, res) => {
  const taskId = req.params.id;
  try {
    const taskResult = await pool.query("SELECT * FROM tasks WHERE id = $1", [taskId]);
    if (taskResult.rows.length === 0) {
      return res.status(404).json({ message: "タスクが見つかりません" });
    }
    await pool.query("DELETE FROM tasks WHERE id = $1", [taskId]);
    res.json({ message: "タスクが削除されました" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "タスク削除エラー" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});
