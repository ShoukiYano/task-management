const API_URL = "https://task-management-production-583b.up.railway.app";

// 現在のページ名を取得
const currentPage = window.location.pathname.split("/").pop();
// モーダル表示済みフラグ
let modalShown = false;
// ログインユーザーの確認
var user = JSON.parse(localStorage.getItem("loggedInUser"));
if (currentPage !== "login.html" && currentPage !== "register.html" && !user) {
  window.location.href = "login.html";
}

/* ========= ログイン処理 ========= */
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

/* ========= 新規登録処理 ========= */
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

/* ========= ユーザー一覧取得（担当者プルダウン用） ========= */
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

/* ========= 期限間近タスクのモーダル表示 ========= */
function showDeadlineWarningModal(tasksWithWarning) {
  const existingModal = document.getElementById('deadlineModal');
  if (existingModal) {
    existingModal.remove();
  }
  const modal = document.createElement('div');
  modal.id = 'deadlineModal';
  modal.className = 'modal';

  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content';

  const closeButton = document.createElement('span');
  closeButton.className = 'close-modal';
  closeButton.innerHTML = '&times;';
  closeButton.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  const header = document.createElement('h2');
  header.textContent = '期限間近のタスク';

  const tasksListDiv = document.createElement('div');
  tasksListDiv.className = 'modal-tasks';

  tasksWithWarning.forEach(task => {
    const deadlineDate = new Date(task.deadline);
    const taskItem = document.createElement('div');
    taskItem.className = 'modal-task-item';
    taskItem.innerHTML = `<strong>${task.name}</strong> - 期限: ${deadlineDate.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })}`;
    tasksListDiv.appendChild(taskItem);
  });

  modalContent.appendChild(closeButton);
  modalContent.appendChild(header);
  modalContent.appendChild(tasksListDiv);
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  modal.style.display = 'flex';
}

/* ========= タスク編集モーダル表示 ========= */
function showEditTaskModal(task) {
  // 既存の編集モーダルがあれば削除
  const existingModal = document.getElementById("editTaskModal");
  if (existingModal) {
    existingModal.remove();
  }
  const modal = document.createElement("div");
  modal.id = "editTaskModal";
  modal.className = "modal";

  const modalContent = document.createElement("div");
  modalContent.className = "modal-content";

  // 閉じるボタン
  const closeButton = document.createElement("span");
  closeButton.className = "close-modal";
  closeButton.innerHTML = "&times;";
  closeButton.addEventListener("click", () => {
    modal.style.display = "none";
  });

  const title = document.createElement("h2");
  title.textContent = "タスク編集";

  // 編集フォームの作成
  const form = document.createElement("form");
  form.id = "editTaskForm";

  // タスク名
  const nameGroup = document.createElement("div");
  nameGroup.className = "form-group";
  const nameLabel = document.createElement("label");
  nameLabel.textContent = "タスク名";
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.id = "editTaskName";
  nameInput.value = task.name;
  nameGroup.appendChild(nameLabel);
  nameGroup.appendChild(nameInput);

  // タスク内容
  const descGroup = document.createElement("div");
  descGroup.className = "form-group";
  const descLabel = document.createElement("label");
  descLabel.textContent = "タスク内容";
  const descInput = document.createElement("input");
  descInput.type = "text";
  descInput.id = "editTaskDescription";
  descInput.value = task.description;
  descGroup.appendChild(descLabel);
  descGroup.appendChild(descInput);

  // 期限
  const deadlineGroup = document.createElement("div");
  deadlineGroup.className = "form-group";
  const deadlineLabel = document.createElement("label");
  deadlineLabel.textContent = "期限";
  const deadlineInput = document.createElement("input");
  deadlineInput.type = "date";
  deadlineInput.id = "editTaskDeadline";
  if (task.deadline) {
    deadlineInput.value = task.deadline.substring(0, 10);
  }
  deadlineGroup.appendChild(deadlineLabel);
  deadlineGroup.appendChild(deadlineInput);

  // ステータス
  const statusGroup = document.createElement("div");
  statusGroup.className = "form-group";
  const statusLabel = document.createElement("label");
  statusLabel.textContent = "ステータス";
  const statusSelect = document.createElement("select");
  statusSelect.id = "editTaskStatus";
  const statuses = ["未着手", "進行中", "完了", "保留"];
  statuses.forEach(s => {
    const option = document.createElement("option");
    option.value = s;
    option.textContent = s;
    if (s === task.status) option.selected = true;
    statusSelect.appendChild(option);
  });
  statusGroup.appendChild(statusLabel);
  statusGroup.appendChild(statusSelect);

  // 優先度
  const priorityGroup = document.createElement("div");
  priorityGroup.className = "form-group";
  const priorityLabel = document.createElement("label");
  priorityLabel.textContent = "優先度";
  const prioritySelect = document.createElement("select");
  prioritySelect.id = "editTaskPriority";
  const priorities = ["低", "中", "高", "緊急"];
  priorities.forEach(p => {
    const option = document.createElement("option");
    option.value = p;
    option.textContent = p;
    if (p === task.priority) option.selected = true;
    prioritySelect.appendChild(option);
  });
  priorityGroup.appendChild(priorityLabel);
  priorityGroup.appendChild(prioritySelect);

  // 担当者（プルダウンで選択）
  const assigneeGroup = document.createElement("div");
  assigneeGroup.className = "form-group";
  const assigneeLabel = document.createElement("label");
  assigneeLabel.textContent = "担当者";
  const assigneeSelect = document.createElement("select");
  assigneeSelect.id = "editTaskAssignee";
  // 担当者の選択肢はサーバーから取得
  fetch(`${API_URL}/users`)
    .then(res => res.json())
    .then(users => {
      users.forEach(u => {
        const option = document.createElement("option");
        option.value = u.username;
        option.textContent = u.username;
        if (u.username === task.assignee) {
          option.selected = true;
        }
        assigneeSelect.appendChild(option);
      });
    })
    .catch(error => console.error("担当者取得エラー:", error));
  assigneeGroup.appendChild(assigneeLabel);
  assigneeGroup.appendChild(assigneeSelect);

  // 更新ボタン
  const updateButton = document.createElement("button");
  updateButton.type = "button";
  updateButton.textContent = "更新";
  updateButton.addEventListener("click", function() {
    const updatedTask = {
      name: document.getElementById("editTaskName").value,
      description: document.getElementById("editTaskDescription").value,
      deadline: document.getElementById("editTaskDeadline").value,
      status: document.getElementById("editTaskStatus").value,
      priority: document.getElementById("editTaskPriority").value,
      assignee: document.getElementById("editTaskAssignee").value
    };

    fetch(`${API_URL}/tasks/${task.id}`, {
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
      .then(() => {
        modal.style.display = "none";
        loadTasks();
      })
      .catch(error => console.error("タスク更新エラー:", error));
  });

  form.appendChild(nameGroup);
  form.appendChild(descGroup);
  form.appendChild(deadlineGroup);
  form.appendChild(statusGroup);
  form.appendChild(priorityGroup);
  form.appendChild(assigneeGroup);
  form.appendChild(updateButton);

  modalContent.appendChild(closeButton);
  modalContent.appendChild(title);
  modalContent.appendChild(form);
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  modal.style.display = "flex";
}

/* ========= タスク一覧取得 ========= */
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
      // 期日が早い順にソート
      tasks.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
      window.tasksList = tasks; // 編集用にグローバル変数に保存

      const tasksContainer = document.getElementById("tasks");
      let tasksWithWarning = [];

      if (tasksContainer) {
        tasksContainer.innerHTML = tasks.length
          ? tasks.map(task => {
              const deadlineDate = new Date(task.deadline);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const diffTime = deadlineDate - today;
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              if (diffDays <= 2) {
                tasksWithWarning.push(task);
              }
              const deadlineClass = diffDays <= 2 ? 'deadline-warning' : '';

              // ステータス別クラス
              let statusClass = "";
              if (task.status === "未着手") {
                statusClass = "status-not-started";
              } else if (task.status === "進行中") {
                statusClass = "status-in-progress";
              } else if (task.status === "完了") {
                statusClass = "status-completed";
              } else if (task.status === "保留") {
                statusClass = "status-on-hold";
              }

              return `
                <div class="task-card">
                  <strong>${task.name}</strong> - ${task.description}<br>
                  <small class="${deadlineClass}">
                    期限: ${deadlineDate.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })} |
                    優先度: ${task.priority} |
                    ステータス: <span class="${statusClass}">${task.status}</span>
                  </small>
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

      if (tasksWithWarning.length > 0 && !modalShown) {
        modalShown = true;
        showDeadlineWarningModal(tasksWithWarning);
      }
    })
    .catch(error => console.error("❌ タスク取得エラー:", error));
}

/* ========= タスク編集（グローバル変数からタスクを取得） ========= */
function editTask(taskId) {
  const task = window.tasksList.find(t => t.id === taskId);
  if (!task) {
    alert("タスクが見つかりません");
    return;
  }
  showEditTaskModal(task);
}

/* ========= タスク追加 ========= */
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
      document.getElementById("taskName").value = "";
      document.getElementById("taskDescription").value = "";
      document.getElementById("taskDeadline").value = "";
      loadTasks();
    })
    .catch(error => console.error("タスク追加エラー:", error));
}

/* ========= タスク削除 ========= */
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

/* ========= ログアウト ========= */
function logout() {
  localStorage.removeItem("loggedInUser");
  window.location.href = "login.html";
}

/* ========= DOMContentLoaded 時の初期処理 ========= */
document.addEventListener("DOMContentLoaded", function () {
  const usernameDisplay = document.getElementById("loggedInUsername");
  if (usernameDisplay && user) {
    usernameDisplay.textContent = user.username;
  }
  if (document.getElementById("assignee")) {
    loadUsers();
  }
  if (document.getElementById("tasks")) {
    loadTasks();
  }
});
