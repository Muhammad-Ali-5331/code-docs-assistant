// ===== Element references =====
const side = document.getElementById("side");
const sideOverlay = document.getElementById("sideOverlay");
const openSideBtn = document.getElementById("openSideBtn");
const closeSideBtn = document.getElementById("closeSideBtn");
const newChatBtn = document.getElementById("newChatBtn");
const projectList = document.getElementById("projectList");
const projectEmpty = document.getElementById("projectEmpty");

const topTitle = document.getElementById("topTitle");
const signInBtn = document.getElementById("signInBtn");
const signInBtnMobile = document.getElementById("signInBtnMobile");
const userButtonSlot = document.getElementById("userButtonSlot");

const newProjectPanel = document.getElementById("newProjectPanel");
const chatView = document.getElementById("chatView");
const repoUrlInput = document.getElementById("repoUrl");
const cloneBtn = document.getElementById("cloneBtn");
const cloneBtnText = document.getElementById("cloneBtnText");

const stepClone = document.getElementById("step-clone");
const stepParse = document.getElementById("step-parse");
const stepVector = document.getElementById("step-vector");

const chatWindow = document.getElementById("chatWindow");
const questionInput = document.getElementById("questionInput");
const sendBtn = document.getElementById("sendBtn");
const stopBtn = document.getElementById("stopBtn");

// ===== State =====
let isSignedIn = false;
let activeProjectId = null;
let projectsCache = [];

// ===== Auth =====
async function getFreshToken() {
  return await window.Clerk.session.getToken();
}

function lockApp() {
  isSignedIn = false;
  cloneBtn.disabled = true;
  repoUrlInput.disabled = true;
  questionInput.disabled = true;
  sendBtn.disabled = true;
}

function unlockApp() {
  isSignedIn = true;
  cloneBtn.disabled = false;
  repoUrlInput.disabled = false;
}

const waitForClerk = setInterval(async () => {
  if (window.Clerk) {
    clearInterval(waitForClerk);
    await window.Clerk.load();

    if (window.Clerk.user) {
      unlockApp();
      renderUserAvatar(window.Clerk.user);
      loadProjects();
    } else {
      lockApp();
      signInBtn.classList.remove("hidden");
      userButtonSlot.classList.add("hidden");
    }
  }
}, 100);

function renderUserAvatar(user) {
  signInBtn.classList.add("hidden");
  userButtonSlot.classList.remove("hidden");

  const email = user.primaryEmailAddress ? user.primaryEmailAddress.emailAddress : "User";
  const initial = email.charAt(0).toUpperCase();

  userButtonSlot.innerHTML = `
    <div class="avatar-wrapper" id="avatarWrapper">
      <div class="avatar-circle">${initial}</div>
      <div class="avatar-dropdown hidden" id="avatarDropdown">
        <div class="avatar-email">${email}</div>
        <button class="avatar-signout-btn" id="signOutBtn">Sign Out</button>
      </div>
    </div>
  `;

  const avatarWrapper = document.getElementById("avatarWrapper");
  const avatarDropdown = document.getElementById("avatarDropdown");
  const signOutBtn = document.getElementById("signOutBtn");

  avatarWrapper.addEventListener("click", (e) => {
    e.stopPropagation();
    avatarDropdown.classList.toggle("hidden");
  });
  document.addEventListener("click", () => avatarDropdown.classList.add("hidden"));
  signOutBtn.addEventListener("click", async () => {
    await window.Clerk.signOut();
    window.location.reload();
  });
}

function goToSignIn() {
  window.Clerk.redirectToSignIn({ redirectUrl: window.location.href });
}
signInBtn.addEventListener("click", goToSignIn);
signInBtnMobile.addEventListener("click", goToSignIn);

// ===== Sidebar drawer (mobile) =====
function openSide() { side.classList.add("open"); sideOverlay.classList.add("visible"); }
function closeSide() { side.classList.remove("open"); sideOverlay.classList.remove("visible"); }
openSideBtn.addEventListener("click", openSide);
closeSideBtn.addEventListener("click", closeSide);
sideOverlay.addEventListener("click", closeSide);

// ===== "New Project" resets the view to the empty state =====
newChatBtn.addEventListener("click", () => {
  activeProjectId = null;
  repoUrlInput.value = "";
  topTitle.textContent = "New Project";
  chatWindow.innerHTML = "";
  chatView.classList.add("hidden");
  newProjectPanel.classList.remove("hidden");
  resetSteps();
  highlightActiveProject(null);
  closeSide();
});

// ===== Load the user's project list into the sidebar =====
async function loadProjects() {
  try {
    const token = await getFreshToken();
    const res = await fetch("/projects", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    projectsCache = data.projects || [];
    renderProjectList();
  } catch (err) {
    console.error("Failed to load projects:", err);
  }
}

function renderProjectList() {
  projectList.innerHTML = "";

  if (projectsCache.length === 0) {
    projectList.appendChild(projectEmpty);
    return;
  }

  projectsCache.forEach((p, index) => {
    const repoName = p.repo_url.split("/").filter(Boolean).slice(-1)[0] || p.repo_url;
    const item = document.createElement("div");
    item.className = "project-item" + (p.project_id === activeProjectId ? " active" : "");
    item.style.animationDelay = `${index * 0.03}s`;
    item.innerHTML = `
      <div class="project-icon">📁</div>
      <div class="project-text">
        <div class="project-name">${escapeHtml(repoName)}</div>
        <div class="project-date">${formatDate(p.created_at)}</div>
      </div>
    `;
    item.addEventListener("click", () => openProject(p.project_id, repoName));
    projectList.appendChild(item);
  });
}

function highlightActiveProject(projectId) {
  document.querySelectorAll(".project-item").forEach((el) => el.classList.remove("active"));
  renderProjectList();
}

function formatDate(value) {
  if (!value) return "";
  try {
    const d = new Date(value);
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

// ===== Open an existing project: reload its vector store + past chats =====
async function openProject(projectId, repoName) {
  activeProjectId = projectId;
  topTitle.textContent = repoName;
  renderProjectList();

  newProjectPanel.classList.add("hidden");
  chatView.classList.remove("hidden");
  chatWindow.innerHTML = `<div class="sys-msg">Loading previous conversation...</div>`;

  try {
    const token = await getFreshToken();
    const res = await fetch(`/open_project/${projectId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    chatWindow.innerHTML = "";

    if (data.status === "success") {
      const chats = data.chats || [];
      if (chats.length === 0) {
        addSystemMessage("✨ This project is ready — ask your first question!");
      } else {
        chats.forEach((c) => {
          addUserMessage(c.question, false);
          addAssistantMessageInstant(c.answer, [], false);
        });
      }
      questionInput.disabled = false;
      sendBtn.disabled = false;
    } else {
      addSystemMessage("Error: " + (data.message || "Could not open this project."), true);
    }
  } catch (err) {
    chatWindow.innerHTML = "";
    addSystemMessage("Request failed: " + err.message, true);
  }

  closeSide();
}

// ===== Steps helpers (new project indexing flow) =====
function setStep(stepEl, state) {
  stepEl.classList.remove("active", "complete");
  if (state) stepEl.classList.add(state);
}
function resetSteps() {
  setStep(stepClone, null);
  setStep(stepParse, null);
  setStep(stepVector, null);
}

// ===== Index a new repository =====
cloneBtn.addEventListener("click", async () => {
  const repoUrl = repoUrlInput.value.trim();
  if (!repoUrl || !isSignedIn) return;

  cloneBtn.disabled = true;
  cloneBtnText.textContent = "Indexing...";
  resetSteps();
  setStep(stepClone, "active");

  try {
    const token = await getFreshToken();
    const response = await fetch("/process_repo", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ repo_url: repoUrl }),
    });

    setStep(stepClone, "complete");
    setStep(stepParse, "active");
    const data = await response.json();
    setStep(stepParse, "complete");
    setStep(stepVector, "active");

    if (data.status === "success") {
      setStep(stepVector, "complete");
      activeProjectId = data.project_id;

      const repoName = repoUrl.split("/").filter(Boolean).slice(-1)[0];
      topTitle.textContent = repoName;

      await loadProjects();

      newProjectPanel.classList.add("hidden");
      chatView.classList.remove("hidden");
      chatWindow.innerHTML = "";
      addSystemMessage("✨ Setup complete! Ask me anything about this codebase.");

      questionInput.disabled = false;
      sendBtn.disabled = false;
    } else {
      setStep(stepParse, null);
      alert("Error: " + (data.message || "Could not process this repository."));
    }
  } catch (err) {
    alert("Request failed: " + err.message);
  } finally {
    cloneBtn.disabled = false;
    cloneBtnText.textContent = "Index Repository";
  }
});

// ===== Ask / Stop =====
let currentAbortController = null;
let timerInterval = null;
let timerStart = null;

function startTimer(statusEl) {
  timerStart = Date.now();
  timerInterval = setInterval(() => {
    const seconds = ((Date.now() - timerStart) / 1000).toFixed(1);
    statusEl.innerHTML = `Thinking... <span class="elapsed">${seconds}s</span>`;
  }, 100);
}
function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

async function sendQuestion() {
  const question = questionInput.value.trim();
  if (!question || !activeProjectId) return;

  addUserMessage(question);
  questionInput.value = "";
  questionInput.disabled = true;
  sendBtn.disabled = true;
  sendBtn.classList.add("hidden");
  stopBtn.classList.remove("hidden");

  const processingRow = showProcessingIndicator();
  startTimer(processingRow.querySelector(".proc-status"));

  currentAbortController = new AbortController();

  try {
    const token = await getFreshToken();
    const response = await fetch("/ask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ question }),
      signal: currentAbortController.signal,
    });
    const data = await response.json();

    stopTimer();
    processingRow.remove();

    if (data.answer) {
      await typewriterAssistantMessage(data.answer, data.sources || []);
    } else {
      addAssistantMessageInstant("Error: " + (data.message || "Could not get an answer."), []);
    }
  } catch (err) {
    stopTimer();
    processingRow.remove();

    if (err.name === "AbortError") {
      getFreshToken().then((token) => {
        fetch("/stop", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      });
      addSystemMessage("⏹ Response stopped.", true);
    } else {
      addAssistantMessageInstant("Request failed: " + err.message, []);
    }
  } finally {
    questionInput.disabled = false;
    sendBtn.disabled = false;
    sendBtn.classList.remove("hidden");
    stopBtn.classList.add("hidden");
    currentAbortController = null;
    questionInput.focus();
  }
}

stopBtn.addEventListener("click", () => {
  if (currentAbortController) currentAbortController.abort();
});
sendBtn.addEventListener("click", sendQuestion);
questionInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendQuestion();
});

// ===== Render helpers =====
function currentTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function addUserMessage(text, animate = true) {
  const row = document.createElement("div");
  row.className = "msg user";
  if (!animate) row.style.animation = "none";
  row.innerHTML = `
    <div class="bubble-user">${escapeHtml(text)}</div>
    <div class="timestamp">${currentTime()}</div>
  `;
  chatWindow.appendChild(row);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function addSystemMessage(text, isError = false) {
  const row = document.createElement("div");
  row.className = "sys-msg" + (isError ? " error-msg" : "");
  row.textContent = text;
  chatWindow.appendChild(row);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function showProcessingIndicator() {
  const row = document.createElement("div");
  row.className = "msg bot";
  row.innerHTML = `
    <div class="bot-label">🤖 Assistant</div>
    <div class="bubble-bot">
      <div class="proc-box">
        <div class="proc-dots">
          <div class="proc-dot"></div><div class="proc-dot"></div><div class="proc-dot"></div>
        </div>
        <div class="proc-status">Thinking... <span class="elapsed">0.0s</span></div>
      </div>
    </div>
  `;
  chatWindow.appendChild(row);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return row;
}

function addAssistantMessageInstant(text, sources, animate = true) {
  const row = buildBotRow(marked.parse(text), sources, false, animate);
  chatWindow.appendChild(row);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function typewriterAssistantMessage(text, sources) {
  return new Promise((resolve) => {
    const row = buildBotRow("", sources, true, true);
    chatWindow.appendChild(row);
    const contentEl = row.querySelector(".typed-content");

    let i = 0;
    const speed = 10;

    function typeNext() {
      if (i < text.length) {
        contentEl.textContent = text.slice(0, i + 1);
        i++;
        chatWindow.scrollTop = chatWindow.scrollHeight;
        setTimeout(typeNext, speed);
      } else {
        row.querySelector(".bubble-bot").innerHTML =
          marked.parse(text) + row.querySelector(".sources-block").outerHTML;
        chatWindow.scrollTop = chatWindow.scrollHeight;
        resolve();
      }
    }
    typeNext();
  });
}

function buildBotRow(innerHtml, sources, useTypedSpan, animate) {
  const row = document.createElement("div");
  row.className = "msg bot";
  if (!animate) row.style.animation = "none";

  let sourcesHtml = "";
  (sources || []).forEach((src) => {
    sourcesHtml += `
      <div class="source-chip">
        <span>🔍</span>
        <span>${escapeHtml(src.file)}</span>
        <span class="relevance-tag">${src.score}</span>
      </div>
    `;
  });

  const bodyHtml = useTypedSpan
    ? `<span class="typed-content"></span><span class="typing-cursor"></span>`
    : innerHtml;

  row.innerHTML = `
    <div class="bot-label">🤖 Assistant</div>
    <div class="bubble-bot">
      ${bodyHtml}
      <div class="sources-block">${sourcesHtml}</div>
    </div>
    <div class="timestamp">${currentTime()}</div>
  `;
  return row;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}