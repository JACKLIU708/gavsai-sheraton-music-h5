const TEN_MINUTES_MS = 10 * 60 * 1000;

const audioConfig = {
  whiteNoise: {
    src: "./assets/audio/white-noise.mp3",
    loop: true,
    label: "白噪音",
    sessionLimitMs: TEN_MINUTES_MS,
  },
  lightMusic: {
    src: "./assets/audio/light-music.mp3",
    loop: true,
    label: "轻音乐",
    sessionLimitMs: TEN_MINUTES_MS,
  },
  sleep10Min: {
    src: "./assets/audio/sleep-10min.mp3",
    loop: true,
    label: "10分钟助眠",
    sessionLimitMs: TEN_MINUTES_MS,
  },
};

const audioMap = {};
const sessionMap = {};
let currentId = null;

function getCard(id) {
  return document.querySelector(`.audio-card[data-id="${id}"]`);
}

function getStatus(id) {
  return document.getElementById(`status-${id}`);
}

function getProgress(id) {
  return document.getElementById(`progress-${id}`);
}

function setStatus(id, text) {
  const el = getStatus(id);
  if (el) el.textContent = text;
}

function setProgress(id, value) {
  const el = getProgress(id);
  const percent = Math.max(0, Math.min(100, value));
  if (el) el.style.width = `${percent}%`;

  const container = el?.parentElement;
  if (container) {
    container.setAttribute("aria-valuenow", String(Math.round(percent)));
  }
}

function clearCardState(id) {
  const card = getCard(id);
  if (!card) return;
  card.classList.remove("active", "is-playing");
}

function setCardPlaying(id, isPlaying) {
  const card = getCard(id);
  if (!card) return;

  card.classList.add("active");
  if (isPlaying) {
    card.classList.add("is-playing");
  } else {
    card.classList.remove("is-playing");
  }
}

function getSession(id) {
  return sessionMap[id];
}

function clearSessionTimer(id) {
  const session = getSession(id);
  if (!session) return;

  if (session.timerId) {
    clearTimeout(session.timerId);
    session.timerId = null;
  }
}

function resetSession(id) {
  const session = getSession(id);
  const config = audioConfig[id];
  if (!session || !config) return;

  clearSessionTimer(id);
  session.remainingMs = config.sessionLimitMs ?? null;
  session.lastStartedAt = null;
}

function pauseSessionCountdown(id) {
  const session = getSession(id);
  if (!session) return;

  clearSessionTimer(id);

  if (session.lastStartedAt && typeof session.remainingMs === "number") {
    const elapsed = Date.now() - session.lastStartedAt;
    session.remainingMs = Math.max(0, session.remainingMs - elapsed);
  }

  session.lastStartedAt = null;
}

function finishSessionByLimit(id) {
  const audio = audioMap[id];
  if (!audio) return;

  audio.pause();
  audio.currentTime = 0;
  setProgress(id, 0);
  setStatus(id, "10分钟已结束");
  clearCardState(id);

  if (currentId === id) {
    currentId = null;
  }

  resetSession(id);
}

function startSessionCountdown(id) {
  const session = getSession(id);
  const config = audioConfig[id];

  if (!session || !config || typeof config.sessionLimitMs !== "number") {
    return;
  }

  if (typeof session.remainingMs !== "number" || session.remainingMs <= 0) {
    session.remainingMs = config.sessionLimitMs;
  }

  clearSessionTimer(id);

  session.lastStartedAt = Date.now();
  session.timerId = setTimeout(() => {
    finishSessionByLimit(id);
  }, session.remainingMs);
}

function stopAudio(id, resetProgress = false) {
  const audio = audioMap[id];
  if (!audio) return;

  audio.pause();
  pauseSessionCountdown(id);

  if (resetProgress) {
    audio.currentTime = 0;
    setProgress(id, 0);
    setStatus(id, "未播放");
    clearCardState(id);
    resetSession(id);
  } else {
    setStatus(id, "已暂停");
    const card = getCard(id);
    if (card) {
      card.classList.add("active");
      card.classList.remove("is-playing");
    }
  }

  if (currentId === id && resetProgress) {
    currentId = null;
  }
}

function stopAll(resetProgress = true) {
  Object.keys(audioMap).forEach((id) => {
    stopAudio(id, resetProgress);
  });

  if (resetProgress) {
    currentId = null;
  }
}

async function playAudio(id) {
  const audio = audioMap[id];
  const config = audioConfig[id];
  const session = getSession(id);

  if (!audio || !config || !session) return;

  if (currentId && currentId !== id) {
    stopAudio(currentId, true);
  }

  currentId = id;

  if (audio.currentTime === 0 && audio.paused && session.remainingMs === config.sessionLimitMs) {
    resetSession(id);
  }

  setCardPlaying(id, false);
  setStatus(id, "加载中");

  try {
    await audio.play();
    startSessionCountdown(id);
    setCardPlaying(id, true);
    setStatus(id, "播放中");
  } catch (error) {
    clearCardState(id);
    setStatus(id, "播放失败");
    currentId = null;
    console.error(`播放失败: ${id}`, error);
  }
}

function toggleAudio(id) {
  const audio = audioMap[id];
  if (!audio) return;

  if (currentId === id) {
    if (audio.paused) {
      playAudio(id);
    } else {
      stopAudio(id, false);
    }
    return;
  }

  playAudio(id);
}

function bindAudioEvents(id, audio) {
  audio.addEventListener("timeupdate", () => {
    const session = getSession(id);
    const config = audioConfig[id];

    if (!session || !config || typeof config.sessionLimitMs !== "number") return;

    const playedMs = config.sessionLimitMs - session.remainingMs;
    const currentLoopDurationMs = audio.duration && !Number.isNaN(audio.duration)
      ? audio.currentTime * 1000
      : 0;

    let totalPlayedMs = playedMs;
    if (session.lastStartedAt) {
      totalPlayedMs += Date.now() - session.lastStartedAt;
    } else {
      totalPlayedMs += currentLoopDurationMs;
    }

    const percent = (totalPlayedMs / config.sessionLimitMs) * 100;
    setProgress(id, percent);
  });

  audio.addEventListener("loadedmetadata", () => {
    setProgress(id, 0);
  });

  audio.addEventListener("ended", () => {
    if (audio.loop) return;

    setProgress(id, 0);
    setStatus(id, "播放完成");
    clearCardState(id);

    if (currentId === id) {
      currentId = null;
    }

    resetSession(id);
  });

  audio.addEventListener("waiting", () => {
    if (currentId === id) {
      setStatus(id, "加载中");
    }
  });

  audio.addEventListener("playing", () => {
    if (currentId === id) {
      setStatus(id, "播放中");
      setCardPlaying(id, true);
    }
  });

  audio.addEventListener("pause", () => {
    if (audio.currentTime > 0 && currentId === id) {
      setStatus(id, "已暂停");
      const card = getCard(id);
      if (card) {
        card.classList.add("active");
        card.classList.remove("is-playing");
      }
    }
  });

  audio.addEventListener("error", () => {
    setStatus(id, "音频异常");
    clearCardState(id);
    setProgress(id, 0);
    resetSession(id);

    if (currentId === id) {
      currentId = null;
    }
  });
}

function initAudios() {
  Object.entries(audioConfig).forEach(([id, config]) => {
    const audio = new Audio(config.src);
    audio.preload = "auto";
    audio.loop = config.loop;
    audioMap[id] = audio;

    sessionMap[id] = {
      remainingMs: config.sessionLimitMs ?? null,
      lastStartedAt: null,
      timerId: null,
    };

    setStatus(id, "未播放");
    setProgress(id, 0);

    bindAudioEvents(id, audio);
  });
}

function bindUIEvents() {
  const toggleButtons = document.querySelectorAll('[data-action="toggle"]');
  toggleButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.id;
      if (!id) return;
      toggleAudio(id);
    });
  });

  const stopAllBtn = document.getElementById("stopAllBtn");
  if (stopAllBtn) {
    stopAllBtn.addEventListener("click", () => {
      stopAll(true);
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initAudios();
  bindUIEvents();
});