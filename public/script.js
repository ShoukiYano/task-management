// script.js

const API_URL = "http://localhost:3000";
// 現在のページ名を取得（例: "login.html" や "register.html" など）
const currentPage = window.location.pathname.split("/").pop();

// モーダル表示済みフラグ（同じセッション内で複数回表示しないため）
let modalShown = false;

// ログインチェック：ログイン画面、登録画面以外ではユーザー情報がなければ login.html にリダイレクト
var user = JSON.parse(localStorage.getItem("loggedInUser"));
if (currentPage !== "login.html" && currentPage !== "register.html" && !user) {
  window.location.href = "login.html";
}

/* ================================
   ログイン処理（login.html用）
=============================================== */
function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  fetch(`${API_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  })
    .then(res => res.json())
    .then(data => {
      if (data.username) {
        localStorage.setItem("loggedInUser", JSON.stringify(data));
        window.location.href = (data.username === "admin") ? "admin.html" : "tasks.html";
      } else {
        alert("ログイン失敗");
      }
    })
    .catch(error => console.error("ログインエラー:", error));
}

/* ================================
   新規登録処理（register.html用）
=============================================== */
function register() {
  const email = document.getElementById("regEmail").value;
  const username = document.getElementById("regUsername").value;
  const password = document.getElementById("regPassword").value;

  fetch(`${API_URL}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, username, password })
  })
    .then(res => res.json())
    .then(data => {
      alert(data.message);
      if (data.message === "登録成功！") {
        window.location.href = "login.html";
      }
    })
    .catch(error => console.error("登録エラー:", error));
}

/* ================================
   担当者プルダウン用：ユーザー一覧取得
=============================================== */
function loadUsers() {
  fetch(`${API_URL}/users`)
    .then(res => res.json())
    .then(users => {
      const assigneeSelect = document.getElementById("assignee");
      if (assigneeSelect) {
        assigneeSelect.innerHTML = "";
        users.forEach(u => {
          const option = document.createElement("option");
          option.value = u.username;
          option.textContent = u.username;
          assigneeSelect.appendChild(option);
        });
        // 現在のログインユーザーが存在する場合、選択状態にする
        if (user) {
          const currentUserOption = Array.from(assigneeSelect.options).find(
            option => option.value === user.username
          );
          if (currentUserOption) {
            currentUserOption.selected = true;
          }
        }
      }
    })
    .catch(error => console.error("ユーザー取得エラー:", error));
}

/* ================================
   タスク一覧取得（tasks.html用）
=============================================== */
function loadTasks() {
  if (!user) return;
  const username = encodeURIComponent(user.username);

  fetch(`${API_URL}/tasks/${username}`)
    .then(res => {
      if (!res.ok) {
        return res.json().then(err => { throw new Error(`タスク取得エラー: ${err.message}`); });
      }
      return res.json();
    })
    .then(tasks => {
      const tasksContainer = document.getElementById("tasks");
      let tasksWithWarning = []; // 期限まで2日以内のタスクを格納する配列

      if (tasksContainer) {
        tasksContainer.innerHTML = tasks.length
          ? tasks.map(task => {
              const deadlineDate = new Date(task.deadline);
              const today = new Date();
              today.setHours(0, 0, 0, 0); // 日付のみ比較
              const diffTime = deadlineDate - today;
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              if (diffDays <= 2) {
                tasksWithWarning.push(task);
              }
              const deadlineClass = diffDays <= 2 ? 'deadline-warning' : '';
              return `
                <div class="task-card">
                  <strong>${task.name}</strong> - ${task.description}<br>
                  <small class="${deadlineClass}">期限: ${deadlineDate.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })} | 優先度: ${task.priority} | ステータス: ${task.status}</small>
                  <p>担当: ${task.assignee} | 作成: ${task.creator}</p>
                  <div class="task-buttons">
                    <button onclick="editTask('${task.id}')">✏️ 編集</button>
                    <button onclick="deleteTask('${task.id}')">🗑️ 削除</button>
                  </div>
                </div>
              `;
            }).join("")
          : "<p>タスクがありません。</p>";
      }

      // 期限が迫っているタスクが存在し、まだモーダルを表示していなければ表示
      if (tasksWithWarning.length > 0 && !modalShown) {
        modalShown = true;
        showDeadlineWarningModal(tasksWithWarning);
      }
    })
    .catch(error => console.error("❌ タスク取得エラー:", error));
}

/* ================================
   モーダルウィンドウ表示（期限が残り2日のタスク）
=============================================== */
function showDeadlineWarningModal(tasksWithWarning) {
  // すでにモーダルが存在する場合は削除
  const existingModal = document.getElementById('deadlineModal');
  if (existingModal) {
    existingModal.remove();
  }

  // モーダルのコンテナを作成
  const modal = document.createElement('div');
  modal.id = 'deadlineModal';
  modal.className = 'modal';

  // モーダルの内容を包むコンテナを作成
  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content';

  // 右上の閉じるボタン（✕）を作成
  const closeButton = document.createElement('span');
  closeButton.className = 'close-modal';
  closeButton.innerHTML = '&times;';
  closeButton.addEventListener('click', function() {
    modal.style.display = 'none';
  });

  // モーダルのヘッダーを作成
  const header = document.createElement('h2');
  header.textContent = '期限間近のタスク';

  // モーダル内にタスク一覧を表示するコンテナを作成
  const tasksListDiv = document.createElement('div');
  tasksListDiv.className = 'modal-tasks';

  // 期限間近のタスクを1件ずつ表示
  tasksWithWarning.forEach(task => {
    const deadlineDate = new Date(task.deadline);
    const taskItem = document.createElement('div');
    taskItem.className = 'modal-task-item';
    taskItem.innerHTML = `<strong>${task.name}</strong> - 期限: ${deadlineDate.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })}`;
    tasksListDiv.appendChild(taskItem);
  });

  // モーダルの要素を組み立てる
  modalContent.appendChild(closeButton);
  modalContent.appendChild(header);
  modalContent.appendChild(tasksListDiv);
  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  // モーダルを表示
  modal.style.display = 'block';
}

/* ================================
   タスク追加（tasks.html用）
=============================================== */
function addTask() {
  if (!user) return;
  const newTask = {
    name: document.getElementById("taskName").value,
    description: document.getElementById("taskDescription").value,
    deadline: document.getElementById("taskDeadline").value,
    status: document.getElementById("taskStatus").value,
    priority: document.getElementById("taskPriority").value,
    assignee: document.getElementById("assignee").value,
    creator: user.username
  };

  fetch(`${API_URL}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(newTask)
  })
    .then(res => {
      if (!res.ok) {
        return res.json().then(err => { throw new Error(err.message); });
      }
      return res.json();
    })
    .then(() => {
      // 入力欄をクリアし、タスク一覧を再読み込み
      document.getElementById("taskName").value = "";
      document.getElementById("taskDescription").value = "";
      document.getElementById("taskDeadline").value = "";
      loadTasks();
    })
    .catch(error => console.error("タスク追加エラー:", error));
}

/* ================================
   タスク編集（簡易的な実装例：prompt利用）
=============================================== */
function editTask(taskId) {
  const newName = prompt("新しいタスク名を入力してください:");
  if (newName === null) return;
  const newDescription = prompt("新しいタスク内容を入力してください:");
  if (newDescription === null) return;
  const newDeadline = prompt("新しい期限 (YYYY-MM-DD) を入力してください:");
  if (newDeadline === null) return;
  const newStatus = prompt("新しいステータスを入力してください (未着手 / 進行中 / 完了 / 保留):");
  if (newStatus === null) return;
  const newPriority = prompt("新しい優先度を入力してください (低 / 中 / 高 / 緊急):");
  if (newPriority === null) return;
  const newAssignee = prompt("新しい担当者のユーザー名を入力してください:");
  if (newAssignee === null) return;

  const updatedTask = {
    name: newName,
    description: newDescription,
    deadline: newDeadline,
    status: newStatus,
    priority: newPriority,
    assignee: newAssignee
  };

  fetch(`${API_URL}/tasks/${taskId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updatedTask)
  })
    .then(res => {
      if (!res.ok) {
        return res.json().then(err => { throw new Error(err.message); });
      }
      return res.json();
    })
    .then(() => loadTasks())
    .catch(error => console.error("タスク更新エラー:", error));
}

/* ================================
   タスク削除
=============================================== */
function deleteTask(taskId) {
  if (!confirm("タスクを削除してもよろしいですか？")) return;

  fetch(`${API_URL}/tasks/${taskId}`, {
    method: "DELETE"
  })
    .then(res => {
      if (!res.ok) {
        return res.json().then(err => { throw new Error(err.message); });
      }
      return res.json();
    })
    .then(() => loadTasks())
    .catch(error => console.error("タスク削除エラー:", error));
}

/* ================================
   管理者用：全タスク一覧取得（admin.html用）
=============================================== */
function loadAdminTasks() {
  fetch(`${API_URL}/tasks/admin`)
    .then(res => {
      if (!res.ok) {
        return res.json().then(err => { throw new Error(err.message); });
      }
      return res.json();
    })
    .then(tasks => {
      const adminTasksContainer = document.getElementById("adminTasks");
      if (adminTasksContainer) {
        adminTasksContainer.innerHTML = tasks.length
          ? tasks.map(task => `
              <div class="task-card">
                <strong>${task.name}</strong> - ${task.description}<br>
                <small>期限: ${task.deadline} | 優先度: ${task.priority} | ステータス: ${task.status}</small>
                <p>担当: ${task.assignee} | 作成: ${task.creator}</p>
              </div>
            `).join("")
          : "<p>タスクがありません。</p>";
      }
    })
    .catch(error => console.error("❌ タスク取得エラー:", error));
}

/* ================================
   ログアウト処理
=============================================== */
function logout() {
  localStorage.removeItem("loggedInUser");
  window.location.href = "login.html";
}

/* ================================
   DOMContentLoaded時の初期処理
   ※タスク管理画面(tasks.html)や管理者画面(admin.html)の場合
=============================================== */
document.addEventListener("DOMContentLoaded", function () {
  // ログインユーザー名を表示（存在する場合）
  const usernameDisplay = document.getElementById("loggedInUsername");
  if (usernameDisplay && user) {
    usernameDisplay.textContent = user.username;
  }
  // タスク管理画面用：担当者プルダウンとタスク一覧を読み込む
  if (document.getElementById("assignee")) {
    loadUsers();
  }
  if (document.getElementById("tasks")) {
    loadTasks();
  }
});
