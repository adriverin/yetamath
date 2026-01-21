const STORAGE_KEY = "zetamac_arithmetic_settings_v1";
const REVEAL_DELAY_MS = 500;
const DEFAULTS = {
  duration: 120,
  revealDelay: REVEAL_DELAY_MS / 1000,
  operations: {
    add: true,
    sub: true,
    mul: true,
    div: true,
  },
  addRange: {
    minA: 2,
    maxA: 12,
    minB: 2,
    maxB: 12,
  },
  mulRange: {
    minA: 2,
    maxA: 12,
    minB: 2,
    maxB: 12,
  },
};

const screens = {
  settings: document.getElementById("settings-screen"),
  game: document.getElementById("game-screen"),
  end: document.getElementById("end-screen"),
};

const elements = {
  opAdd: document.getElementById("op-add"),
  opSub: document.getElementById("op-sub"),
  opMul: document.getElementById("op-mul"),
  opDiv: document.getElementById("op-div"),
  addMinA: document.getElementById("add-min-a"),
  addMaxA: document.getElementById("add-max-a"),
  addMinB: document.getElementById("add-min-b"),
  addMaxB: document.getElementById("add-max-b"),
  mulMinA: document.getElementById("mul-min-a"),
  mulMaxA: document.getElementById("mul-max-a"),
  mulMinB: document.getElementById("mul-min-b"),
  mulMaxB: document.getElementById("mul-max-b"),
  duration: document.getElementById("duration"),
  revealDelay: document.getElementById("reveal-delay"),
  startBtn: document.getElementById("start-btn"),
  warning: document.getElementById("op-warning"),
  score: document.getElementById("score"),
  time: document.getElementById("time"),
  problemLeft: document.getElementById("problem-left"),
  answerSlot: document.getElementById("answer-slot"),
  answerMirror: document.getElementById("answer-mirror"),
  answerInput: document.getElementById("answer-input"),
  historyPanel: document.getElementById("history-panel"),
  historyList: document.getElementById("history-list"),
  finalScore: document.getElementById("final-score"),
  finalPpm: document.getElementById("final-ppm"),
  restartBtn: document.getElementById("restart-btn"),
};

const opRows = {
  add: document.querySelector('[data-op="add"]'),
  sub: document.querySelector('[data-op="sub"]'),
  mul: document.querySelector('[data-op="mul"]'),
  div: document.querySelector('[data-op="div"]'),
};

let activeSettings = null;
let currentProblem = null;
let score = 0;
let timerId = null;
let endTime = 0;
let durationSeconds = 0;
let gameActive = false;
let isRevealing = false;
let pendingEnd = false;
let revealTimeoutId = null;
let answerBaseWidth = 2;

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULTS));
}

function toInt(value, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  return Math.trunc(num);
}

function toFloat(value, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  return num;
}

function normalizeRange(range, defaults, minFloor) {
  let minA = toInt(range.minA, defaults.minA);
  let maxA = toInt(range.maxA, defaults.maxA);
  let minB = toInt(range.minB, defaults.minB);
  let maxB = toInt(range.maxB, defaults.maxB);

  minA = Math.max(minFloor, minA);
  maxA = Math.max(minFloor, maxA);
  minB = Math.max(minFloor, minB);
  maxB = Math.max(minFloor, maxB);

  if (minA > maxA) {
    [minA, maxA] = [maxA, minA];
  }
  if (minB > maxB) {
    [minB, maxB] = [maxB, minB];
  }

  return { minA, maxA, minB, maxB };
}

function normalizeSettings(settings) {
  const defaults = cloneDefaults();
  const operations = settings.operations || {};
  const durationValue = toInt(settings.duration, defaults.duration);
  const allowedDurations = [30, 60, 90, 120, 300];
  const normalizeOp = (value, fallback) =>
    typeof value === "boolean" ? value : fallback;

  let revealDelay = toFloat(settings.revealDelay, defaults.revealDelay);
  if (!Number.isFinite(revealDelay)) {
    revealDelay = defaults.revealDelay;
  }
  revealDelay = Math.min(5, Math.max(0, revealDelay));

  return {
    duration: allowedDurations.includes(durationValue)
      ? durationValue
      : defaults.duration,
    revealDelay,
    operations: {
      add: normalizeOp(operations.add, defaults.operations.add),
      sub: normalizeOp(operations.sub, defaults.operations.sub),
      mul: normalizeOp(operations.mul, defaults.operations.mul),
      div: normalizeOp(operations.div, defaults.operations.div),
    },
    addRange: normalizeRange(settings.addRange || {}, defaults.addRange, 0),
    mulRange: normalizeRange(settings.mulRange || {}, defaults.mulRange, 1),
  };
}

function loadSettings() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return cloneDefaults();
  }
  try {
    return normalizeSettings(JSON.parse(raw));
  } catch (err) {
    return cloneDefaults();
  }
}

function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function applySettingsToForm(settings) {
  elements.opAdd.checked = settings.operations.add;
  elements.opSub.checked = settings.operations.sub;
  elements.opMul.checked = settings.operations.mul;
  elements.opDiv.checked = settings.operations.div;

  elements.addMinA.value = settings.addRange.minA;
  elements.addMaxA.value = settings.addRange.maxA;
  elements.addMinB.value = settings.addRange.minB;
  elements.addMaxB.value = settings.addRange.maxB;

  elements.mulMinA.value = settings.mulRange.minA;
  elements.mulMaxA.value = settings.mulRange.maxA;
  elements.mulMinB.value = settings.mulRange.minB;
  elements.mulMaxB.value = settings.mulRange.maxB;

  elements.duration.value = String(settings.duration);
  elements.revealDelay.value = String(settings.revealDelay);
}

function readSettingsFromForm() {
  const settings = {
    duration: elements.duration.value,
    revealDelay: elements.revealDelay.value,
    operations: {
      add: elements.opAdd.checked,
      sub: elements.opSub.checked,
      mul: elements.opMul.checked,
      div: elements.opDiv.checked,
    },
    addRange: {
      minA: elements.addMinA.value,
      maxA: elements.addMaxA.value,
      minB: elements.addMinB.value,
      maxB: elements.addMaxB.value,
    },
    mulRange: {
      minA: elements.mulMinA.value,
      maxA: elements.mulMaxA.value,
      minB: elements.mulMinB.value,
      maxB: elements.mulMaxB.value,
    },
  };

  return normalizeSettings(settings);
}

function showScreen(name) {
  Object.keys(screens).forEach((key) => {
    screens[key].classList.toggle("hidden", key !== name);
  });
}

function anyOperationSelected() {
  return (
    elements.opAdd.checked ||
    elements.opSub.checked ||
    elements.opMul.checked ||
    elements.opDiv.checked
  );
}

function syncOperationState() {
  const addEnabled = elements.opAdd.checked;
  const subEnabled = elements.opSub.checked;
  const mulEnabled = elements.opMul.checked;
  const divEnabled = elements.opDiv.checked;

  opRows.add.classList.toggle("is-disabled", !addEnabled);
  opRows.sub.classList.toggle("is-disabled", !subEnabled);
  opRows.mul.classList.toggle("is-disabled", !mulEnabled);
  opRows.div.classList.toggle("is-disabled", !divEnabled);

  elements.addMinA.disabled = !addEnabled;
  elements.addMaxA.disabled = !addEnabled;
  elements.addMinB.disabled = !addEnabled;
  elements.addMaxB.disabled = !addEnabled;

  elements.mulMinA.disabled = !mulEnabled;
  elements.mulMaxA.disabled = !mulEnabled;
  elements.mulMinB.disabled = !mulEnabled;
  elements.mulMaxB.disabled = !mulEnabled;

  const anySelected = anyOperationSelected();
  elements.startBtn.disabled = !anySelected;
  elements.warning.classList.toggle("hidden", anySelected);
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickOperation(settings) {
  const ops = [];
  if (settings.operations.add) {
    ops.push("add");
  }
  if (settings.operations.sub) {
    ops.push("sub");
  }
  if (settings.operations.mul) {
    ops.push("mul");
  }
  if (settings.operations.div) {
    ops.push("div");
  }
  return ops[Math.floor(Math.random() * ops.length)];
}

function makeProblem(settings) {
  const op = pickOperation(settings);

  if (op === "add") {
    const range = settings.addRange;
    const a = randomInt(range.minA, range.maxA);
    const b = randomInt(range.minB, range.maxB);
    const answer = a + b;
    return {
      display: `${a} + ${b} =`,
      answer,
      history: `${a} + ${b} = ${answer}`,
    };
  }

  if (op === "sub") {
    const range = settings.addRange;
    const a = randomInt(range.minA, range.maxA);
    const b = randomInt(range.minB, range.maxB);
    const total = a + b;
    const answer = b;
    return {
      display: `${total} \u2212 ${a} =`,
      answer,
      history: `${total} \u2212 ${a} = ${answer}`,
    };
  }

  if (op === "mul") {
    const range = settings.mulRange;
    const a = randomInt(range.minA, range.maxA);
    const b = randomInt(range.minB, range.maxB);
    const answer = a * b;
    return {
      display: `${a} \u00D7 ${b} =`,
      answer,
      history: `${a} \u00D7 ${b} = ${answer}`,
    };
  }

  const range = settings.mulRange;
  const a = randomInt(range.minA, range.maxA);
  const b = randomInt(range.minB, range.maxB);
  const product = a * b;
  const answer = b;
  return {
    display: `${product} \u00F7 ${a} =`,
    answer,
    history: `${product} \u00F7 ${a} = ${answer}`,
  };
}

function updateScore() {
  elements.score.textContent = String(score);
}

function updateTimeDisplay(seconds) {
  elements.time.textContent = String(seconds);
}

function clearHistory() {
  elements.historyList.textContent = "";
  elements.historyPanel.scrollTop = elements.historyPanel.scrollHeight;
}

function appendHistory(problem) {
  const previousRecent = elements.historyList.querySelector(".is-recent");
  if (previousRecent) {
    previousRecent.classList.remove("is-recent");
    previousRecent.classList.add("is-old");
  }

  const item = document.createElement("div");
  item.className = "history-item is-recent";
  item.textContent = problem.history;
  elements.historyList.appendChild(item);
  elements.historyPanel.scrollTop = elements.historyPanel.scrollHeight;
}

function setAnswerWidth(value) {
  const length = value.length;
  const width = Math.max(answerBaseWidth, length || 0);
  elements.answerSlot.style.width = `${width}ch`;
}

function setAnswerMirror(value) {
  elements.answerMirror.textContent = value || "\u00A0";
}

function focusInput() {
  if (!elements.answerInput.disabled) {
    elements.answerInput.focus();
  }
}

function startTimer(seconds) {
  clearInterval(timerId);
  const start = performance.now();
  endTime = start + seconds * 1000;

  timerId = setInterval(() => {
    if (!gameActive) {
      return;
    }
    const remainingMs = Math.max(0, endTime - performance.now());
    const display = Math.ceil(remainingMs / 1000);
    updateTimeDisplay(display);

    if (remainingMs <= 0) {
      if (isRevealing) {
        pendingEnd = true;
        clearInterval(timerId);
        updateTimeDisplay(0);
        return;
      }
      endGame();
    }
  }, 100);
}

function nextProblem() {
  currentProblem = makeProblem(activeSettings);
  elements.problemLeft.textContent = currentProblem.display;
  answerBaseWidth = Math.max(2, String(currentProblem.answer).length);
  elements.answerInput.value = "";
  setAnswerMirror("");
  setAnswerWidth("");
}

function startRevealDelay() {
  const delayMs = Math.max(0, activeSettings.revealDelay * 1000);
  if (revealTimeoutId) {
    clearTimeout(revealTimeoutId);
  }

  revealTimeoutId = setTimeout(() => {
    appendHistory(currentProblem);

    if (pendingEnd) {
      endGame();
      return;
    }

    isRevealing = false;
    elements.answerInput.readOnly = false;
    nextProblem();
    focusInput();
  }, delayMs);
}

function startGame() {
  activeSettings = readSettingsFromForm();
  saveSettings(activeSettings);
  applySettingsToForm(activeSettings);
  syncOperationState();

  durationSeconds = activeSettings.duration;
  score = 0;
  updateScore();
  clearHistory();
  updateTimeDisplay(activeSettings.duration);

  elements.answerInput.value = "";
  setAnswerMirror("");
  elements.answerInput.readOnly = false;
  elements.answerInput.disabled = false;
  gameActive = true;
  isRevealing = false;
  pendingEnd = false;
  if (revealTimeoutId) {
    clearTimeout(revealTimeoutId);
  }

  showScreen("game");
  nextProblem();
  focusInput();
  startTimer(activeSettings.duration);
}

function endGame() {
  if (!gameActive) {
    return;
  }
  gameActive = false;
  clearInterval(timerId);
  if (revealTimeoutId) {
    clearTimeout(revealTimeoutId);
  }
  updateTimeDisplay(0);
  elements.answerInput.disabled = true;

  const ppm = durationSeconds ? (score / durationSeconds) * 60 : 0;
  elements.finalScore.textContent = String(score);
  elements.finalPpm.textContent = ppm.toFixed(1);
  showScreen("end");
}

function handleInput() {
  if (!gameActive || !currentProblem || isRevealing) {
    return;
  }
  const cleaned = elements.answerInput.value.replace(/\D/g, "");
  if (elements.answerInput.value !== cleaned) {
    elements.answerInput.value = cleaned;
  }
  setAnswerMirror(cleaned);
  setAnswerWidth(cleaned);
  if (!cleaned) {
    return;
  }

  if (cleaned === String(currentProblem.answer)) {
    score += 1;
    updateScore();
    isRevealing = true;
    elements.answerInput.readOnly = true;
    startRevealDelay();
  }
}

function init() {
  const settings = loadSettings();
  applySettingsToForm(settings);
  syncOperationState();
  showScreen("settings");

  elements.opAdd.addEventListener("change", syncOperationState);
  elements.opSub.addEventListener("change", syncOperationState);
  elements.opMul.addEventListener("change", syncOperationState);
  elements.opDiv.addEventListener("change", syncOperationState);

  elements.startBtn.addEventListener("click", () => {
    if (!anyOperationSelected()) {
      syncOperationState();
      return;
    }
    startGame();
  });

  elements.restartBtn.addEventListener("click", () => {
    showScreen("settings");
    elements.startBtn.focus();
  });

  elements.answerInput.addEventListener("input", handleInput);
  screens.game.addEventListener("click", focusInput);
}

init();
