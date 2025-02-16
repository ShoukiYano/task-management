const API_URL = "https://task-management-production-583b.up.railway.app";
const currentPage = window.location.pathname.split("/").pop();
let user = JSON.parse(localStorage.getItem("loggedInUser"));

// ログイン・登録画面以外で未ログインならリダイレクト
if (!["login.html", "register.html", ""].includes(currentPage) && !user) {
  window.location.href = "login.html";
}

/* ================================
   ログイン・新規登録・ユーザー管理
================================ */
function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
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

function register() {
  const email = document.getElementById("regEmail").value.trim();
  const username = document.getElementById("regUsername").value.trim();
  const password = document.getElementById("regPassword").value.trim();
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
      // 担当者（タスク・面談）用のプルダウン
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
          const currentOption = Array.from(assigneeSelect.options).find(option => option.value === user.username);
          if (currentOption) currentOption.selected = true;
        }
      }
      // 面談作成フォーム用：担当者＆面談者（自動補完用）
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
    .catch(error => console.error("ユーザー取得エラー:", error));
}

/* ================================
   タスク管理
================================ */
let tasksData = [];

function loadTasks() {
  if (!user) return;
  const username = encodeURIComponent(user.username);
  fetch(`${API_URL}/tasks/${username}`)
    .then(res => res.json())
    .then(tasks => {
      tasks.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
      tasksData = tasks;
      const tasksContainer = document.getElementById("tasks");
      let tasksWithWarning = [];

      if (tasksContainer) {
        tasksContainer.innerHTML = tasks.length
          ? tasks.map(task => {
              const deadlineDate = new Date(task.deadline);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const diffDays = Math.ceil((deadlineDate - today) / (1000 * 60 * 60 * 24));
              if (diffDays <= 2) tasksWithWarning.push(task);
              const deadlineClass = diffDays <= 2 ? 'deadline-warning' : '';
              return `
                <div class="task-card">
                  <h3>${task.name}</h3>
                  <p>${task.description}</p>
                  <p class="${deadlineClass}">期限: ${deadlineDate.toLocaleDateString("ja-JP")}</p>
                  <p>優先度: ${task.priority} | ステータス: ${task.status}</p>
                  <p>担当: ${task.assignee} | 作成: ${task.creator}</p>
                  <div class="task-buttons" id="task-buttons-${task.id}">
                    <button onclick="approveTask('${task.id}')">承認</button>
                    <button onclick="rejectTask('${task.id}')">却下</button>
                  </div>
                </div>
              `;
            }).join('')
          : "<p>タスクがありません。</p>";
      }

      if (tasksWithWarning.length > 0 && !window.modalShown) {
        window.modalShown = true;
        showDeadlineWarningModal(tasksWithWarning);
      }
    })
    .catch(error => console.error("タスク取得エラー:", error));
}

function loadAdminTasks() {
  fetch(`${API_URL}/tasks/admin`)
    .then(res => {
      if (!res.ok) return res.json().then(err => { throw new Error(err.message); });
      return res.json();
    })
    .then(tasks => {
      const container = document.getElementById("adminTasks");
      container.innerHTML = tasks.length
        ? tasks.map(task => `
            <div class="task-card">
              <h3>${task.name}</h3>
              <p>${task.description}</p>
              <p>期限: ${new Date(task.deadline).toLocaleDateString("ja-JP")}</p>
              <p>優先度: ${task.priority} | ステータス: ${task.status}</p>
              <p>担当: ${task.assignee} | 作成: ${task.creator}</p>
            </div>
          `).join('')
        : "<p>タスクがありません。</p>";
    })
    .catch(error => console.error("タスク取得エラー:", error));
}

function approveTask(taskId) {
  const btnDiv = document.getElementById(`task-buttons-${taskId}`);
  if (btnDiv) {
    btnDiv.innerHTML = `<button onclick="editTask('${taskId}')">✏️ 編集</button>
                        <button onclick="deleteTask('${taskId}')">🗑️ 削除</button>`;
  }
}

function rejectTask(taskId) {
  const task = tasksData.find(t => t.id === taskId);
  const btnDiv = document.getElementById(`task-buttons-${taskId}`);
  if (btnDiv && task) {
    btnDiv.innerHTML = `<p class="reject-msg">${task.assignee}から却下されました</p>
                        <button onclick="editTask('${taskId}')">✏️ 編集</button>
                        <button onclick="deleteTask('${taskId}')">🗑️ 削除</button>`;
  }
}

function showDeadlineWarningModal(tasksWithWarning) {
  let existingModal = document.getElementById("deadlineModal");
  if (existingModal) existingModal.remove();
  const modal = document.createElement("div");
  modal.id = "deadlineModal";
  modal.className = "modal";

  const modalContent = document.createElement("div");
  modalContent.className = "modal-content";

  const closeButton = document.createElement("span");
  closeButton.className = "close-modal";
  closeButton.innerHTML = "&times;";
  closeButton.onclick = () => modal.remove();

  const header = document.createElement("h2");
  header.textContent = "期限間近のタスク";

  const tasksListDiv = document.createElement("div");
  tasksListDiv.className = "modal-tasks";
  tasksWithWarning.forEach(task => {
    const deadlineDate = new Date(task.deadline);
    const item = document.createElement("div");
    item.className = "modal-task-item";
    item.innerHTML = `<strong>${task.name}</strong> - 期限: ${deadlineDate.toLocaleDateString("ja-JP")}`;
    tasksListDiv.appendChild(item);
  });

  modalContent.append(closeButton, header, tasksListDiv);
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
}

/* タスク追加・編集・削除 */
function addTask() {
  if (!user) return;
  const newTask = {
    name: document.getElementById("taskName").value.trim(),
    description: document.getElementById("taskDescription").value.trim(),
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
      if (!res.ok) return res.json().then(err => { throw new Error(err.message); });
      return res.json();
    })
    .then(() => {
      document.getElementById("taskForm").reset();
      loadTasks();
    })
    .catch(error => console.error("タスク追加エラー:", error));
}

function editTask(taskId) {
  const task = tasksData.find(t => t.id === taskId);
  if (!task) return;
  showTaskEditModal(task);
}

function showTaskEditModal(task) {
  const modal = document.createElement("div");
  modal.id = "taskEditModal";
  modal.className = "modal";

  const modalContent = document.createElement("div");
  modalContent.className = "modal-content";

  const closeButton = document.createElement("span");
  closeButton.className = "close-modal";
  closeButton.innerHTML = "&times;";
  closeButton.onclick = () => modal.remove();

  modalContent.innerHTML = `
    <h2>タスク編集</h2>
    <div class="form-group">
      <label for="edit_task_name">タスク名</label>
      <input type="text" id="edit_task_name" value="${task.name}" required>
    </div>
    <div class="form-group">
      <label for="edit_task_description">タスク内容</label>
      <input type="text" id="edit_task_description" value="${task.description}" required>
    </div>
    <div class="form-group">
      <label for="edit_task_deadline">期限</label>
      <input type="date" id="edit_task_deadline" value="${task.deadline.split('T')[0]}" required>
    </div>
    <div class="form-group">
      <label for="edit_task_status">ステータス</label>
      <select id="edit_task_status" required>
        <option value="未着手" ${task.status === "未着手" ? "selected" : ""}>未着手</option>
        <option value="進行中" ${task.status === "進行中" ? "selected" : ""}>進行中</option>
        <option value="完了" ${task.status === "完了" ? "selected" : ""}>完了</option>
        <option value="保留" ${task.status === "保留" ? "selected" : ""}>保留</option>
      </select>
    </div>
    <div class="form-group">
      <label for="edit_task_priority">優先度</label>
      <select id="edit_task_priority" required>
        <option value="低" ${task.priority === "低" ? "selected" : ""}>低</option>
        <option value="中" ${task.priority === "中" ? "selected" : ""}>中</option>
        <option value="高" ${task.priority === "高" ? "selected" : ""}>高</option>
        <option value="緊急" ${task.priority === "緊急" ? "selected" : ""}>緊急</option>
      </select>
    </div>
    <div class="form-group">
      <label for="edit_task_assignee">担当者</label>
      <select id="edit_task_assignee" required></select>
    </div>
    <div class="modal-actions">
      <button type="button" onclick="submitTaskEdit('${task.id}')">保存</button>
      <button type="button" onclick="document.getElementById('taskEditModal').remove()">キャンセル</button>
    </div>
  `;
  modalContent.prepend(closeButton);
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  loadUsers(); // 担当者プルダウンを更新
}

function submitTaskEdit(taskId) {
  const updatedTask = {
    name: document.getElementById("edit_task_name").value.trim(),
    description: document.getElementById("edit_task_description").value.trim(),
    deadline: document.getElementById("edit_task_deadline").value,
    status: document.getElementById("edit_task_status").value,
    priority: document.getElementById("edit_task_priority").value,
    assignee: document.getElementById("edit_task_assignee").value
  };

  fetch(`${API_URL}/tasks/${taskId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updatedTask)
  })
    .then(res => {
      if (!res.ok) return res.json().then(err => { throw new Error(err.message); });
      return res.json();
    })
    .then(() => {
      alert("タスクが更新されました");
      document.getElementById("taskEditModal").remove();
      loadTasks();
    })
    .catch(err => console.error("タスク更新エラー:", err));
}

function deleteTask(taskId) {
  if (!confirm("タスクを削除してもよろしいですか？")) return;
  fetch(`${API_URL}/tasks/${taskId}`, { method: "DELETE" })
    .then(res => {
      if (!res.ok) return res.json().then(err => { throw new Error(err.message); });
      return res.json();
    })
    .then(() => loadTasks())
    .catch(error => console.error("タスク削除エラー:", error));
}

/* ================================
   面談管理機能
================================ */
let meetingsData = [];

function loadMeetings() {
  if (!user) return;
  const username = encodeURIComponent(user.username);
  fetch(`${API_URL}/meetings/${username}`)
    .then(res => res.json())
    .then(meetings => {
      meetingsData = meetings;
      const meetingsList = document.getElementById("meetingsList");
      if (meetingsList) {
        meetingsList.innerHTML = meetings.length
          ? meetings.map(meeting => `
              <div class="meeting-card" onclick="openMeetingModal('${meeting.id}')">
                <h3>面談日: ${new Date(meeting.meeting_date).toLocaleString("ja-JP")}</h3>
                <p>場所: ${meeting.location || ''}</p>
                <p>${meeting.job_description ? truncateText(meeting.job_description, 50) : ''}</p>
                <p>担当者: ${meeting.interviewer} | 面談者: ${meeting.interviewee}</p>
              </div>
            `).join('')
          : "<p>面談はありません。</p>";
      }
    })
    .catch(err => console.error("面談取得エラー:", err));
}

function openMeetingModal(meetingId) {
  const meeting = meetingsData.find(m => m.id === meetingId);
  if (!meeting) return;
  const modal = document.createElement("div");
  modal.id = "meetingModal";
  modal.className = "modal";

  const modalContent = document.createElement("div");
  modalContent.className = "modal-content";

  const closeButton = document.createElement("span");
  closeButton.className = "close-modal";
  closeButton.innerHTML = "&times;";
  closeButton.onclick = closeMeetingModal;

  const detailDiv = document.createElement("div");
  detailDiv.innerHTML = `
    <h2>面談詳細</h2>
    <p><strong>面談日:</strong> ${new Date(meeting.meeting_date).toLocaleString("ja-JP")}</p>
    <p><strong>場所:</strong> ${meeting.location || ""}</p>
    <p><strong>担当者:</strong> ${meeting.interviewer}</p>
    <p><strong>面談者:</strong> ${meeting.interviewee}</p>
    <p><strong>詳細:</strong> ${meeting.job_description || ""}</p>
    <p><strong>目標:</strong> ${meeting.goal || ""} (達成状況: ${meeting.goal_status || ""})</p>
    <p><strong>アクション:</strong> ${meeting.actions_taken || ""}</p>
    <p><strong>成果:</strong> ${meeting.successful_results || ""}</p>
    <p><strong>課題:</strong> ${meeting.challenges || ""}</p>
    <p><strong>フィードバック:</strong> ${meeting.feedback || ""}</p>
    <p><strong>次のアクション:</strong> ${meeting.next_action || ""}</p>
    <p><strong>次の目標:</strong> ${meeting.next_goal || ""}</p>
  `;

  const btnDiv = document.createElement("div");
  btnDiv.className = "modal-actions";
  btnDiv.innerHTML = `
    <button onclick="showCommentForm('${meeting.id}')">コメント</button>
    <button onclick="showMeetingEditForm('${meeting.id}')">編集</button>
  `;

  const commentContainer = document.createElement("div");
  commentContainer.id = "commentFormContainer";

  const editContainer = document.createElement("div");
  editContainer.id = "editFormContainer";

  modalContent.append(closeButton, detailDiv, btnDiv, commentContainer, editContainer);
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
}

function closeMeetingModal() {
  const modal = document.getElementById("meetingModal");
  if (modal) modal.remove();
}

function showCommentForm(meetingId) {
  const container = document.getElementById("commentFormContainer");
  container.innerHTML = `
    <h3>コメントを追加</h3>
    <p><strong>担当者:</strong> ${user.username}</p>
    <textarea id="commentText" rows="4" placeholder="コメントを入力"></textarea>
    <button onclick="submitMeetingComment('${meetingId}')">送信</button>
  `;
}

function submitMeetingComment(meetingId) {
  const commentText = document.getElementById("commentText").value.trim();
  if (!commentText) {
    alert("コメントを入力してください。");
    return;
  }
  let meetingComments = JSON.parse(localStorage.getItem("meetingComments")) || {};
  if (!meetingComments[meetingId]) meetingComments[meetingId] = [];
  meetingComments[meetingId].push({
    user: user.username,
    text: commentText,
    timestamp: new Date().toISOString()
  });
  localStorage.setItem("meetingComments", JSON.stringify(meetingComments));
  alert("コメントを保存しました。");
  document.getElementById("commentText").value = "";
}

function showMeetingEditForm(meetingId) {
  const editContainer = document.getElementById("editFormContainer");
  editContainer.innerHTML = "";
  const meeting = meetingsData.find(m => m.id === meetingId);
  if (!meeting) return;
  editContainer.innerHTML = `
    <h3>面談編集</h3>
    <div class="form-group">
      <label>面談日</label>
      <input type="datetime-local" id="edit_meeting_date" value="${meeting.meeting_date ? new Date(meeting.meeting_date).toISOString().slice(0,16) : ''}">
    </div>
    <div class="form-group">
      <label>場所</label>
      <input type="text" id="edit_location" value="${meeting.location || ''}">
    </div>
    <div class="form-group">
      <label>担当者</label>
      <input type="text" id="edit_interviewer" value="${meeting.interviewer}">
    </div>
    <div class="form-group">
      <label>面談者</label>
      <input type="text" id="edit_interviewee" value="${meeting.interviewee}">
    </div>
    <div class="form-group">
      <label>詳細</label>
      <textarea id="edit_job_description">${meeting.job_description || ''}</textarea>
    </div>
    <div class="form-group">
      <label>目標</label>
      <input type="text" id="edit_goal" value="${meeting.goal || ''}">
    </div>
    <div class="form-group">
      <label>達成状況</label>
      <input type="text" id="edit_goal_status" value="${meeting.goal_status || ''}">
    </div>
    <div class="form-group">
      <label>アクション</label>
      <input type="text" id="edit_actions_taken" value="${meeting.actions_taken || ''}">
    </div>
    <div class="form-group">
      <label>成果</label>
      <input type="text" id="edit_successful_results" value="${meeting.successful_results || ''}">
    </div>
    <div class="form-group">
      <label>課題</label>
      <textarea id="edit_challenges">${meeting.challenges || ''}</textarea>
    </div>
    <div class="form-group">
      <label>フィードバック</label>
      <textarea id="edit_feedback">${meeting.feedback || ''}</textarea>
    </div>
    <div class="form-group">
      <label>次のアクション</label>
      <input type="text" id="edit_next_action" value="${meeting.next_action || ''}">
    </div>
    <div class="form-group">
      <label>次の目標</label>
      <input type="text" id="edit_next_goal" value="${meeting.next_goal || ''}">
    </div>
    <div class="modal-actions">
      <button onclick="submitMeetingEdit('${meeting.id}')">保存</button>
      <button onclick="document.getElementById('editFormContainer').innerHTML = '';">キャンセル</button>
    </div>
  `;
}

function submitMeetingEdit(meetingId) {
  const updatedMeeting = {
    meeting_date: document.getElementById("edit_meeting_date").value,
    location: document.getElementById("edit_location").value,
    interviewer: document.getElementById("edit_interviewer").value,
    interviewee: document.getElementById("edit_interviewee").value,
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
      if (!res.ok) return res.json().then(err => { throw new Error(err.message); });
      return res.json();
    })
    .then(() => {
      alert("面談情報が更新されました");
      loadMeetings();
      closeMeetingModal();
    })
    .catch(err => console.error("面談更新エラー:", err));
}

/* ================================
   共通処理
================================ */
function logout() {
  localStorage.removeItem("loggedInUser");
  window.location.href = "login.html";
}

function truncateText(text, n) {
  return text.length > n ? text.substring(0, n) + "…" : text;
}

/* ================================
   既存のハンバーガーメニューおよびロード画面
================================ */
// ハンバーガーメニューは、HTML 側でチェックボックスとラベルにより制御（CSS によるアニメーション）しているため、追加の JS は不要です。

// タスク画面から面談画面へ遷移する際のロード画面（既存コード）
function goToMeetings() {
  let loadingScreen = document.getElementById("loadingScreen");
  if (loadingScreen) {
    loadingScreen.style.display = "flex";
    setTimeout(function () {
      window.location.href = "meetings.html";
    }, 2000);
  }
}

// 面談画面からタスク画面へ遷移する際のロード画面（既存コード）
function goToTasks() {
  let loadingScreen = document.getElementById("loadingScreen");
  if (loadingScreen) {
    loadingScreen.style.display = "flex";
    setTimeout(function () {
      window.location.href = "tasks.html";
    }, 2000);
  }
}

document.addEventListener("DOMContentLoaded", function () {
  if (user && document.getElementById("loggedInUsername")) {
    document.getElementById("loggedInUsername").textContent = user.username;
  }
  if (document.getElementById("assignee")) loadUsers();
  if (document.getElementById("tasks")) loadTasks();
  if (document.getElementById("meetingsList")) {
    loadUsers();
    loadMeetings();
  }
  
  // datalist の初期化処理：面談者候補の設定
  const datalist = document.getElementById("intervieweeList");
  if (datalist) {
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
    names.forEach(name => {
      const option = document.createElement("option");
      option.value = name;
      datalist.appendChild(option);
    });
  }
});
