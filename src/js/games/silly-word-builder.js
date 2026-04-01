(function initializeSillyWordBuilder() {
  const data = window.sillyWordBuilderData;
  const storageKey = 'silly-word-builder-profile-v1';
  const starsElement = document.getElementById('word-stars');
  const streakElement = document.getElementById('word-streak');
  const bestStreakElement = document.getElementById('word-best-streak');
  const currentBandElement = document.getElementById('word-current-band');
  const bandTabsElement = document.getElementById('word-band-tabs');
  const modeTabsElement = document.getElementById('word-mode-tabs');
  const instructionElement = document.getElementById('word-instruction');
  const bandCopyElement = document.getElementById('word-band-copy');
  const puzzleElement = document.getElementById('word-puzzle');
  const completeElement = document.getElementById('word-complete');
  const answerGridElement = document.getElementById('word-answer-grid');
  const statusElement = document.getElementById('word-status');
  const soundToggleButton = document.getElementById('word-sound-toggle');
  const rewardFlashElement = document.getElementById('word-reward-flash');
  const unlockToastElement = document.getElementById('word-unlock-toast');
  const pictureCardElement = document.getElementById('word-picture-card');
  const pictureEmojiElement = document.getElementById('word-picture-emoji');
  const pictureLabelElement = document.getElementById('word-picture-label');
  const nextUnlockElement = document.getElementById('word-next-unlock');
  const badgesElement = document.getElementById('word-badges');
  const grownupNoteElement = document.getElementById('word-grownup-note');
  const heroCopyElement = document.getElementById('word-hero-copy');

  if (!data || !puzzleElement) {
    return;
  }

  const profile = loadProfile();
  let state = {
    stars: profile.stars,
    streak: 0,
    bestStreak: profile.bestStreak,
    unlockedBand: profile.unlockedBand,
    selectedBand: profile.selectedBand,
    selectedMode: profile.selectedMode,
    correctCount: profile.correctCount,
    unlockedBadges: profile.unlockedBadges.slice(),
    soundOn: profile.soundOn,
    currentRound: null,
    roundMistakes: 0
  };
  let audioContext = null;

  const modeDefinitions = [
    { id: 'mix', label: 'Mix' },
    { id: 'middle', label: 'Middle' },
    { id: 'first', label: 'First' },
    { id: 'last', label: 'Last' },
    { id: 'picture', label: 'Picture' }
  ];

  function loadProfile() {
    const fallback = {
      stars: 0,
      bestStreak: 0,
      unlockedBand: 1,
      selectedBand: 1,
      selectedMode: 'mix',
      correctCount: 0,
      unlockedBadges: [],
      soundOn: true
    };
    try {
      const stored = JSON.parse(window.localStorage.getItem(storageKey));
      return Object.assign({}, fallback, stored || {});
    } catch (error) {
      console.warn('silly-word-builder.js: could not parse stored profile', error);
      return fallback;
    }
  }

  function saveProfile() {
    window.localStorage.setItem(storageKey, JSON.stringify({
      stars: state.stars,
      bestStreak: state.bestStreak,
      unlockedBand: state.unlockedBand,
      selectedBand: state.selectedBand,
      selectedMode: state.selectedMode,
      correctCount: state.correctCount,
      unlockedBadges: state.unlockedBadges,
      soundOn: state.soundOn
    }));
  }

  function getBandById(bandId) {
    return data.skillBands.find(function matchBand(band) {
      return band.id === bandId;
    });
  }

  function getCurrentBand() {
    return getBandById(state.selectedBand);
  }

  function bandSupportsMode(band, modeId) {
    if (modeId === 'mix') {
      return true;
    }
    return band.entries.some(function entrySupportsMode(entry) {
      if (!entry.modes.includes(modeId)) {
        return false;
      }
      return modeId !== 'picture' || Boolean(entry.emoji);
    });
  }

  function randomItem(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function pause(ms) {
    return new Promise(function wait(resolve) {
      window.setTimeout(resolve, ms);
    });
  }

  function setStatus(message, tone) {
    statusElement.textContent = message;
    statusElement.classList.remove('right', 'wrong', 'special');
    if (tone) {
      statusElement.classList.add(tone);
    }
  }

  function showRewardFlash(message) {
    rewardFlashElement.textContent = message;
    rewardFlashElement.hidden = false;
    window.setTimeout(function hideFlash() {
      rewardFlashElement.hidden = true;
    }, 850);
  }

  function showUnlockToast(message) {
    unlockToastElement.textContent = message;
    unlockToastElement.hidden = false;
    window.setTimeout(function hideToast() {
      unlockToastElement.hidden = true;
    }, 1600);
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

  function playSound(kind) {
    if (!state.soundOn) {
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
      correct: [{ frequency: 540, duration: 0.08 }, { frequency: 760, duration: 0.14 }],
      wrong: [{ frequency: 260, duration: 0.14 }],
      streak: [{ frequency: 480, duration: 0.08 }, { frequency: 640, duration: 0.08 }, { frequency: 820, duration: 0.18 }],
      unlock: [{ frequency: 700, duration: 0.08 }, { frequency: 900, duration: 0.08 }, { frequency: 1080, duration: 0.18 }]
    };
    const sequence = sequences[kind];
    if (!sequence) {
      return;
    }

    const now = context.currentTime;
    sequence.forEach(function playStep(step, index) {
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      const startTime = now + index * 0.08;
      const stopTime = startTime + step.duration;
      oscillator.type = kind === 'wrong' ? 'sawtooth' : 'triangle';
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

  function createRound(entry, modeId) {
    const mode = modeId === 'mix' ? pickMode(entry) : modeId;
    const missingIndex = getMissingIndex(entry, mode);
    const choices = buildChoices(entry, missingIndex);
    return {
      entry: entry,
      mode: mode,
      missingIndex: missingIndex,
      choices: shuffle(choices),
      correctChoice: entry.segments[missingIndex]
    };
  }

  function shuffle(items) {
    const clone = items.slice();
    for (let index = clone.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [clone[index], clone[swapIndex]] = [clone[swapIndex], clone[index]];
    }
    return clone;
  }

  function pickMode(entry) {
    const preferredModes = ['middle', 'first', 'last', 'picture'];
    const available = preferredModes.filter(function filterMode(mode) {
      return entry.modes.includes(mode) && (mode !== 'picture' || entry.emoji);
    });
    return randomItem(available);
  }

  function getMissingIndex(entry, mode) {
    if (mode === 'first') {
      return 0;
    }
    if (mode === 'middle') {
      return Math.floor(entry.segments.length / 2);
    }
    return entry.segments.length - 1;
  }

  function buildChoices(entry, missingIndex) {
    const band = getCurrentBand();
    const correctChoice = entry.segments[missingIndex];
    const pools = band.graphemes;
    const poolKey = missingIndex === 0 ? 'first' : missingIndex === entry.segments.length - 1 ? 'last' : 'middle';
    const choices = new Set([correctChoice]);

    while (choices.size < 3) {
      choices.add(randomItem(pools[poolKey]));
    }

    return Array.from(choices);
  }

  function getModeInstruction(mode) {
    if (mode === 'middle') {
      return 'Pick the middle sound.';
    }
    if (mode === 'first') {
      return 'Pick the first sound.';
    }
    if (mode === 'last') {
      return 'Pick the last sound.';
    }
    return 'Look at the picture and finish the word.';
  }

  function renderPuzzle() {
    const round = state.currentRound;
    const entry = round.entry;
    const showPicture = round.mode === 'picture' && entry.emoji;

    instructionElement.textContent = getModeInstruction(round.mode);
    bandCopyElement.textContent = getCurrentBand().description;
    heroCopyElement.textContent = round.mode === 'picture'
      ? 'Use the picture clue to finish the word.'
      : 'Pick the missing sound and finish the word.';

    puzzleElement.innerHTML = '';
    completeElement.hidden = true;
    completeElement.textContent = entry.word;

    entry.segments.forEach(function renderSlot(segment, index) {
      const slot = document.createElement('div');
      slot.className = 'word-slot';
      if (index === round.missingIndex) {
        slot.classList.add('is-missing');
        slot.textContent = '_';
      } else {
        slot.textContent = segment;
      }
      puzzleElement.appendChild(slot);
    });

    if (showPicture) {
      pictureCardElement.hidden = false;
      pictureEmojiElement.textContent = entry.emoji;
      pictureLabelElement.textContent = 'picture clue';
    } else {
      pictureCardElement.hidden = true;
      pictureEmojiElement.textContent = '';
      pictureLabelElement.textContent = '';
    }

    answerGridElement.innerHTML = '';
    round.choices.forEach(function renderChoice(choice) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'word-answer';
      button.textContent = choice;
      button.addEventListener('click', function handleChoice() {
        checkAnswer(button, choice);
      });
      answerGridElement.appendChild(button);
    });
  }

  function chooseEntry() {
    const band = getCurrentBand();
    const requestedMode = state.selectedMode;
    const compatibleEntries = band.entries.filter(function filterEntry(entry) {
      if (requestedMode === 'mix') {
        return true;
      }
      if (requestedMode === 'picture') {
        return entry.modes.includes('picture') && entry.emoji;
      }
      return entry.modes.includes(requestedMode);
    });

    return randomItem(compatibleEntries.length ? compatibleEntries : band.entries);
  }

  function unlockProgressIfNeeded() {
    const nextBandId = state.unlockedBand + 1;
    const threshold = data.unlockThresholds[nextBandId];
    if (threshold && state.correctCount >= threshold) {
      state.unlockedBand = nextBandId;
      state.selectedBand = nextBandId;
      showUnlockToast(getBandById(nextBandId).label + ' is now available.');
      playSound('unlock');
    }

    data.badges.forEach(function checkBadge(badge) {
      if (state.streak >= badge.unlockStreak && !state.unlockedBadges.includes(badge.id)) {
        state.unlockedBadges.push(badge.id);
        showUnlockToast(badge.label + ' earned.');
        playSound('unlock');
      }
    });
  }

  function renderBadges() {
    badgesElement.innerHTML = '';
    data.badges.forEach(function renderBadge(badge) {
      const badgeElement = document.createElement('div');
      badgeElement.className = 'word-badge';
      if (state.unlockedBadges.includes(badge.id)) {
        badgeElement.classList.add('is-unlocked');
      }
      badgeElement.innerHTML = '<div class="word-badge-icon">' + badge.icon + '</div>'
        + '<div class="word-badge-copy"><strong>' + badge.label + '</strong><span>'
        + (state.unlockedBadges.includes(badge.id) ? 'Earned' : badge.description)
        + '</span></div>';
      badgesElement.appendChild(badgeElement);
    });
  }

  function renderBandTabs() {
    bandTabsElement.innerHTML = '';
    data.skillBands.forEach(function renderBand(band) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'word-chip-btn';
      button.textContent = band.label;
      button.disabled = band.id > state.unlockedBand;
      if (band.id === state.selectedBand) {
        button.classList.add('is-active');
      }
      button.addEventListener('click', function selectBand() {
        state.selectedBand = band.id;
        saveProfile();
        updateUi();
        startNextRound();
      });
      bandTabsElement.appendChild(button);
    });
  }

  function renderModeTabs() {
    modeTabsElement.innerHTML = '';
    const currentBand = getCurrentBand();
    modeDefinitions.forEach(function renderMode(mode) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'word-chip-btn';
      button.textContent = mode.label;
      button.disabled = !bandSupportsMode(currentBand, mode.id);
      if (mode.id === state.selectedMode) {
        button.classList.add('is-active');
      }
      button.addEventListener('click', function selectMode() {
        state.selectedMode = mode.id;
        saveProfile();
        updateUi();
        startNextRound();
      });
      modeTabsElement.appendChild(button);
    });
  }

  function updateUi() {
    const currentBand = getCurrentBand();
    const nextBandId = state.unlockedBand + 1;
    const nextThreshold = data.unlockThresholds[nextBandId];

    starsElement.textContent = String(state.stars);
    streakElement.textContent = String(state.streak);
    bestStreakElement.textContent = String(state.bestStreak);
    currentBandElement.textContent = currentBand.shortLabel;
    grownupNoteElement.textContent = currentBand.grownupNote;
    nextUnlockElement.textContent = nextThreshold
      ? getBandById(nextBandId).label + ' becomes available after ' + nextThreshold + ' correct words.'
      : 'All word sets are unlocked.';
    soundToggleButton.textContent = state.soundOn ? 'Sound On' : 'Sound Off';
    soundToggleButton.setAttribute('aria-pressed', state.soundOn ? 'true' : 'false');

    renderBandTabs();
    renderModeTabs();
    renderBadges();
  }

  async function showCompletedWord() {
    const slots = Array.from(puzzleElement.querySelectorAll('.word-slot'));
    const round = state.currentRound;
    slots[round.missingIndex].classList.remove('is-missing');
    slots[round.missingIndex].classList.add('is-complete');
    slots[round.missingIndex].textContent = round.correctChoice;
    completeElement.hidden = false;
    await pause(520);
  }

  async function checkAnswer(button, choice) {
    const round = state.currentRound;
    const buttons = Array.from(answerGridElement.querySelectorAll('.word-answer'));

    if (choice === round.correctChoice) {
      button.classList.add('is-correct');
      buttons.forEach(function disableButton(item) {
        item.disabled = true;
      });
      state.stars += 1;
      state.streak += 1;
      state.correctCount += 1;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
      setStatus(state.streak >= 5 ? 'Nice streak.' : 'That\u2019s it.', 'right');
      showRewardFlash('+1 Star');
      playSound(state.streak >= 3 ? 'streak' : 'correct');
      unlockProgressIfNeeded();
      updateUi();
      saveProfile();
      await showCompletedWord();
      startNextRound();
      return;
    }

    button.classList.add('is-wrong');
    button.disabled = true;
    state.roundMistakes += 1;

    if (state.roundMistakes === 1) {
      setStatus('Not quite. Try another sound.', 'wrong');
      playSound('wrong');
      return;
    }

    buttons.forEach(function disableButton(item) {
      item.disabled = true;
    });
    state.streak = 0;
    setStatus('Here is the word.', 'special');
    playSound('wrong');
    await showCompletedWord();
    updateUi();
    saveProfile();
    startNextRound();
  }

  function startNextRound() {
    if (!bandSupportsMode(getCurrentBand(), state.selectedMode)) {
      state.selectedMode = 'mix';
    }
    state.roundMistakes = 0;
    state.currentRound = createRound(chooseEntry(), state.selectedMode);
    renderPuzzle();
    setStatus('Tap the sound that finishes the word.', 'special');
  }

  soundToggleButton.addEventListener('click', function toggleSound() {
    state.soundOn = !state.soundOn;
    saveProfile();
    updateUi();
  });

  updateUi();
  startNextRound();
})();
