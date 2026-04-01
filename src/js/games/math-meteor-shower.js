(function initializeMathMeteorShower() {
  const storageKey = 'math-meteor-shower-profile-v1';
  const scoreElement = document.getElementById('meteor-score');
  const streakElement = document.getElementById('meteor-streak');
  const bestStreakElement = document.getElementById('meteor-best-streak');
  const waveElement = document.getElementById('meteor-wave');
  const shieldElement = document.getElementById('meteor-shields');
  const waveCopyElement = document.getElementById('meteor-wave-copy');
  const questionElement = document.getElementById('meteor-question');
  const statusElement = document.getElementById('meteor-status');
  const statusOverlayElement = document.getElementById('meteor-status-overlay');
  const stageElement = document.getElementById('meteor-stage');
  const fieldElement = document.getElementById('meteor-field');
  const effectsElement = document.getElementById('meteor-effects');
  const startButton = document.getElementById('meteor-start');
  const replayButton = document.getElementById('meteor-replay');
  const muteButton = document.getElementById('meteor-mute');
  const easyModeInput = document.getElementById('meteor-easy-mode');
  const slowmoButton = document.getElementById('meteor-slowmo');
  const slowmoCountElement = document.getElementById('meteor-slowmo-count');
  const bossBadgeElement = document.getElementById('meteor-boss-badge');
  const shieldPowerupButton = document.getElementById('meteor-shield-powerup');

  if (!scoreElement || !fieldElement) {
    return;
  }

  const profile = loadProfile();
  let state = createInitialState();
  let animationFrameId = null;
  let lastFrameAt = 0;
  let audioContext = null;

  function createInitialState() {
    return {
      running: false,
      wave: 1,
      score: 0,
      streak: 0,
      bestStreak: profile.bestStreak || 0,
      bestScore: profile.bestScore || 0,
      bestWave: profile.bestWave || 1,
      shields: 0,
      slowmoCharges: 2,
      slowmoUntil: 0,
      muted: Boolean(profile.muted),
      easyMode: Boolean(profile.easyMode),
      activeQuestion: null,
      meteors: [],
      canAnswer: false,
      bossWave: false,
      pendingShield: false,
      ending: false
    };
  }

  function loadProfile() {
    try {
      return JSON.parse(window.localStorage.getItem(storageKey)) || {};
    } catch (error) {
      console.warn('math-meteor-shower.js: failed to parse stored profile', error);
      return {};
    }
  }

  function saveProfile() {
    profile.bestScore = state.bestScore;
    profile.bestStreak = state.bestStreak;
    profile.bestWave = state.bestWave;
    profile.muted = state.muted;
    profile.easyMode = state.easyMode;
    window.localStorage.setItem(storageKey, JSON.stringify({
      bestScore: state.bestScore,
      bestStreak: state.bestStreak,
      bestWave: state.bestWave,
      muted: state.muted,
      easyMode: state.easyMode
    }));
  }

  function setStatus(message, tone) {
    statusElement.textContent = message;
    statusElement.classList.remove('right', 'wrong', 'special');
    if (tone) {
      statusElement.classList.add(tone);
    }
  }

  function setOverlay(message) {
    statusOverlayElement.textContent = message;
  }

  function randomNumber(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function pause(ms) {
    return new Promise(function wait(resolve) {
      window.setTimeout(resolve, ms);
    });
  }

  function getAudioContext() {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) {
      return null;
    }
    if (!audioContext) {
      audioContext = new AudioContextConstructor();
    }
    return audioContext;
  }

  function playSound(type) {
    if (state.muted) {
      return;
    }

    const context = getAudioContext();
    if (!context) {
      return;
    }

    if (context.state === 'suspended') {
      context.resume().catch(function ignoreResumeFailure() {});
    }

    const sequences = {
      start: [{ frequency: 480, duration: 0.08 }, { frequency: 640, duration: 0.12 }],
      move: [{ frequency: 260, duration: 0.05 }],
      correct: [{ frequency: 540, duration: 0.08 }, { frequency: 760, duration: 0.14 }],
      wrong: [{ frequency: 220, duration: 0.14 }],
      reveal: [{ frequency: 350, duration: 0.08 }, { frequency: 520, duration: 0.12 }],
      shield: [{ frequency: 420, duration: 0.08 }, { frequency: 620, duration: 0.12 }, { frequency: 820, duration: 0.16 }]
    };
    const sequence = sequences[type];

    if (!sequence) {
      return;
    }

    const now = context.currentTime;
    sequence.forEach(function playStep(step, index) {
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      const startTime = now + index * 0.08;
      const stopTime = startTime + step.duration;
      oscillator.type = type === 'wrong' ? 'sawtooth' : 'triangle';
      oscillator.frequency.setValueAtTime(step.frequency, startTime);
      gainNode.gain.setValueAtTime(0.0001, startTime);
      gainNode.gain.linearRampToValueAtTime(0.055, startTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, stopTime);
      oscillator.connect(gainNode);
      gainNode.connect(context.destination);
      oscillator.start(startTime);
      oscillator.stop(stopTime);
    });
  }

  function getWaveConfig(wave, easyMode) {
    const base = easyMode
      ? [
          { choices: 3, speed: 62, spawnSpread: 0.92 },
          { choices: 3, speed: 70, spawnSpread: 0.9 },
          { choices: 3, speed: 78, spawnSpread: 0.88 },
          { choices: 4, speed: 86, spawnSpread: 0.86 },
          { choices: 4, speed: 94, spawnSpread: 0.84 }
        ]
      : [
          { choices: 3, speed: 78, spawnSpread: 0.92 },
          { choices: 4, speed: 90, spawnSpread: 0.88 },
          { choices: 4, speed: 102, spawnSpread: 0.86 },
          { choices: 5, speed: 112, spawnSpread: 0.84 },
          { choices: 5, speed: 126, spawnSpread: 0.8 }
        ];
    return base[Math.min(base.length - 1, wave - 1)];
  }

  function buildPrompt(bossWave) {
    const maxValue = state.easyMode ? 10 + state.wave * 2 : 12 + state.wave * 3;
    const useSubtraction = state.wave > 2 && Math.random() > (state.easyMode ? 0.78 : 0.64);
    const left = randomNumber(2, maxValue);
    const right = randomNumber(1, useSubtraction ? left - 1 : maxValue);
    const answer = useSubtraction ? left - right : left + right;
    const prompt = left + (useSubtraction ? ' - ' : ' + ') + right + ' = ?';
    const choiceCount = bossWave ? 3 : getWaveConfig(state.wave, state.easyMode).choices;
    const choices = new Set([answer]);

    while (choices.size < choiceCount) {
      const offset = bossWave ? randomNumber(-4, 6) : randomNumber(-3, 5);
      const candidate = Math.max(0, answer + offset);
      choices.add(candidate);
    }

    return {
      prompt: prompt,
      answer: answer,
      choices: Array.from(choices).sort(function shuffleChoices() {
        return Math.random() - 0.5;
      })
    };
  }

  function clearField() {
    fieldElement.innerHTML = '';
    effectsElement.innerHTML = '';
    state.meteors = [];
  }

  function createMeteor(choice, isCorrect, index, bossWave) {
    const meteorElement = document.createElement('button');
    meteorElement.type = 'button';
    meteorElement.className = 'meteor-item';
    if (bossWave && isCorrect) {
      meteorElement.classList.add('is-boss');
    }
    if (state.easyMode && isCorrect && index < 2) {
      meteorElement.classList.add('is-correct-hint');
    }
    meteorElement.innerHTML = '<span class="meteor-trail"></span><span class="meteor-label">' + choice + '</span>';
    meteorElement.addEventListener('click', function handleMeteorClick() {
      onMeteorTap(meteor);
    });

    fieldElement.appendChild(meteorElement);

    const stageWidth = stageElement.clientWidth;
    const spacing = stageWidth / (state.activeQuestion.choices.length + 1);
    const meteor = {
      value: choice,
      isCorrect: isCorrect,
      x: spacing * (index + 1) - (bossWave && isCorrect ? 74 : 55),
      y: -randomNumber(50, 160),
      speed: getWaveConfig(state.wave, state.easyMode).speed + randomNumber(-8, 10),
      size: bossWave && isCorrect ? 148 : 110,
      hp: bossWave && isCorrect ? 2 : 1,
      element: meteorElement,
      destroyed: false
    };

    if (bossWave && isCorrect) {
      meteor.speed -= 12;
    }

    positionMeteor(meteor);
    return meteor;
  }

  function positionMeteor(meteor) {
    meteor.element.style.transform = 'translate(' + meteor.x + 'px,' + meteor.y + 'px)';
  }

  async function startWave() {
    state.bossWave = state.wave > 0 && state.wave % 5 === 0;
    state.pendingShield = state.wave > 1 && state.wave % 3 === 0;
    state.activeQuestion = buildPrompt(state.bossWave);
    state.canAnswer = false;
    state.ending = false;
    questionElement.textContent = state.activeQuestion.prompt;
    bossBadgeElement.hidden = !state.bossWave;
    waveCopyElement.textContent = state.bossWave
      ? 'Boss wave. The answer meteor takes two hits.'
      : 'Wave ' + state.wave + (state.easyMode ? ' stays slower in Easy Mode.' : ' picks up the pace.');
    setOverlay(state.bossWave ? 'Big wave incoming.' : 'Next wave incoming.');
    clearField();
    maybeShowShieldPowerup();
    updateHud();
    await pause(420);
    setOverlay('3');
    await pause(240);
    setOverlay('2');
    await pause(240);
    setOverlay('1');
    await pause(240);
    setOverlay('Tap the right answer.');
    playSound('start');

    state.meteors = state.activeQuestion.choices.map(function createChoiceMeteor(choice, index) {
      return createMeteor(choice, choice === state.activeQuestion.answer, index, state.bossWave);
    });
    state.canAnswer = true;
    state.running = true;
    lastFrameAt = 0;

    if (!animationFrameId) {
      animationFrameId = window.requestAnimationFrame(tick);
    }
  }

  function maybeShowShieldPowerup() {
    if (!state.pendingShield || state.shields >= 2) {
      shieldPowerupButton.hidden = true;
      return;
    }
    shieldPowerupButton.hidden = false;
  }

  function spawnBurst(x, y, success) {
    const burst = document.createElement('span');
    burst.className = 'meteor-hit-burst';
    burst.style.left = x + 'px';
    burst.style.top = y + 'px';
    burst.style.background = success
      ? 'radial-gradient(circle, rgba(255,255,255,.95), rgba(74,222,128,.42), transparent 72%)'
      : 'radial-gradient(circle, rgba(255,255,255,.95), rgba(248,113,113,.42), transparent 72%)';
    effectsElement.appendChild(burst);
    window.setTimeout(function removeBurst() {
      burst.remove();
    }, 540);
  }

  async function onMeteorTap(meteor) {
    if (!state.canAnswer || state.ending || meteor.destroyed) {
      return;
    }

    meteor.element.classList.add('is-hit');
    spawnBurst(meteor.x + meteor.size / 2, meteor.y + meteor.size / 2, meteor.isCorrect);

    if (meteor.isCorrect) {
      meteor.hp -= 1;
      playSound(meteor.hp <= 0 ? 'correct' : 'move');

      if (meteor.hp > 0) {
        setStatus('Boss hit. One more tap!', 'special');
        setOverlay('One more hit!');
        return;
      }

      meteor.destroyed = true;
      meteor.element.classList.add('is-destroyed');
      state.canAnswer = false;
      state.streak += 1;
      state.score += state.bossWave ? 25 : 10;
      state.wave += 1;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
      state.bestScore = Math.max(state.bestScore, state.score);
      state.bestWave = Math.max(state.bestWave, state.wave);

      if (state.wave % 4 === 0) {
        state.slowmoCharges += 1;
      }

      setStatus(state.bossWave ? 'Big wave cleared.' : 'Correct.', 'right');
      setOverlay(state.streak >= 5 ? 'Hot streak.' : 'Wave cleared.');
      updateHud();
      saveProfile();
      await pause(420);
      clearField();
      startWave();
      return;
    }

    playSound('wrong');
    meteor.element.classList.add('is-destroyed');
    state.canAnswer = false;
    setStatus('Not quite. That was not the answer.', 'wrong');
    setOverlay('Wrong meteor');
    await resolveFailure();
  }

  async function resolveFailure() {
    state.ending = true;
    const correctMeteor = state.meteors.find(function findCorrectMeteor(item) {
      return item.isCorrect && !item.destroyed;
    });

    if (correctMeteor) {
      correctMeteor.element.classList.add('is-correct-hint');
      spawnBurst(correctMeteor.x + correctMeteor.size / 2, correctMeteor.y + correctMeteor.size / 2, true);
      playSound('reveal');
    }

    await pause(520);

    if (state.shields > 0) {
      state.shields -= 1;
      state.streak = 0;
      setStatus('Shield saved your ship. Next wave!', 'special');
      setOverlay('Shield save');
      playSound('shield');
      updateHud();
      await pause(500);
      clearField();
      startWave();
      return;
    }

    endGame('The answer meteor got through. Try again.');
  }

  function tick(timestamp) {
    if (!state.running) {
      animationFrameId = null;
      return;
    }

    if (!lastFrameAt) {
      lastFrameAt = timestamp;
    }

    const delta = Math.min(32, timestamp - lastFrameAt) / 1000;
    lastFrameAt = timestamp;

    const slowFactor = state.slowmoUntil > timestamp ? 0.45 : 1;
    state.meteors.forEach(function animateMeteor(meteor) {
      if (meteor.destroyed) {
        return;
      }

      meteor.y += meteor.speed * slowFactor * delta;
      positionMeteor(meteor);

      if (meteor.isCorrect && meteor.y + meteor.size >= stageElement.clientHeight - 76 && state.canAnswer && !state.ending) {
        setStatus('The answer meteor slipped by.', 'wrong');
        resolveFailure();
      }
    });

    animationFrameId = window.requestAnimationFrame(tick);
  }

  function updateHud() {
    scoreElement.textContent = String(state.score);
    streakElement.textContent = String(state.streak);
    bestStreakElement.textContent = String(state.bestStreak);
    waveElement.textContent = String(state.wave);
    shieldElement.textContent = String(state.shields);
    slowmoCountElement.textContent = String(state.slowmoCharges);
    muteButton.textContent = state.muted ? 'Unmute' : 'Mute';
    muteButton.setAttribute('aria-pressed', state.muted ? 'true' : 'false');
    easyModeInput.checked = state.easyMode;
    slowmoButton.disabled = !state.running || state.slowmoCharges <= 0;
  }

  function endGame(message) {
    state.running = false;
    state.canAnswer = false;
    state.ending = false;
    state.streak = 0;
    setStatus(message, 'wrong');
    setOverlay('Run over');
    replayButton.hidden = false;
    startButton.hidden = true;
    shieldPowerupButton.hidden = true;
    updateHud();
    saveProfile();
  }

  function resetGame() {
    if (animationFrameId) {
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    state = createInitialState();
    state.muted = Boolean(profile.muted);
    state.easyMode = Boolean(profile.easyMode);
    replayButton.hidden = true;
    startButton.hidden = false;
    shieldPowerupButton.hidden = true;
    clearField();
    questionElement.textContent = '8 + 3 = ?';
    setOverlay('Press start to begin.');
    setStatus('Press start, then tap the right meteor.');
    updateHud();
  }

  function startGame() {
    state = createInitialState();
    state.muted = Boolean(profile.muted);
    state.easyMode = easyModeInput.checked;
    state.shields = state.easyMode ? 1 : 0;
    replayButton.hidden = true;
    startButton.hidden = true;
    saveProfile();
    updateHud();
    setStatus('Next wave incoming.', 'special');
    startWave();
  }

  function handleShieldCollect() {
    if (shieldPowerupButton.hidden) {
      return;
    }
    state.shields = Math.min(2, state.shields + 1);
    state.pendingShield = false;
    shieldPowerupButton.hidden = true;
    setStatus('Shield ready!', 'special');
    playSound('shield');
    updateHud();
    saveProfile();
  }

  function activateSlowmo() {
    if (!state.running || state.slowmoCharges <= 0) {
      return;
    }
    state.slowmoCharges -= 1;
    state.slowmoUntil = performance.now() + 3000;
    setStatus('Slow motion!', 'special');
    setOverlay('Time slowed');
    updateHud();
    playSound('move');
  }

  startButton.addEventListener('click', startGame);
  replayButton.addEventListener('click', startGame);
  muteButton.addEventListener('click', function toggleMute() {
    state.muted = !state.muted;
    profile.muted = state.muted;
    updateHud();
    saveProfile();
  });
  easyModeInput.addEventListener('change', function toggleEasyMode() {
    state.easyMode = easyModeInput.checked;
    profile.easyMode = state.easyMode;
    saveProfile();
    updateHud();
  });
  slowmoButton.addEventListener('click', activateSlowmo);
  shieldPowerupButton.addEventListener('click', handleShieldCollect);

  resetGame();
})();
