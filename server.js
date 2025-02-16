const express = require('express');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const bcrypt = require('bcrypt');
const path = require('path');
const { Pool } = require('pg');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(express.static(path.join(__dirname, 'public')));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:XmuQMfyOkrrugmLpWFweqzidUqlozhsq@viaduct.proxy.rlwy.net:18155/railway?sslmode=require",
  ssl: { rejectUnauthorized: false }
});

// サーバー起動時に admin ユーザーが存在しなければ作成
(async () => {
  try {
    const result = await pool.query("SELECT * FROM users WHERE username = 'admin'");
    if (result.rows.length === 0) {
      const hash = await bcrypt.hash("admin", 10);
      await pool.query(
        "INSERT INTO users (id, email, username, password) VALUES ($1, $2, $3, $4)",
        [uuidv4(), "admin@driveline.jp", "admin", hash]
      );
      console.log("Admin user created");
    }
  } catch (err) {
    console.error("Error ensuring admin user exists", err);
  }
})();

/* ================================
   ユーザー管理 API
================================ */
// ログイン API
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ message: "ユーザーが見つかりません" });
    }
    const user = result.rows[0];
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

// 新規登録 API
app.post('/register', async (req, res) => {
  const { email, username, password } = req.body;
  if (!email || !username || !password) {
    return res.status(400).json({ message: "全てのフィールドを入力してください" });
  }
  try {
    const existing = await pool.query("SELECT * FROM users WHERE email = $1 OR username = $2", [email, username]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: "ユーザーは既に存在します" });
    }
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      "INSERT INTO users (id, email, username, password) VALUES ($1, $2, $3, $4)",
      [uuidv4(), email, username, hash]
    );
    res.status(201).json({ message: "登録成功！" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "登録中にエラーが発生しました" });
  }
});

// ユーザー一覧取得 API
app.get('/users', async (req, res) => {
  try {
    const result = await pool.query("SELECT username, email FROM users");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "ユーザー取得エラー" });
  }
});

/* ================================
   タスク管理 API
================================ */
// タスク取得 API
app.get('/tasks/:username', async (req, res) => {
  const username = decodeURIComponent(req.params.username);
  console.log(`🔹 タスクを取得 - ユーザー名: ${username}`);
  try {
    let query, params;
    if (username === "admin") {
      query = "SELECT * FROM tasks ORDER BY created_at DESC";
      params = [];
    } else {
      query = "SELECT * FROM tasks WHERE creator = $1 OR assignee = $1";
      params = [username];
    }
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "タスク取得エラー" });
  }
});

// タスク追加 API
app.post('/tasks', async (req, res) => {
  const { name, description, status, priority, assignee, creator, deadline } = req.body;
  if (!name || !description || !status || !priority || !assignee || !creator || !deadline) {
    return res.status(400).json({ message: "すべてのフィールドを入力してください" });
  }
  try {
    const now = new Date().toISOString();
    const id = uuidv4();
    const result = await pool.query(
      "INSERT INTO tasks (id, name, description, status, priority, assignee, creator, deadline, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *",
      [id, name, description, status, priority, assignee, creator, deadline, now, now]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "タスク作成中にエラーが発生しました" });
  }
});

// タスク更新 API
app.put('/tasks/:id', async (req, res) => {
  const taskId = req.params.id;
  const { name, description, status, priority, assignee, deadline } = req.body;
  try {
    const fields = [];
    const values = [];
    let idx = 1;
    if (name) { fields.push(`name = $${idx}`); values.push(name); idx++; }
    if (description) { fields.push(`description = $${idx}`); values.push(description); idx++; }
    if (status) { fields.push(`status = $${idx}`); values.push(status); idx++; }
    if (priority) { fields.push(`priority = $${idx}`); values.push(priority); idx++; }
    if (assignee) { fields.push(`assignee = $${idx}`); values.push(assignee); idx++; }
    if (deadline) { fields.push(`deadline = $${idx}`); values.push(deadline); idx++; }
    fields.push(`updated_at = $${idx}`);
    values.push(new Date().toISOString());
    idx++;
    values.push(taskId);
    const query = `UPDATE tasks SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
    const result = await pool.query(query, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "タスクが見つかりません" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "タスク更新中にエラーが発生しました" });
  }
});

// タスク削除 API
app.delete('/tasks/:id', async (req, res) => {
  const taskId = req.params.id;
  try {
    const result = await pool.query("DELETE FROM tasks WHERE id = $1 RETURNING *", [taskId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: "タスクが見つかりません" });
    }
    res.json({ message: "タスクが削除されました" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "タスク削除中にエラーが発生しました" });
  }
});

/* ================================
   面談管理 API
================================ */
// 面談追加 API
app.post('/meetings', async (req, res) => {
  const {
    meeting_date, location, interviewer, interviewee,
    interviewee_name, interviewee_affiliation, interviewee_position,
    job_description, goal, goal_status,
    actions_taken, successful_results, challenges,
    feedback, next_action, next_goal
  } = req.body;
  
  if (!meeting_date || !interviewer || !interviewee) {
    return res.status(400).json({ message: "必要なフィールドが不足しています" });
  }
  
  const now = new Date().toISOString();
  const id = uuidv4();
  try {
    const result = await pool.query(
      "INSERT INTO meetings (id, meeting_date, location, interviewer, interviewee, interviewee_name, interviewee_affiliation, interviewee_position, job_description, goal, goal_status, actions_taken, successful_results, challenges, feedback, next_action, next_goal, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19) RETURNING *",
      [id, meeting_date, location, interviewer, interviewee,
       interviewee_name, interviewee_affiliation, interviewee_position,
       job_description, goal, goal_status, actions_taken,
       successful_results, challenges, feedback, next_action, next_goal,
       now, now]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "面談作成中にエラーが発生しました" });
  }
});

// 面談取得 API
app.get('/meetings/:username', async (req, res) => {
  const username = req.params.username;
  try {
    let query, params;
    if (username === 'admin') {
      query = "SELECT * FROM meetings ORDER BY meeting_date DESC";
      params = [];
    } else {
      query = "SELECT * FROM meetings WHERE interviewer = $1 OR interviewee = $1 ORDER BY meeting_date DESC";
      params = [username];
    }
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "面談情報取得エラー" });
  }
});

// 面談更新 API
app.put('/meetings/:id', async (req, res) => {
  const meetingId = req.params.id;
  const allowedFields = [
    'meeting_date', 'location', 'interviewer', 'interviewee',
    'interviewee_name', 'interviewee_affiliation', 'interviewee_position',
    'job_description', 'goal', 'goal_status', 'actions_taken',
    'successful_results', 'challenges', 'feedback', 'next_action', 'next_goal'
  ];
  
  const setParts = [];
  const params = [];
  let idx = 1;
  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) {
      setParts.push(`${field} = $${idx}`);
      params.push(req.body[field]);
      idx++;
    }
  });
  
  if (setParts.length === 0) {
    return res.status(400).json({ message: "更新するフィールドがありません" });
  }
  
  setParts.push(`updated_at = $${idx}`);
  params.push(new Date().toISOString());
  idx++;
  params.push(meetingId);
  const query = `UPDATE meetings SET ${setParts.join(', ')} WHERE id = $${idx} RETURNING *`;
  
  try {
    const result = await pool.query(query, params);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "面談が見つかりません" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "面談更新中にエラーが発生しました" });
  }
});

// 面談削除 API
app.delete('/meetings/:id', async (req, res) => {
  const meetingId = req.params.id;
  try {
    const result = await pool.query("DELETE FROM meetings WHERE id = $1 RETURNING *", [meetingId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: "面談が見つかりません" });
    }
    res.json({ message: "面談が削除されました" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "面談削除中にエラーが発生しました" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});
