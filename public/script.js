// script.js

const API_URL = "http://localhost:3000";
const currentPage = window.location.pathname.split("/").pop();

let modalShown = false;
var user = JSON.parse(localStorage.getItem("loggedInUser"));
if (currentPage !== "login.html" && currentPage !== "register.html" && !user) {
  window.location.href = "login.html";
}

/* ================================
   ログイン処理・新規登録・ユーザー取得
   （既存コードそのまま）
================================ */
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
        window.location.href = (data.username === "admin") ? "admin.html" : "select.html";
      } else {
        alert("ログイン失敗");
      }
    })
    .catch(error => console.error("ログインエラー:", error));
}

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

/* ================================
   タスク管理（既存コードそのまま）
================================ */
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

      if (tasksWithWarning.length > 0 && !modalShown) {
        modalShown = true;
        showDeadlineWarningModal(tasksWithWarning);
      }
    })
    .catch(error => console.error("❌ タスク取得エラー:", error));
}

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
  closeButton.addEventListener('click', function() {
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

  modal.style.display = 'block';
}

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
   面談管理機能（Meeting Management）
================================ */

// 担当者／面談者の一覧取得（ユーザー一覧APIを再利用）
function loadMeetingUsers() {
  fetch(`${API_URL}/users`)
    .then(res => res.json())
    .then(users => {
      const interviewerSelect = document.getElementById("interviewer");
      const intervieweeSelect = document.getElementById("interviewee");
      if (interviewerSelect) {
        interviewerSelect.innerHTML = "";
        users.forEach(u => {
          const option = document.createElement("option");
          option.value = u.username;
          option.textContent = u.username;
          interviewerSelect.appendChild(option);
        });
      }
      if (intervieweeSelect) {
        intervieweeSelect.innerHTML = "";
        users.forEach(u => {
          const option = document.createElement("option");
          option.value = u.username;
          option.textContent = u.username;
          intervieweeSelect.appendChild(option);
        });
      }
    })
    .catch(err => console.error("Error loading meeting users:", err));
}

// 面談一覧取得
function loadMeetings() {
  if (!user) return;
  const username = encodeURIComponent(user.username);
  fetch(`${API_URL}/meetings/${username}`)
    .then(res => {
      if (!res.ok) {
        return res.json().then(err => { throw new Error(err.message); });
      }
      return res.json();
    })
    .then(meetings => {
      const meetingsList = document.getElementById("meetingsList");
      if (meetingsList) {
        if (meetings.length) {
          meetingsList.innerHTML = meetings.map(meeting => `
            <div class="meeting-card">
              <strong>面談日: ${new Date(meeting.meeting_date).toLocaleString("ja-JP")}</strong><br>
              <small>場所: ${meeting.location || ''}</small><br>
              <p>担当者: ${meeting.interviewer} | 面談者: ${meeting.interviewee}</p>
              <p>面談者情報: ${meeting.interviewee_name || ''}, ${meeting.interviewee_affiliation || ''}, ${meeting.interviewee_position || ''}</p>
              <p>業務内容・目標: ${meeting.job_description || ''} / 目標: ${meeting.goal || ''} (達成状況: ${meeting.goal_status || ''})</p>
              <p>アクション: ${meeting.actions_taken || ''} / 成果: ${meeting.successful_results || ''}</p>
              <p>課題: ${meeting.challenges || ''}</p>
              <p>フィードバック: ${meeting.feedback || ''}</p>
              <p>次のアクション: ${meeting.next_action || ''} / 次の目標: ${meeting.next_goal || ''}</p>
              <div class="meeting-buttons">
                <button onclick="editMeeting('${meeting.id}')">編集</button>
                <button onclick="deleteMeeting('${meeting.id}')">削除</button>
              </div>
            </div>
          `).join("");
        } else {
          meetingsList.innerHTML = "<p>面談はありません。</p>";
        }
      }
    })
    .catch(err => console.error("Error loading meetings:", err));
}

// 面談追加
function addMeeting() {
  if (!user) return;
  const interviewer = document.getElementById("interviewer").value;
  const interviewee = document.getElementById("interviewee").value;
  const meetingDate = document.getElementById("meetingDate").value;
  const locationVal = document.getElementById("location").value;
  const intervieweeName = document.getElementById("name").value;
  const intervieweeAffiliation = document.getElementById("affiliation").value;
  const intervieweePosition = document.getElementById("position").value;
  const jobDescription = document.getElementById("jobDescription").value;
  const goal = document.getElementById("goal").value;
  const goalStatus = document.getElementById("goalStatus").value;
  const actionsTaken = document.getElementById("actionsTaken").value;
  const successfulResults = document.getElementById("successfulResults").value;
  const challenges = document.getElementById("challenges").value;
  const feedback = document.getElementById("feedback").value;
  const nextAction = document.getElementById("nextAction").value;
  const nextGoal = document.getElementById("nextGoal").value;
  
  const newMeeting = {
    meeting_date: meetingDate,
    location: locationVal,
    interviewer,
    interviewee,
    interviewee_name: intervieweeName,
    interviewee_affiliation: intervieweeAffiliation,
    interviewee_position: intervieweePosition,
    job_description: jobDescription,
    goal,
    goal_status: goalStatus,
    actions_taken: actionsTaken,
    successful_results: successfulResults,
    challenges,
    feedback,
    next_action: nextAction,
    next_goal: nextGoal
  };
  
  fetch(`${API_URL}/meetings`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(newMeeting)
  })
  .then(res => {
    if (!res.ok) {
      return res.json().then(err => { throw new Error(err.message); });
    }
    return res.json();
  })
  .then(data => {
    alert("面談が作成されました");
    document.getElementById("createMeetingForm").reset();
    loadMeetings();
  })
  .catch(err => console.error("Error creating meeting:", err));
}

function editMeeting(meetingId) {
  const newMeetingDate = prompt("新しい面談日 (YYYY-MM-DD):");
  if (newMeetingDate === null) return;
  const newLocation = prompt("新しい場所:");
  if (newLocation === null) return;
  const newInterviewer = prompt("新しい担当者:");
  if (newInterviewer === null) return;
  const newInterviewee = prompt("新しい面談者:");
  if (newInterviewee === null) return;
  const newFeedback = prompt("新しいフィードバック:");
  if (newFeedback === null) return;
  
  const updatedMeeting = {
    meeting_date: newMeetingDate,
    location: newLocation,
    interviewer: newInterviewer,
    interviewee: newInterviewee,
    feedback: newFeedback
  };
  
  fetch(`${API_URL}/meetings/${meetingId}`, {
    method: "PUT",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(updatedMeeting)
  })
  .then(res => {
    if (!res.ok) {
       return res.json().then(err => { throw new Error(err.message); });
    }
    return res.json();
  })
  .then(() => loadMeetings())
  .catch(err => console.error("Error updating meeting:", err));
}

function deleteMeeting(meetingId) {
  if (!confirm("面談を削除してもよろしいですか？")) return;
  fetch(`${API_URL}/meetings/${meetingId}`, {
    method: "DELETE"
  })
  .then(res => {
    if (!res.ok) {
      return res.json().then(err => { throw new Error(err.message); });
    }
    return res.json();
  })
  .then(() => loadMeetings())
  .catch(err => console.error("Error deleting meeting:", err));
}

function logout() {
  localStorage.removeItem("loggedInUser");
  window.location.href = "login.html";
}

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
  // 面談管理画面の場合
  if (document.getElementById("meetingsList")) {
    loadMeetingUsers();
    loadMeetings();
  }
});

// --- ユーティリティ関数 ---
function truncateText(text, n) {
  if (!text) return "";
  return text.length > n ? text.substring(0, n) + "…" : text;
}

// --- 面談管理機能（Meeting Management） ---

// グローバルに取得済み面談データを保持（モーダル用）
let meetingsData = [];

// 担当者／面談者の一覧取得（ユーザー一覧APIを再利用）
function loadMeetingUsers() {
  fetch(`${API_URL}/users`)
    .then(res => res.json())
    .then(users => {
      const interviewerSelect = document.getElementById("interviewer");
      const intervieweeSelect = document.getElementById("interviewee");
      if (interviewerSelect) {
        interviewerSelect.innerHTML = "";
        users.forEach(u => {
          const option = document.createElement("option");
          option.value = u.username;
          option.textContent = u.username;
          interviewerSelect.appendChild(option);
        });
      }
      if (intervieweeSelect) {
        intervieweeSelect.innerHTML = "";
        users.forEach(u => {
          const option = document.createElement("option");
          option.value = u.username;
          option.textContent = u.username;
          intervieweeSelect.appendChild(option);
        });
      }
    })
    .catch(err => console.error("Error loading meeting users:", err));
}

// 面談一覧取得（表示内容は50文字以上なら省略）
function loadMeetings() {
  if (!user) return;
  const username = encodeURIComponent(user.username);
  fetch(`${API_URL}/meetings/${username}`)
    .then(res => {
      if (!res.ok) {
        return res.json().then(err => { throw new Error(err.message); });
      }
      return res.json();
    })
    .then(meetings => {
      meetingsData = meetings; // グローバルに保持
      const meetingsList = document.getElementById("meetingsList");
      if (meetingsList) {
        if (meetings.length) {
          meetingsList.innerHTML = meetings.map(meeting => `
            <div class="meeting-card" onclick="openMeetingModal('${meeting.id}')">
              <strong>面談日: ${new Date(meeting.meeting_date).toLocaleString("ja-JP")}</strong><br>
              <small>場所: ${meeting.location || ''}</small><br>
              <p>${truncateText(meeting.job_description || '', 50)}</p>
              <p>担当者: ${meeting.interviewer} | 面談者: ${meeting.interviewee}</p>
            </div>
          `).join("");
        } else {
          meetingsList.innerHTML = "<p>面談はありません。</p>";
        }
      }
    })
    .catch(err => console.error("Error loading meetings:", err));
}

// モーダル表示（面談詳細＋コメント／編集ボタン）
function openMeetingModal(meetingId) {
  // 該当面談を取得
  const meeting = meetingsData.find(m => m.id === meetingId);
  if (!meeting) return;
  
  // モーダルの作成
  const modal = document.createElement("div");
  modal.id = "meetingModal";
  modal.className = "modal";
  modal.style.position = "fixed";
  modal.style.top = 0;
  modal.style.left = 0;
  modal.style.width = "100%";
  modal.style.height = "100%";
  modal.style.backgroundColor = "rgba(0,0,0,0.5)";
  modal.style.display = "flex";
  modal.style.alignItems = "center";
  modal.style.justifyContent = "center";
  modal.style.zIndex = 10000;
  
  const modalContent = document.createElement("div");
  modalContent.className = "modal-content";
  modalContent.style.background = "#fff";
  modalContent.style.padding = "20px";
  modalContent.style.width = "90%";
  modalContent.style.maxWidth = "600px";
  modalContent.style.maxHeight = "90%";
  modalContent.style.overflowY = "auto";
  modalContent.style.position = "relative";
  
  // 閉じるボタン
  const closeButton = document.createElement("span");
  closeButton.className = "close-modal";
  closeButton.innerHTML = "&times;";
  closeButton.style.position = "absolute";
  closeButton.style.top = "10px";
  closeButton.style.right = "20px";
  closeButton.style.cursor = "pointer";
  closeButton.style.fontSize = "24px";
  closeButton.addEventListener("click", closeMeetingModal);
  
  // 面談詳細内容の表示エリア
  const detailDiv = document.createElement("div");
  detailDiv.id = "meetingDetailContent";
  detailDiv.innerHTML = `
    <h2>面談詳細</h2>
    <p><strong>面談日:</strong> ${new Date(meeting.meeting_date).toLocaleString("ja-JP")}</p>
    <p><strong>場所:</strong> ${meeting.location || ""}</p>
    <p><strong>担当者:</strong> ${meeting.interviewer}</p>
    <p><strong>面談者:</strong> ${meeting.interviewee}</p>
    <p><strong>面談者情報:</strong> ${meeting.interviewee_name || ""}, ${meeting.interviewee_affiliation || ""}, ${meeting.interviewee_position || ""}</p>
    <p><strong>業務内容・目標:</strong> ${meeting.job_description || ""}</p>
    <p><strong>目標:</strong> ${meeting.goal || ""} (達成状況: ${meeting.goal_status || ""})</p>
    <p><strong>アクション:</strong> ${meeting.actions_taken || ""} / <strong>成果:</strong> ${meeting.successful_results || ""}</p>
    <p><strong>課題:</strong> ${meeting.challenges || ""}</p>
    <p><strong>フィードバック:</strong> ${meeting.feedback || ""}</p>
    <p><strong>次のアクション:</strong> ${meeting.next_action || ""} / <strong>次の目標:</strong> ${meeting.next_goal || ""}</p>
  `;
  
  // ボタン群（コメント・編集）
  const btnDiv = document.createElement("div");
  btnDiv.id = "meetingModalButtons";
  btnDiv.style.marginTop = "20px";
  btnDiv.innerHTML = `
    <button onclick="showCommentForm('${meeting.id}')">コメント</button>
    <button onclick="showMeetingEditForm('${meeting.id}')">編集</button>
  `;
  
  // コンテナ（コメントフォーム・編集フォーム用）
  const commentContainer = document.createElement("div");
  commentContainer.id = "commentFormContainer";
  commentContainer.style.marginTop = "20px";
  
  const editContainer = document.createElement("div");
  editContainer.id = "editFormContainer";
  editContainer.style.marginTop = "20px";
  
  // モーダル組み立て
  modalContent.appendChild(closeButton);
  modalContent.appendChild(detailDiv);
  modalContent.appendChild(btnDiv);
  modalContent.appendChild(commentContainer);
  modalContent.appendChild(editContainer);
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
}

// モーダルを閉じる
function closeMeetingModal() {
  const modal = document.getElementById("meetingModal");
  if (modal) {
    modal.remove();
  }
}

// --- コメント機能 ---
// （ここでは例としてlocalStorageに一時保存）
function showCommentForm(meetingId) {
  const container = document.getElementById("commentFormContainer");
  container.innerHTML = ""; // 既存のフォームをクリア
  
  const form = document.createElement("div");
  form.innerHTML = `
    <h3>コメントを追加</h3>
    <p><strong>担当者:</strong> ${user.username}</p>
    <textarea id="commentText" rows="4" style="width:100%;" placeholder="コメントを入力"></textarea><br>
    <button onclick="submitMeetingComment('${meetingId}')">送信</button>
  `;
  container.appendChild(form);
}

function submitMeetingComment(meetingId) {
  const commentText = document.getElementById("commentText").value.trim();
  if (!commentText) {
    alert("コメントを入力してください。");
    return;
  }
  
  // 例：localStorageにコメントを保存（meetingCommentsは { meetingId: [ {user, text, timestamp}, ... ] }）
  let meetingComments = JSON.parse(localStorage.getItem("meetingComments")) || {};
  if (!meetingComments[meetingId]) {
    meetingComments[meetingId] = [];
  }
  meetingComments[meetingId].push({
    user: user.username,
    text: commentText,
    timestamp: new Date().toISOString()
  });
  localStorage.setItem("meetingComments", JSON.stringify(meetingComments));
  
  alert("コメントを保存しました。");
  document.getElementById("commentText").value = "";
  
  // ※必要に応じてコメント履歴をモーダル内に表示する処理も追加可能
}

// --- 編集機能 ---
// モーダル内に既存データをフォームで展開して編集できるようにする
function showMeetingEditForm(meetingId) {
  // 既存フォームがあればクリア
  const editContainer = document.getElementById("editFormContainer");
  editContainer.innerHTML = "";
  
  // 対象面談を取得
  const meeting = meetingsData.find(m => m.id === meetingId);
  if (!meeting) return;
  
  // 編集フォーム作成
  const form = document.createElement("div");
  form.innerHTML = `
    <h3>面談内容を編集</h3>
    <label>面談日: <input type="datetime-local" id="edit_meeting_date" value="${meeting.meeting_date ? new Date(meeting.meeting_date).toISOString().slice(0,16) : ''}"></label><br>
    <label>場所: <input type="text" id="edit_location" value="${meeting.location || ''}"></label><br>
    <label>担当者: <input type="text" id="edit_interviewer" value="${meeting.interviewer}"></label><br>
    <label>面談者: <input type="text" id="edit_interviewee" value="${meeting.interviewee}"></label><br>
    <label>面談者情報: <input type="text" id="edit_interviewee_info" value="${(meeting.interviewee_name || '') + ', ' + (meeting.interviewee_affiliation || '') + ', ' + (meeting.interviewee_position || '')}"></label><br>
    <label>業務内容・目標:<br>
      <textarea id="edit_job_description" rows="3" style="width:100%;">${meeting.job_description || ''}</textarea>
    </label><br>
    <label>目標: <input type="text" id="edit_goal" value="${meeting.goal || ''}"></label><br>
    <label>達成状況: <input type="text" id="edit_goal_status" value="${meeting.goal_status || ''}"></label><br>
    <label>アクション: <input type="text" id="edit_actions_taken" value="${meeting.actions_taken || ''}"></label><br>
    <label>成果: <input type="text" id="edit_successful_results" value="${meeting.successful_results || ''}"></label><br>
    <label>課題: <textarea id="edit_challenges" rows="2" style="width:100%;">${meeting.challenges || ''}</textarea></label><br>
    <label>フィードバック: <textarea id="edit_feedback" rows="2" style="width:100%;">${meeting.feedback || ''}</textarea></label><br>
    <label>次のアクション: <input type="text" id="edit_next_action" value="${meeting.next_action || ''}"></label><br>
    <label>次の目標: <input type="text" id="edit_next_goal" value="${meeting.next_goal || ''}"></label><br>
    <button onclick="submitMeetingEdit('${meeting.id}')">保存</button>
    <button onclick="document.getElementById('editFormContainer').innerHTML = '';">キャンセル</button>
  `;
  editContainer.appendChild(form);
}

function submitMeetingEdit(meetingId) {
  const updatedMeeting = {
    meeting_date: document.getElementById("edit_meeting_date").value,
    location: document.getElementById("edit_location").value,
    interviewer: document.getElementById("edit_interviewer").value,
    interviewee: document.getElementById("edit_interviewee").value,
    // ※面談者情報は1つの入力から分割して保存するなど、実装方法に応じて調整してください
    interviewee_name: document.getElementById("edit_interviewee_info").value.split(",")[0] || "",
    interviewee_affiliation: document.getElementById("edit_interviewee_info").value.split(",")[1] || "",
    interviewee_position: document.getElementById("edit_interviewee_info").value.split(",")[2] || "",
    job_description: document.getElementById("edit_job_description").value,
    goal: document.getElementById("edit_goal").value,
    goal_status: document.getElementById("edit_goal_status").value,
    actions_taken: document.getElementById("edit_actions_taken").value,
    successful_results: document.getElementById("edit_successful_results").value,
    challenges: document.getElementById("edit_challenges").value,
    feedback: document.getElementById("edit_feedback").value,
    next_action: document.getElementById("edit_next_action").value,
    next_goal: document.getElementById("edit_next_goal").value
  };
  
  fetch(`${API_URL}/meetings/${meetingId}`, {
    method: "PUT",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(updatedMeeting)
  })
  .then(res => {
    if (!res.ok) {
       return res.json().then(err => { throw new Error(err.message); });
    }
    return res.json();
  })
  .then(updated => {
    alert("面談情報を更新しました");
    // 更新後、再読み込みまたはモーダル内容の更新
    loadMeetings();
    closeMeetingModal();
  })
  .catch(err => console.error("Error updating meeting:", err));
}



// --------------------------------------------

document.addEventListener("DOMContentLoaded", function () {
  // 既存の初期処理…

  // 面談管理画面の場合、面談者入力欄の候補を設定
  const intervieweeInput = document.getElementById("interviewee");
  const datalist = document.getElementById("intervieweeList");
  if (intervieweeInput && datalist) {
    const names = [
      "釘田翼空","平山祐悟","浅野雄也","斎藤妃那子","長谷川拓豊","徳田爽香","田川翔太",
      "高木淳之介","木内由夏","中嶋友香","岡田まの","宮島勇斗","岡部恭祐","山田蓮",
      "津野圭亮","太田優紀","山越虹汰","馬場彩寧","大西竜生","加藤幸菜","玉井勘大",
      "河内美鈴","大石寛仁","平田敦士","熊鞍治憲","山本麻由","山口まりあ","岡田拓弥",
      "菅原古都乃","末本武大","杉本航","加藤拓郎","菊地航稀","川村桃矢","西之濵彩香",
      "成見大樹","日野晴香","森優斗","芝翔大","矢野美紀","江南なずな","本田嘉章",
      "堀内優紀","岡本彩花","興津洸希","橋村聖也","荒牧浩志","白石隼都","鈴木千夏",
      "鈴木かりん","梅本望純","内藤まゆら","渡邉貴博","奥修平","松田悠平","富田哲平",
      "関岡丈一郎","大谷拓摩","島田莞奈","廣瀬真琴","小松達哉","稲垣仁志","河村光軌",
      "神吉愛夢","清水智尋","矢貫麗","岩村涼花","大谷俊介","大和田壮真","三澤萌香",
      "杉野陽","橋本恵里","段野瑞季","齊藤大地","小野弘貴","森本修平","今井里々華",
      "向井優美香","山本龍之介","元山瑠衣","吉見渉","中井啓介","西村真樹","高井雄輔",
      "一木紳太郎","新田大樹","藁科美帆","今中柊介","高山晶彗","堤統也","大室慶介",
      "堀江翔太","上田啓太","石田侑祐","稲葉有哉","名田匠見","臼井健太","山根颯翔",
      "森山滉基","新上剛志","柏原颯人","永岡駿典","福田澄香","田村瑠奈","竹田凱",
      "伊藤虎ノ介","荒木翔太","田中悠貴","平野由芙佳","小林歩","山中颯太","大石拓海",
      "江本紗里","藤原将大","中原宙","山本海斗","藤田拓己","山口未鈴","池田利恩",
      "岡村雄飛","金子拓己","中村陽子","和泉 慶樹","野上明日香","萩原 菜穂","上杉 弥杏",
      "山口 真澄","松本 渉","永田 沙羅","蓬莱 豊哉","田中晴菜","谷琴乃","橋岡弦希",
      "日比野龍","山森康平","宮地就太","松村夢二","南龍太郎","南陸人","大野ラムアウスティン",
      "槇野晃平","大塚美邦","矢野一貴","鈴木笙太","岩田奏流","伊藤万紘","泉谷愛幸",
      "嶋崎駿","山下成樹","木村仁平","東根悠","大塚愛世","山口雄大","山本直毅","水戸陽也",
      "新延大地","林芹南","上村莉子","松木優衣","福井直樹","友永良太","内田聖香","大居烈",
      "西村優平","島田優","佐藤麗奈","志村天斗","森井奎樹","鈴木友梨","竹田桂子","大谷斗也",
      "池本菜月","大澤柊介","藤野好礼","竹田竣叶","石井和也","大林咲花","山田奈峰子",
      "長部嵩一朗","富田樂斗","鈴木麗生","成田忠彦","西尾文吾","野村陽咲","出口芽依",
      "寺岡勇人","田中尊","佐藤裕哉","坂田海人","西村淳生","勝井遼暉","尾﨑稜也","梶山奎哉",
      "高橋広都","河村晃輔","土田歩実","前田柊人","北元蓮太","小林大地","神野太志","清水颯太",
      "赤井友希乃","黄柊基","山口彩耶","速水綾真","岡本響耀","三苫晃暢","一木秀斗","蔡文華",
      "田邉拓己","日野友理夜","奥田舜涼","矢野常貴","早川紗妃","余田莉穂","橋本真生",
      "獺越真土","加古勇也","小沼悟","大場弘資","神山拓磨","浅田晨吾","守屋一輝","浮田 朱梨"
    ];
    names.forEach(function(name) {
      const option = document.createElement("option");
      option.value = name;
      datalist.appendChild(option);
    });
  }
});

// --------------------------------------------


