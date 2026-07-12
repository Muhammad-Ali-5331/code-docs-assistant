// ===== Element references =====
const repoUrlInput = document.getElementById("repoUrl");
const cloneBtn = document.getElementById("cloneBtn");
const questionInput = document.getElementById("questionInput");
const sendBtn = document.getElementById("sendBtn");
const stopBtn = document.getElementById("stopBtn");
const chatWindow = document.getElementById("chatWindow");
const emptyState = document.getElementById("emptyState");
const activeRepoName = document.getElementById("activeRepoName");
const statusDot = document.getElementById("statusDot");

const sidebar = document.getElementById("sidebar");
const drawerOverlay = document.getElementById("drawerOverlay");
const openDrawerBtn = document.getElementById("openDrawerBtn");
const closeDrawerBtn = document.getElementById("closeDrawerBtn");

const stepClone = document.getElementById("step-clone");
const stepParse = document.getElementById("step-parse");
const stepVector = document.getElementById("step-vector");

// ===== Clerk Auth (header-based, non-blocking) =====
let clerkToken = null;
let isSignedIn = false;

const signInBtn = document.getElementById("signInBtn");
const userButtonSlot = document.getElementById("userButtonSlot");

// Disable app interactions until the user signs in
function lockAppForSignedOut() {
  isSignedIn = false;
  repoUrlInput.disabled = true;
  cloneBtn.disabled = true;
  questionInput.disabled = true;
  sendBtn.disabled = true;
  repoUrlInput.placeholder = "Please sign in to use this app...";
  questionInput.placeholder = "Please sign in to ask questions...";
}

// Re-enable the repo/clone controls once signed in
// (question input stays disabled until a repo is actually processed — unchanged existing behavior)
function unlockAppForSignedIn() {
  isSignedIn = true;
  repoUrlInput.disabled = false;
  cloneBtn.disabled = false;
  repoUrlInput.placeholder = "https://github.com/user/repo";
  questionInput.placeholder = "Ask about your codebase...";
}

const waitForClerk = setInterval(async () => {
  if (window.Clerk) {
    clearInterval(waitForClerk);
    await window.Clerk.load();

    if (window.Clerk.user) {
      clerkToken = await window.Clerk.session.getToken();
      unlockAppForSignedIn();
      renderUserAvatar(window.Clerk.user);
    } else {
      lockAppForSignedOut();
      signInBtn.classList.remove("hidden");
      userButtonSlot.classList.add("hidden");
    }
  }
}, 100);

// Build a small custom avatar + dropdown ourselves — avoids Clerk's mountUserButton(),
// which throws "not loaded with Ui components" intermittently in plain JS setups.
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

  document.addEventListener("click", () => {
    avatarDropdown.classList.add("hidden");
  });

  signOutBtn.addEventListener("click", async () => {
    await window.Clerk.signOut();
    window.location.reload();
  });
}

signInBtn.addEventListener("click", () => {
  window.Clerk.redirectToSignIn({ redirectUrl: window.location.href });
});

// Also lock the app immediately on first paint (before Clerk finishes loading)
lockAppForSignedOut();

// ===== Drawer (sidebar) open/close — mobile + desktop toggle =====
function openDrawer() {
  sidebar.classList.add("open");
  drawerOverlay.classList.add("visible");
}
function closeDrawer() {
  sidebar.classList.remove("open");
  drawerOverlay.classList.remove("visible");
}
openDrawerBtn.addEventListener("click", openDrawer);
closeDrawerBtn.addEventListener("click", closeDrawer);
drawerOverlay.addEventListener("click", closeDrawer);

// ===== Step helpers =====
function setStep(stepEl, state, statusText) {
  stepEl.classList.remove("active", "complete");
  if (state) stepEl.classList.add(state);
  stepEl.querySelector(".step-status").textContent = statusText;
}
function resetSteps() {
  setStep(stepClone, null, "Waiting");
  setStep(stepParse, null, "Waiting");
  setStep(stepVector, null, "Pending");
}

// ===== Clone & Index button =====
cloneBtn.addEventListener("click", async () => {
  const repoUrl = repoUrlInput.value.trim();
  if (!repoUrl) return;

  cloneBtn.disabled = true;
  questionInput.disabled = true;
  sendBtn.disabled = true;
  statusDot.classList.remove("online");

  resetSteps();
  setStep(stepClone, "active", "Cloning...");

  try {
    const response = await fetch("/process_repo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repo_url: repoUrl }),
    });

    setStep(stepClone, "complete", "Complete");
    setStep(stepParse, "active", "Processing...");

    const data = await response.json();

    if (data.status === "success") {
      setStep(stepParse, "complete", "Complete");
      setStep(stepVector, "complete", "Ready");

      activeRepoName.textContent = repoUrl.split("/").filter(Boolean).slice(-1)[0];
      statusDot.classList.add("online");

      questionInput.disabled = false;
      sendBtn.disabled = false;
      emptyState.style.display = "none";

      addSystemMessage("✨ Setup complete! You can now ask questions about this codebase.");
      closeDrawer();
    } else {
      setStep(stepParse, null, "Failed");
      alert("Error processing repo: " + (data.error || "Unknown error"));
    }
  } catch (err) {
    alert("Request failed: " + err.message);
  } finally {
    cloneBtn.disabled = false;
  }
});

// ===== Send / Stop question handling =====
let currentAbortController = null;
let timerInterval = null;
let timerStart = null;

function startTimer(statusEl) {
  timerStart = Date.now();
  timerInterval = setInterval(() => {
    const seconds = ((Date.now() - timerStart) / 1000).toFixed(1);
    statusEl.innerHTML = `Processing request... <span class="elapsed">${seconds}s</span>`;
  }, 100);
}
function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

async function sendQuestion() {
  const question = questionInput.value.trim();
  if (!question) return;

  addUserMessage(question);
  questionInput.value = "";
  questionInput.disabled = true;
  sendBtn.disabled = true;
  sendBtn.classList.add("hidden");
  stopBtn.classList.remove("hidden");

  const processingRow = showProcessingIndicator();
  startTimer(processingRow.querySelector(".processing-status"));

  currentAbortController = new AbortController();

  try {
    const response = await fetch("/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
      signal: currentAbortController.signal,
    });
    const data = await response.json();

    stopTimer();
    processingRow.remove();

    if (data.answer) {
      await typewriterAssistantMessage(data.answer, data.sources || []);
    } else {
      addAssistantMessageInstant("Error: " + (data.error || "Could not get an answer."), []);
    }
  } catch (err) {
    stopTimer();
    processingRow.remove();

    if (err.name === "AbortError") {
      // User clicked stop — tell the backend to stop the in-flight generation too
      fetch("/stop", { method: "POST" }).catch(() => {});
      addSystemMessage("⏹ Response stopped by user.", true);
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
  if (currentAbortController) {
    currentAbortController.abort();
  }
});

sendBtn.addEventListener("click", sendQuestion);
questionInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendQuestion();
});

// ===== Render helpers =====
function currentTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function addUserMessage(text) {
  const row = document.createElement("div");
  row.className = "msg-row user";
  row.innerHTML = `
    <div class="bubble-user">${escapeHtml(text)}</div>
    <div class="timestamp">${currentTime()}</div>
  `;
  chatWindow.appendChild(row);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function addSystemMessage(text, isStopped = false) {
  const row = document.createElement("div");
  row.className = "system-message" + (isStopped ? " stopped-message" : "");
  row.textContent = text;
  chatWindow.appendChild(row);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Shows the animated dots + "Processing request... Xs" line, returns the row element
function showProcessingIndicator() {
  const row = document.createElement("div");
  row.className = "msg-row assistant";
  row.innerHTML = `
    <div class="assistant-label">🤖 Assistant</div>
    <div class="bubble-assistant">
      <div class="processing-box">
        <div class="processing-row">
          <div class="typing-indicator">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
          </div>
        </div>
        <div class="processing-status">Processing request... <span class="elapsed">0.0s</span></div>
      </div>
    </div>
  `;
  chatWindow.appendChild(row);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return row;
}

// Renders the final answer instantly (used for errors — no need to "type" those)
function addAssistantMessageInstant(text, sources) {
  const row = buildAssistantRow(marked.parse(text), sources);
  chatWindow.appendChild(row);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Renders the final answer with a typewriter effect.
// NOTE: types the raw text (so markdown symbols are briefly visible while typing),
// then swaps to fully rendered Markdown once typing finishes — full markdown
// can't be safely rendered character-by-character without breaking tags mid-type.
function typewriterAssistantMessage(text, sources) {
  return new Promise((resolve) => {
    const row = buildAssistantRow("", sources, true);
    chatWindow.appendChild(row);
    const contentEl = row.querySelector(".typed-content");

    let i = 0;
    const speed = 12; // ms per character — tweak for faster/slower typing

    function typeNext() {
      if (i < text.length) {
        contentEl.textContent = text.slice(0, i + 1);
        i++;
        chatWindow.scrollTop = chatWindow.scrollHeight;
        setTimeout(typeNext, speed);
      } else {
        // Typing done — swap in fully rendered Markdown (this also removes the blinking cursor)
        row.querySelector(".bubble-assistant").innerHTML =
          marked.parse(text) + row.querySelector(".sources-block").outerHTML;
        chatWindow.scrollTop = chatWindow.scrollHeight;
        resolve();
      }
    }
    typeNext();
  });
}

function buildAssistantRow(innerHtml, sources, useTypedSpan = false) {
  const row = document.createElement("div");
  row.className = "msg-row assistant";

  let sourcesHtml = "";
  sources.forEach((src) => {
    sourcesHtml += `
      <div class="source-chip">
        <span>🔍</span>
        <span>${escapeHtml(src.file)}</span>
        <span class="relevance-tag">RELEVANCE: ${src.score}</span>
      </div>
    `;
  });

  const bodyHtml = useTypedSpan
    ? `<span class="typed-content"></span><span class="typing-cursor"></span>`
    : innerHtml;

  row.innerHTML = `
    <div class="assistant-label">🤖 Assistant</div>
    <div class="bubble-assistant">
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