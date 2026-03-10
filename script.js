const STORAGE_KEY = "pomodoro_settings_v1";
const STATS_KEY = "pomodoro_daily_stats_v1";

const defaultSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakInterval: 4,
};

const modeText = {
  focus: "Focus Time",
  shortBreak: "Short Break",
  longBreak: "Long Break",
};

const app = document.querySelector(".app");
const modeButtons = [...document.querySelectorAll(".mode-btn")];
const modeLabel = document.getElementById("modeLabel");
const timeDisplay = document.getElementById("timeDisplay");
const statusText = document.getElementById("statusText");
const ring = document.querySelector(".timer-ring");
const startPauseBtn = document.getElementById("startPauseBtn");
const resetBtn = document.getElementById("resetBtn");
const skipBtn = document.getElementById("skipBtn");
const completedCount = document.getElementById("completedCount");
const settingsForm = document.getElementById("settingsForm");
const focusInput = document.getElementById("focusInput");
const shortBreakInput = document.getElementById("shortBreakInput");
const longBreakInput = document.getElementById("longBreakInput");
const intervalInput = document.getElementById("intervalInput");

let settings = loadSettings();
let mode = "focus";
let totalSeconds = settings.focusMinutes * 60;
let remainingSeconds = totalSeconds;
let completedFocusSessions = loadDailyStats();
let timerId = null;
let endTimestamp = null;

syncSettingsForm();
updateCompletedCount();
updateModeButtons();
render();

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const targetMode = button.dataset.mode;
    switchMode(targetMode);
  });
});

startPauseBtn.addEventListener("click", () => {
  if (timerId) {
    pauseTimer("Paused");
    return;
  }
  startTimer();
});

resetBtn.addEventListener("click", () => {
  resetCurrentMode("Reset");
});

skipBtn.addEventListener("click", () => {
  completeSession(true);
});

settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const nextSettings = {
    focusMinutes: clamp(toInt(focusInput.value), 1, 90),
    shortBreakMinutes: clamp(toInt(shortBreakInput.value), 1, 30),
    longBreakMinutes: clamp(toInt(longBreakInput.value), 1, 60),
    longBreakInterval: clamp(toInt(intervalInput.value), 2, 8),
  };

  settings = nextSettings;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));

  totalSeconds = getModeSeconds(mode);
  remainingSeconds = totalSeconds;
  pauseTimer("Settings saved");
  render();
});

function switchMode(targetMode) {
  if (!targetMode || !modeText[targetMode] || mode === targetMode) {
    return;
  }
  mode = targetMode;
  totalSeconds = getModeSeconds(mode);
  remainingSeconds = totalSeconds;
  pauseTimer("Ready to start");
  updateModeButtons();
  render();
}

function startTimer() {
  if (timerId || remainingSeconds <= 0) {
    return;
  }

  statusText.textContent = "In progress";
  startPauseBtn.textContent = "Pause";
  app.classList.add("is-running");
  endTimestamp = Date.now() + remainingSeconds * 1000;

  timerId = window.setInterval(() => {
    const secondsLeft = Math.max(0, Math.ceil((endTimestamp - Date.now()) / 1000));
    remainingSeconds = secondsLeft;
    render();

    if (remainingSeconds === 0) {
      completeSession(false);
    }
  }, 250);
}

function pauseTimer(message) {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
  endTimestamp = null;
  app.classList.remove("is-running");
  startPauseBtn.textContent = "Start";
  if (message) {
    statusText.textContent = message;
  }
}

function resetCurrentMode(message) {
  pauseTimer(message);
  totalSeconds = getModeSeconds(mode);
  remainingSeconds = totalSeconds;
  render();
}

function completeSession(skipped) {
  pauseTimer(skipped ? "Skipped" : "Time is up");
  if (!skipped) {
    playBeep();
  }

  if (!skipped && mode === "focus") {
    completedFocusSessions += 1;
    saveDailyStats(completedFocusSessions);
    updateCompletedCount();
  }

  mode = getNextMode();
  totalSeconds = getModeSeconds(mode);
  remainingSeconds = totalSeconds;
  updateModeButtons();
  render();
}

function getNextMode() {
  if (mode === "focus") {
    const shouldUseLongBreak = completedFocusSessions > 0 && completedFocusSessions % settings.longBreakInterval === 0;
    return shouldUseLongBreak ? "longBreak" : "shortBreak";
  }
  return "focus";
}

function getModeSeconds(targetMode) {
  if (targetMode === "shortBreak") {
    return settings.shortBreakMinutes * 60;
  }
  if (targetMode === "longBreak") {
    return settings.longBreakMinutes * 60;
  }
  return settings.focusMinutes * 60;
}

function updateModeButtons() {
  modeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === mode);
  });
}

function updateCompletedCount() {
  completedCount.textContent = String(completedFocusSessions);
}

function render() {
  modeLabel.textContent = modeText[mode];
  timeDisplay.textContent = formatTime(remainingSeconds);

  const progress = totalSeconds === 0 ? 0 : ((totalSeconds - remainingSeconds) / totalSeconds) * 100;
  ring.style.setProperty("--progress", progress.toFixed(2));

  const titleMode = mode === "focus" ? "Focus" : mode === "shortBreak" ? "Short Break" : "Long Break";
  document.title = `${formatTime(remainingSeconds)} - ${titleMode}`;
}

function formatTime(seconds) {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const rest = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toInt(value) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...defaultSettings };
    }
    const parsed = JSON.parse(raw);
    return {
      focusMinutes: clamp(toInt(parsed.focusMinutes), 1, 90),
      shortBreakMinutes: clamp(toInt(parsed.shortBreakMinutes), 1, 30),
      longBreakMinutes: clamp(toInt(parsed.longBreakMinutes), 1, 60),
      longBreakInterval: clamp(toInt(parsed.longBreakInterval), 2, 8),
    };
  } catch {
    return { ...defaultSettings };
  }
}

function syncSettingsForm() {
  focusInput.value = String(settings.focusMinutes);
  shortBreakInput.value = String(settings.shortBreakMinutes);
  longBreakInput.value = String(settings.longBreakMinutes);
  intervalInput.value = String(settings.longBreakInterval);
}

function currentDateStamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function loadDailyStats() {
  const today = currentDateStamp();
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) {
      return 0;
    }
    const parsed = JSON.parse(raw);
    if (parsed.date !== today) {
      localStorage.setItem(STATS_KEY, JSON.stringify({ date: today, count: 0 }));
      return 0;
    }
    return Math.max(0, toInt(parsed.count));
  } catch {
    return 0;
  }
}

function saveDailyStats(count) {
  localStorage.setItem(
    STATS_KEY,
    JSON.stringify({
      date: currentDateStamp(),
      count,
    })
  );
}

function playBeep() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) {
    return;
  }

  const context = new AudioCtx();
  const osc = context.createOscillator();
  const gain = context.createGain();

  osc.type = "sine";
  osc.frequency.value = 880;
  gain.gain.value = 0.0001;
  osc.connect(gain);
  gain.connect(context.destination);

  const now = context.currentTime;
  gain.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

  osc.start(now);
  osc.stop(now + 0.28);
}
