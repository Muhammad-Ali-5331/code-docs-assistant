// ===== Element references =====
const repoUrlInput = document.getElementById("repoUrl");
const cloneBtn = document.getElementById("cloneBtn");
const questionInput = document.getElementById("questionInput");
const sendBtn = document.getElementById("sendBtn");
const chatWindow = document.getElementById("chatWindow");
const emptyState = document.getElementById("emptyState");
const activeRepoName = document.getElementById("activeRepoName");
const statusDot = document.getElementById("statusDot");

const stepClone = document.getElementById("step-clone");
const stepParse = document.getElementById("step-parse");
const stepVector = document.getElementById("step-vector");

// ===== Helper: update a step's visual state =====
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

    // NOTE: this is a simple version — the backend does clone + load + chunk + embed
    // all in one call, so we just mark all steps complete once it succeeds.
    // If you want real step-by-step progress, the backend would need to stream
    // status updates (e.g. via Server-Sent Events) instead of one blocking call.

    setStep(stepClone, "complete", "Complete");
    setStep(stepParse, "active", "Processing...");

    const data = await response.json();

    if (data.status === "success") {
      setStep(stepParse, "complete", "Complete");
      setStep(stepVector, "complete", "Ready");

      activeRepoName.textContent = repoUrl.split("/").slice(-1)[0];
      statusDot.classList.add("online");

      questionInput.disabled = false;
      sendBtn.disabled = false;
      emptyState.style.display = "none";

      addSystemMessage("✨ Setup complete! You can now ask questions about this codebase.");
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

// ===== Send question =====
async function sendQuestion() {
  const question = questionInput.value.trim();
  if (!question) return;

  addUserMessage(question);
  questionInput.value = "";
  questionInput.disabled = true;
  sendBtn.disabled = true;

  showTypingIndicator();

  try {
    const response = await fetch("/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    const data = await response.json();

    removeTypingIndicator();

    if (data.answer) {
      addAssistantMessage(data.answer, data.sources || []);
    } else {
      addAssistantMessage("Error: " + (data.error || "Could not get an answer."), []);
    }
  } catch (err) {
    removeTypingIndicator();
    addAssistantMessage("Request failed: " + err.message, []);
  } finally {
    questionInput.disabled = false;
    sendBtn.disabled = false;
    questionInput.focus();
  }
}

sendBtn.addEventListener("click", sendQuestion);
questionInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendQuestion();
});

// ===== Render helpers =====
function addSystemMessage(text) {
  const row = document.createElement("div");
  row.className = "system-message";
  row.textContent = text;
  chatWindow.appendChild(row);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function showTypingIndicator() {
  const row = document.createElement("div");
  row.className = "msg-row assistant";
  row.id = "typingRow";
  row.innerHTML = `
    <div class="assistant-label">🤖 Assistant</div>
    <div class="bubble-assistant">
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>
  `;
  chatWindow.appendChild(row);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function removeTypingIndicator() {
  const row = document.getElementById("typingRow");
  if (row) row.remove();
}

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

function addAssistantMessage(text, sources) {
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

  row.innerHTML = `
    <div class="assistant-label">🤖 Assistant</div>
    <div class="bubble-assistant">
      ${marked.parse(text)}
      ${sourcesHtml}
    </div>
    <div class="timestamp">${currentTime()}</div>
  `;
  chatWindow.appendChild(row);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}