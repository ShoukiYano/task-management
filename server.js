// server.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const bcrypt = require('bcrypt');

// ★ PostgreSQL モジュール（面談管理用）
const { Pool } = require('pg');

const app = express();
const PORT = 3000;
const USERS_FILE = 'users.json';
const TASKS_FILE = 'tasks.json';

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// ユーティリティ関数（JSONファイル用）
const loadData = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    return [];
  }
};

const saveData = (file, data) => {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
};

// 初回データ作成（管理者ユーザー）
if (!fs.existsSync(USERS_FILE)) {
  bcrypt.hash("admin", 10, (err, hash) => {
    if (err) throw err;
    saveData(USERS_FILE, [{
      id: uuidv4(),
      email: "admin@driveline.jp",
      username: "admin",
      password: hash
    }]);
  });
}
if (!fs.existsSync(TASKS_FILE)) {
  saveData(TASKS_FILE, []);
}

/* ================================
   既存のユーザー／タスク管理API
================================ */

// 🔹 ログイン API
app.post('/login', async (req, res) => {
  const users = loadData(USERS_FILE);
  const { email, password } = req.body;
  const user = users.find(u => u.email === email);

  if (!user) {
    return res.status(401).json({ message: "ユーザーが見つかりません" });
  }

  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) {
    return res.status(401).json({ message: "パスワードが正しくありません" });
  }

  console.log(`✅ ログイン成功 - ユーザー名: ${user.username}`);
  res.json({ username: user.username, email: user.email });
});

// 🔹 新規ユーザー登録 API
app.post('/register', async (req, res) => {
  const { email, username, password } = req.body;
  if (!email || !username || !password) {
    return res.status(400).json({ message: "全てのフィールドを入力してください" });
  }
  const users = loadData(USERS_FILE);
  const existingUser = users.find(u => u.email === email || u.username === username);
  if (existingUser) {
    return res.status(400).json({ message: "ユーザーは既に存在します" });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const newUser = {
      id: uuidv4(),
      email,
      username,
      password: hash
    };
    users.push(newUser);
    saveData(USERS_FILE, users);
    res.status(201).json({ message: "登録成功！" });
  } catch (error) {
    res.status(500).json({ message: "登録中にエラーが発生しました" });
  }
});

// 🔹 ユーザー一覧取得 API（担当者プルダウン用）
app.get('/users', (req, res) => {
  const users = loadData(USERS_FILE);
  const usersInfo = users.map(user => ({ username: user.username, email: user.email }));
  res.json(usersInfo);
});

// 🔹 タスク取得 API（作成者・担当者・管理者のみ表示）
app.get('/tasks/:username', (req, res) => {
  const tasks = loadData(TASKS_FILE);
  const username = decodeURIComponent(req.params.username);

  console.log(`🔹 タスクを取得 - ユーザー名: ${username}`);

  if (!username) {
    return res.status(400).json({ message: "ユーザー名が指定されていません" });
  }

  const filteredTasks = tasks.filter(task =>
    task.creator === username || task.assignee === username || username === "admin"
  );

  res.json(filteredTasks);
});

// 🔹 タスク追加 API
app.post('/tasks', (req, res) => {
  const tasks = loadData(TASKS_FILE);
  const { name, description, status, priority, assignee, creator, deadline } = req.body;

  if (!name || !description || !status || !priority || !assignee || !creator || !deadline) {
    return res.status(400).json({ message: "すべてのフィールドを入力してください" });
  }

  const now = new Date().toISOString();
  const newTask = {
    id: uuidv4(),
    name,
    description,
    status,
    priority,
    assignee,
    creator,
    deadline,
    created_at: now,
    updated_at: now
  };

  tasks.push(newTask);
  saveData(TASKS_FILE, tasks);
  res.status(201).json(newTask);
});

// 🔹 タスク更新 API
app.put('/tasks/:id', (req, res) => {
  const tasks = loadData(TASKS_FILE);
  const taskId = req.params.id;
  const taskIndex = tasks.findIndex(task => task.id === taskId);

  if (taskIndex === -1) {
    return res.status(404).json({ message: "タスクが見つかりません" });
  }

  const { name, description, status, priority, assignee, deadline } = req.body;

  if (name) tasks[taskIndex].name = name;
  if (description) tasks[taskIndex].description = description;
  if (status) tasks[taskIndex].status = status;
  if (priority) tasks[taskIndex].priority = priority;
  if (assignee) tasks[taskIndex].assignee = assignee;
  if (deadline) tasks[taskIndex].deadline = deadline;
  tasks[taskIndex].updated_at = new Date().toISOString();

  saveData(TASKS_FILE, tasks);
  res.json(tasks[taskIndex]);
});

// 🔹 タスク削除 API
app.delete('/tasks/:id', (req, res) => {
  let tasks = loadData(TASKS_FILE);
  const taskId = req.params.id;
  const taskIndex = tasks.findIndex(task => task.id === taskId);

  if (taskIndex === -1) {
    return res.status(404).json({ message: "タスクが見つかりません" });
  }

  tasks.splice(taskIndex, 1);
  saveData(TASKS_FILE, tasks);
  res.json({ message: "タスクが削除されました" });
});

/* ================================
   面談管理機能（Meeting Management）
   PostgreSQL を利用して面談情報を保存
================================ */

// ★ PostgreSQL用プールの作成（接続文字列を必要に応じて変更）
const pool = new Pool({
  connectionString: "postgresql://postgres:XmuQMfyOkrrugmLpWFweqzidUqlozhsq@viaduct.proxy.rlwy.net:18155/railway?sslmode=require"
});


// 🔹 面談追加 API
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
  
  const now = new Date();
  const id = uuidv4();
  try {
    const result = await pool.query(`
      INSERT INTO meetings (
        id, meeting_date, location, interviewer, interviewee,
        interviewee_name, interviewee_affiliation, interviewee_position,
        job_description, goal, goal_status, actions_taken,
        successful_results, challenges, feedback, next_action, next_goal,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *
    `, [
      id, meeting_date, location, interviewer, interviewee,
      interviewee_name, interviewee_affiliation, interviewee_position,
      job_description, goal, goal_status, actions_taken,
      successful_results, challenges, feedback, next_action, next_goal,
      now, now
    ]);
    res.status(201).json(result.rows[0]);
  } catch(err) {
    console.error(err);
    res.status(500).json({ message: "面談作成中にエラーが発生しました" });
  }
});

// 🔹 面談取得 API
// ログインユーザー（担当者または面談者）の面談情報を返す。adminの場合は全件取得
app.get('/meetings/:username', async (req, res) => {
  const username = req.params.username;
  try {
    let query, params;
    if (username === 'admin') {
      query = `SELECT * FROM meetings ORDER BY meeting_date DESC`;
      params = [];
    } else {
      query = `SELECT * FROM meetings WHERE interviewer = $1 OR interviewee = $1 ORDER BY meeting_date DESC`;
      params = [username];
    }
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch(err) {
    console.error(err);
    res.status(500).json({ message: "面談情報取得エラー" });
  }
});

// 🔹 面談更新 API
app.put('/meetings/:id', async (req, res) => {
  const meetingId = req.params.id;
  const fields = [
    'meeting_date', 'location', 'interviewer', 'interviewee',
    'interviewee_name', 'interviewee_affiliation', 'interviewee_position',
    'job_description', 'goal', 'goal_status', 'actions_taken',
    'successful_results', 'challenges', 'feedback', 'next_action', 'next_goal'
  ];
  
  let idx = 1;
  const setParts = [];
  const params = [];
  for (const field of fields) {
    if (req.body[field] !== undefined) {
      setParts.push(`${field} = $${idx}`);
      params.push(req.body[field]);
      idx++;
    }
  }
  if (setParts.length === 0) {
    return res.status(400).json({ message: "更新するフィールドがありません" });
  }
  setParts.push(`updated_at = $${idx}`);
  params.push(new Date());
  
  const query = `UPDATE meetings SET ${setParts.join(', ')} WHERE id = $${idx+1} RETURNING *`;
  params.push(meetingId);
  
  try {
    const result = await pool.query(query, params);
    if(result.rows.length === 0) {
      return res.status(404).json({ message: "面談が見つかりません" });
    }
    res.json(result.rows[0]);
  } catch(err) {
    console.error(err);
    res.status(500).json({ message: "面談更新中にエラーが発生しました" });
  }
});

// 🔹 面談削除 API
app.delete('/meetings/:id', async (req, res) => {
  const meetingId = req.params.id;
  try {
    const result = await pool.query(`DELETE FROM meetings WHERE id = $1 RETURNING *`, [meetingId]);
    if(result.rowCount === 0) {
      return res.status(404).json({ message: "面談が見つかりません" });
    }
    res.json({ message: "面談が削除されました" });
  } catch(err) {
    console.error(err);
    res.status(500).json({ message: "面談削除中にエラーが発生しました" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});
