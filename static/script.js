// ===== Element references =====
const side = document.getElementById("side");
const sideOverlay = document.getElementById("sideOverlay");
const openSideBtn = document.getElementById("openSideBtn");
const closeSideBtn = document.getElementById("closeSideBtn");
const newChatBtn = document.getElementById("newChatBtn");
const projectList = document.getElementById("projectList");

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
  repoUrlInput.placeholder = "Sign in to index a repository...";
  questionInput.disabled = true;
  questionInput.placeholder = "Sign in to ask questions...";
  sendBtn.disabled = true;
  showSignInGate();
}

function unlockApp() {
  isSignedIn = true;
  cloneBtn.disabled = false;
  repoUrlInput.disabled = false;
  repoUrlInput.placeholder = "https://github.com/user/repo";
  hideSignInGate();
}

function showSignInGate() {
  let gate = document.getElementById("signInGate");
  if (!gate) {
    gate = document.createElement("div");
    gate.id = "signInGate";
    gate.className = "signin-gate";
    gate.innerHTML = `
      <div class="signin-gate-inner">
        <div class="signin-gate-icon">🔒</div>
        <div class="signin-gate-title">Sign in required</div>
        <div class="signin-gate-text">Please sign in to index a repository and start chatting.</div>
        <button class="cta-btn" id="gateSignInBtn">Sign In</button>
      </div>
    `;
    newProjectPanel.appendChild(gate);
    document.getElementById("gateSignInBtn").addEventListener("click", goToSignIn);
  }
  gate.classList.remove("hidden");
}
function hideSignInGate() {
  const gate = document.getElementById("signInGate");
  if (gate) gate.classList.add("hidden");
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
      renderProjectList();
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
  cloneBtn.disabled = !isSignedIn;
  cloneBtnText.textContent = "Index Repository";
  renderProjectList();
  closeSide();
});

// ===== Load the user's project list into the sidebar, with a loading state =====
async function loadProjects() {
  projectList.innerHTML = `
    <div class="project-loading">
      <div class="mini-spinner"></div>
      <span>Loading projects...</span>
    </div>
  `;

  try {
    const token = await getFreshToken();
    const res = await fetch("/projects", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    projectsCache = data.projects || [];
    renderProjectList();
  } catch (err) {
    projectList.innerHTML = `<div class="project-empty">Couldn't load projects. <button class="text-link" onclick="loadProjects()">Retry</button></div>`;
  }
}

function renderProjectList() {
  projectList.innerHTML = "";

  if (!isSignedIn) {
    const empty = document.createElement("div");
    empty.className = "project-empty";
    empty.textContent = "Sign in to see your projects.";
    projectList.appendChild(empty);
    return;
  }

  if (projectsCache.length === 0) {
    const empty = document.createElement("div");
    empty.className = "project-empty";
    empty.innerHTML = `No projects yet.<br>Start one with <strong>+ New Project</strong> above.`;
    projectList.appendChild(empty);
    return;
  }

  projectsCache.forEach((p, index) => {
    const repoName = p.repo_url.split("/").filter(Boolean).slice(-1)[0] || p.repo_url;
    const item = document.createElement("div");
    item.className = "project-item" + (p.project_id === activeProjectId ? " active" : "");
    item.style.animationDelay = `${index * 0.04}s`;
    item.innerHTML = `
      <div class="project-icon">📁</div>
      <div class="project-text">
        <div class="project-name">${escapeHtml(repoName)}</div>
        <div class="project-date">${formatDate(p.created_at)}</div>
      </div>
      <button class="project-delete-btn" title="Delete project" data-id="${p.project_id}">🗑</button>
    `;
    item.addEventListener("click", (e) => {
      if (e.target.closest(".project-delete-btn")) return;
      openProject(p.project_id, repoName);
    });
    const delBtn = item.querySelector(".project-delete-btn");
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      confirmDeleteProject(p.project_id, repoName);
    });
    projectList.appendChild(item);
  });
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

// ===== Delete a project =====
function confirmDeleteProject(projectId, repoName) {
  const ok = window.confirm(`Delete "${repoName}"? This cannot be undone.`);
  if (!ok) return;
  deleteProject(projectId);
}

async function deleteProject(projectId) {
  const item = document.querySelector(`.project-delete-btn[data-id="${projectId}"]`)?.closest(".project-item");
  if (item) {
    item.classList.add("deleting");
    await new Promise((resolve) => setTimeout(resolve, 350));
  }

  try {
    const token = await getFreshToken();
    const res = await fetch(`/projects/${projectId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    if (data.status === "success") {
      projectsCache = projectsCache.filter((p) => p.project_id !== projectId);
      if (activeProjectId === projectId) {
        newChatBtn.click();
      } else {
        renderProjectList();
      }
    } else {
      if (item) item.classList.remove("deleting");
      alert("Could not delete project: " + (data.message || "Unknown error"));
    }
  } catch (err) {
    if (item) item.classList.remove("deleting");
    alert("Request failed: " + err.message);
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
  questionInput.disabled = true;
  sendBtn.disabled = true;

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
          addUserMessage(c.question, false, c.timestamp);
          addAssistantMessageInstant(c.answer, [], false, c.timestamp);
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

// ===== Index a new repository (handles success / already-exists / error) =====
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

    const repoName = repoUrl.split("/").filter(Boolean).slice(-1)[0];

    if (data.status === "exists") {
      // This repo was already indexed before — just open the existing project instead
      setStep(stepVector, "complete");
      await loadProjects();
      openProject(data.project_id, repoName);
      return;
    }

    if (data.status === "success") {
      setStep(stepVector, "complete");
      activeProjectId = data.project_id;
      topTitle.textContent = repoName;

      await loadProjects();

      newProjectPanel.classList.add("hidden");
      chatView.classList.remove("hidden");
      chatWindow.innerHTML = "";
      addSystemMessage("✨ Setup complete! Ask me anything about this codebase.");

      questionInput.disabled = false;
      sendBtn.disabled = false;
    } else {
      resetSteps();
      showInlineError(data.message || "Could not process this repository.");
    }
  } catch (err) {
    resetSteps();
    showInlineError("Request failed: " + err.message);
  } finally {
    cloneBtn.disabled = !isSignedIn;
    cloneBtnText.textContent = "Index Repository";
  }
});

function showInlineError(message) {
  let banner = document.getElementById("newProjectError");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "newProjectError";
    banner.className = "np-error";
    document.querySelector(".np-card").appendChild(banner);
  }
  banner.textContent = message;
  banner.classList.remove("hidden");
  clearTimeout(banner._hideTimer);
  banner._hideTimer = setTimeout(() => banner.classList.add("hidden"), 6000);
}

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

function resetComposerUI() {
  questionInput.disabled = false;
  sendBtn.disabled = false;
  sendBtn.classList.remove("hidden");
  stopBtn.classList.add("hidden");
  currentAbortController = null;
  questionInput.focus();
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
      body: JSON.stringify({ project_id: activeProjectId, question }),
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
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ project_id: activeProjectId }),
        }).catch(() => {});
      });
      addSystemMessage("⏹ Response stopped.", true);
    } else {
      addAssistantMessageInstant("Request failed: " + err.message, []);
    }
  } finally {
    resetComposerUI();
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
function formatTimestamp(isoString) {
  const d = isoString ? new Date(isoString) : new Date();
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function addUserMessage(text, animate = true, savedTimestamp = null) {
  const row = document.createElement("div");
  row.className = "msg user";
  if (!animate) row.style.animation = "none";
  row.innerHTML = `
    <div class="bubble-user">${escapeHtml(text)}</div>
    <div class="timestamp">${formatTimestamp(savedTimestamp)}</div>
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

function addAssistantMessageInstant(text, sources, animate = true, savedTimestamp = null) {
  const row = buildBotRow(marked.parse(text), sources, false, animate, savedTimestamp);
  chatWindow.appendChild(row);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function typewriterAssistantMessage(text, sources) {
  return new Promise((resolve) => {
    const row = buildBotRow("", sources, true, true, null);
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

function buildBotRow(innerHtml, sources, useTypedSpan, animate, savedTimestamp) {
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
    <div class="timestamp">${formatTimestamp(savedTimestamp)}</div>
  `;
  return row;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}