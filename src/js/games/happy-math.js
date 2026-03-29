(function initializeMathGame() {
  const storageKeys = {
    bestScore: 'happy-math-best-score',
    bestLevel: 'happy-math-best-level',
    profile: 'happy-math-profile-v2'
  };
  const starJarSize = 5;
  const bossQuestionCadence = 8;
  const challengeQuestionCount = 10;
  const celebrationDurationMs = 980;
  const scoreCountElement = document.getElementById('score-count');
  const starCountElement = document.getElementById('star-count');
  const bestCountElement = document.getElementById('best-count');
  const levelCountElement = document.getElementById('level-count');
  const streakCountElement = document.getElementById('streak-count');
  const levelDescriptionElement = document.getElementById('journey-current-label');
  const levelGoalElement = document.getElementById('level-goal');
  const levelProgressFillElement = document.getElementById('level-progress-fill');
  const levelProgressTextElement = document.getElementById('level-progress-text');
  const levelBadgeElement = document.getElementById('level-badge');
  const equationElement = document.getElementById('game-equation');
  const statusElement = document.getElementById('game-status');
  const answerGrid = document.getElementById('answer-grid');
  const nextProblemButton = document.getElementById('next-problem');
  const modeDescriptionElement = document.getElementById('mode-description');
  const modeButtons = Array.from(document.querySelectorAll('.game-mode'));
  const gradeBandButtons = Array.from(document.querySelectorAll('.game-grade-tab'));
  const gradeBandDescriptionElement = document.getElementById('grade-band-description');
  const gradeBandPointsElement = document.getElementById('grade-band-points');
  const starJar = Array.from(document.querySelectorAll('.game-star'));
  const fireworksElement = document.getElementById('game-fireworks');
  const confettiElement = document.getElementById('game-confetti');
  const celebrationBadgeElement = document.getElementById('game-celebration-badge');
  const celebrationAvatarElement = document.getElementById('game-celebration-avatar');
  const celebrationTextElement = document.getElementById('game-celebration-text');
  const avatarDisplayElement = document.getElementById('game-avatar-display');
  const heroCopyElement = document.getElementById('game-hero-copy');
  const avatarHelperCopyElement = document.getElementById('avatar-helper-copy');
  const avatarPickerElement = document.getElementById('avatar-picker');
  const rewardFlashElement = document.getElementById('game-reward-flash');
  const unlockToastElement = document.getElementById('game-unlock-toast');
  const rewardsPanelElement = document.getElementById('game-rewards-panel');
  const toggleRewardsButton = document.getElementById('toggle-rewards');
  const unlockSummaryElement = document.getElementById('unlock-summary');
  const unlockGridElement = document.getElementById('unlock-grid');
  const gameShellElement = document.getElementById('game-shell');
  const journeyRocketElement = document.getElementById('journey-rocket');
  const journeyStops = Array.from(document.querySelectorAll('.game-journey-stop'));
  const specialBannerElement = document.getElementById('game-special-banner');
  const specialCopyElement = document.getElementById('game-special-copy');
  const challengeBannerElement = document.getElementById('challenge-banner');
  const challengeStatusElement = document.getElementById('challenge-status');
  const challengeProgressElement = document.getElementById('challenge-progress');
  const challengeTimerElement = document.getElementById('challenge-timer');
  const startChallengeButton = document.getElementById('start-challenge');
  const startChallengeSideButton = document.getElementById('start-challenge-side');
  const challengeBestScoreElement = document.getElementById('challenge-best-score');
  const challengeBestTimeElement = document.getElementById('challenge-best-time');
  const parentPanelElement = document.getElementById('parent-panel');
  const toggleParentButton = document.getElementById('toggle-parent');
  const gamePanelElement = document.getElementById('game-panel');
  const parentAccuracyElement = document.getElementById('parent-accuracy');
  const parentSpeedElement = document.getElementById('parent-speed');
  const parentBestStreakElement = document.getElementById('parent-best-streak');
  const parentGradeElement = document.getElementById('parent-grade');
  const parentOperationStatsElement = document.getElementById('parent-operation-stats');
  const starJarCopyElement = document.getElementById('star-jar-copy');
  const nextUnlockCopyElement = document.getElementById('next-unlock-copy');

  if (!scoreCountElement || !answerGrid) {
    return;
  }

  const avatars = {
    dino: {
      id: 'dino',
      name: 'Dino',
      emoji: '🦖',
      unlockStars: 0,
      heroCopy: 'Dino loves stompy math wins.',
      praise: [
        'Dino stomped the right answer!',
        'Dino found a bright star!',
        'Dino made that one look easy!'
      ]
    },
    unicorn: {
      id: 'unicorn',
      name: 'Unicorn',
      emoji: '🦄',
      unlockStars: 5,
      heroCopy: 'Unicorn sprinkles stars on every win.',
      praise: [
        'Unicorn found a star!',
        'Unicorn made the answer sparkle!',
        'Unicorn galloped to the right answer!'
      ]
    },
    cat: {
      id: 'cat',
      name: 'Cat',
      emoji: '🐱',
      unlockStars: 10,
      heroCopy: 'Cat pounces on sneaky number puzzles.',
      praise: [
        'Cat pounced on the right answer!',
        'Cat collected a shiny star!',
        'Cat was quick and clever!'
      ]
    },
    rocket: {
      id: 'rocket',
      name: 'Rocket',
      emoji: '🚀',
      unlockStars: 16,
      heroCopy: 'Rocket zooms through big math missions.',
      praise: [
        'Rocket zoomed ahead!',
        'Rocket blasted to the right answer!',
        'Rocket scooped up another star!'
      ]
    }
  };
  const themeCatalog = {
    aurora: {
      id: 'aurora',
      label: 'Aurora Glow',
      unlockStars: 0,
      preview: 'Green glow'
    },
    sunrise: {
      id: 'sunrise',
      label: 'Sunrise Sky',
      unlockStars: 8,
      preview: 'Peach sky'
    },
    candy: {
      id: 'candy',
      label: 'Candy Comet',
      unlockStars: 14,
      preview: 'Pink sparkle'
    }
  };
  const fireworkCatalog = {
    classic: {
      id: 'classic',
      label: 'Classic Sparks',
      unlockStars: 0,
      colors: ['#fde68a', '#f59e0b', '#fb7185', '#60a5fa', '#6ee7b7']
    },
    rainbow: {
      id: 'rainbow',
      label: 'Rainbow Pop',
      unlockStars: 6,
      colors: ['#f472b6', '#facc15', '#4ade80', '#38bdf8', '#c084fc']
    },
    moon: {
      id: 'moon',
      label: 'Moon Dust',
      unlockStars: 12,
      colors: ['#f8fafc', '#cbd5f5', '#93c5fd', '#a7f3d0', '#f9a8d4']
    }
  };
  const journeyStages = [
    'Earth launch pad',
    'Cloud hopping',
    'Moon mission',
    'Planet hopping',
    'Star explorer'
  ];
  const modeDescriptions = {
    mixed: 'A playful mix of number questions.',
    addition: 'Add the numbers and grab the star.',
    subtraction: 'Take some away and find what is left.',
    multiplication: 'Make equal groups and zoom ahead.',
    division: 'Share numbers into equal groups.'
  };
  const levelBadges = [
    'Launch Pad',
    'Cloud Cruiser',
    'Moon Walker',
    'Planet Hopper',
    'Star Captain'
  ];
  const gradeBands = {
    single_digit: {
      label: 'Single Digit',
      description: 'Tiny sums and take-away questions that still feel speedy and fun.',
      points: 10
    },
    double_digit: {
      label: 'Double Digit',
      description: 'Bigger number adventures with two-digit adding and subtracting.',
      points: 20
    },
    fact_fluency: {
      label: 'Fact Fluency',
      description: 'Mix in multiplication and division for quick fact practice.',
      points: 30
    },
    multi_digit: {
      label: 'Multi-Digit',
      description: 'Stretch into larger numbers and tougher mixed practice.',
      points: 40
    }
  };
  const softFeedbackMessages = [
    'Nice try!',
    'Almost!',
    'Good try!',
    'Let’s try another one!'
  ];
  const warmPraiseMessages = [
    'Great job!',
    'You got it!',
    'Wow!',
    'Amazing math!',
    'Super solver!'
  ];

  let score = 0;
  let levelProgress = 0;
  let currentLevel = 1;
  let currentStreak = 0;
  let sessionStarJar = 0;
  let answeredThisSession = 0;
  let currentProblem = null;
  let answersLocked = false;
  let currentQuestionStartedAt = Date.now();
  let pendingBossQuestion = false;
  let celebrationTimer = null;
  let celebrationSceneTimer = null;
  let rewardFlashTimer = null;
  let unlockToastTimer = null;
  let confettiTimer = null;
  let challengeTicker = null;
  let bestScore = Number(window.localStorage.getItem(storageKeys.bestScore)) || 0;
  let bestLevel = Number(window.localStorage.getItem(storageKeys.bestLevel)) || 1;
  let profile = loadProfile();
  let currentMode = profile.lastMode;
  let currentBand = profile.lastBand;
  let challengeState = {
    active: false,
    answered: 0,
    correct: 0,
    startedAt: 0
  };

  function createDefaultProfile() {
    return {
      selectedAvatar: 'dino',
      unlockedAvatars: ['dino'],
      unlockedThemes: ['aurora'],
      unlockedFireworks: ['classic'],
      equippedTheme: 'aurora',
      equippedFirework: 'classic',
      totalStarsEarned: 0,
      lastMode: 'mixed',
      lastBand: 'single_digit',
      bestStreak: 0,
      bestChallenge: {
        score: 0,
        timeMs: null,
        accuracy: 0
      },
      stats: {
        answered: 0,
        correct: 0,
        totalResponseMs: 0,
        byMode: createEmptyOperationStats()
      }
    };
  }

  function createEmptyOperationStats() {
    return {
      addition: { answered: 0, correct: 0 },
      subtraction: { answered: 0, correct: 0 },
      multiplication: { answered: 0, correct: 0 },
      division: { answered: 0, correct: 0 }
    };
  }

  function loadProfile() {
    const fallbackProfile = createDefaultProfile();
    try {
      const storedProfile = window.localStorage.getItem(storageKeys.profile);
      if (!storedProfile) {
        return fallbackProfile;
      }

      const parsedProfile = JSON.parse(storedProfile);
      const mergedProfile = Object.assign({}, fallbackProfile, parsedProfile);
      mergedProfile.unlockedAvatars = normalizeUnlockedList(parsedProfile.unlockedAvatars, Object.keys(avatars), ['dino']);
      mergedProfile.unlockedThemes = normalizeUnlockedList(parsedProfile.unlockedThemes, Object.keys(themeCatalog), ['aurora']);
      mergedProfile.unlockedFireworks = normalizeUnlockedList(parsedProfile.unlockedFireworks, Object.keys(fireworkCatalog), ['classic']);
      mergedProfile.selectedAvatar = mergedProfile.unlockedAvatars.includes(mergedProfile.selectedAvatar)
        ? mergedProfile.selectedAvatar
        : 'dino';
      mergedProfile.equippedTheme = mergedProfile.unlockedThemes.includes(mergedProfile.equippedTheme)
        ? mergedProfile.equippedTheme
        : 'aurora';
      mergedProfile.equippedFirework = mergedProfile.unlockedFireworks.includes(mergedProfile.equippedFirework)
        ? mergedProfile.equippedFirework
        : 'classic';
      mergedProfile.lastMode = modeDescriptions[mergedProfile.lastMode] ? mergedProfile.lastMode : 'mixed';
      mergedProfile.lastBand = gradeBands[mergedProfile.lastBand] ? mergedProfile.lastBand : 'single_digit';
      mergedProfile.bestChallenge = Object.assign({}, fallbackProfile.bestChallenge, parsedProfile.bestChallenge);
      mergedProfile.stats = Object.assign({}, fallbackProfile.stats, parsedProfile.stats);
      mergedProfile.stats.byMode = Object.assign(createEmptyOperationStats(), parsedProfile.stats && parsedProfile.stats.byMode);
      return mergedProfile;
    } catch (error) {
      console.warn('happy-math.js: could not parse stored profile', error);
      return fallbackProfile;
    }
  }

  function normalizeUnlockedList(candidateList, validKeys, defaultKeys) {
    const rawList = Array.isArray(candidateList) ? candidateList : defaultKeys;
    const filteredList = rawList.filter(function keepValidKey(key) {
      return validKeys.includes(key);
    });
    return filteredList.length ? Array.from(new Set(filteredList.concat(defaultKeys))) : [...defaultKeys];
  }

  function saveProfile() {
    profile.lastMode = currentMode;
    profile.lastBand = currentBand;
    window.localStorage.setItem(storageKeys.profile, JSON.stringify(profile));
  }

  function getCurrentAvatar() {
    return avatars[profile.selectedAvatar] || avatars.dino;
  }

  function getCurrentFireworkColors() {
    const selectedFirework = fireworkCatalog[profile.equippedFirework] || fireworkCatalog.classic;
    return selectedFirework.colors;
  }

  function getLevelTarget(level) {
    return Math.min(50 + (level - 1) * 20, 180);
  }

  function getDisplayLevelIndex(level) {
    return Math.min(level, levelBadges.length) - 1;
  }

  function getAllowedModes() {
    if (currentBand === 'single_digit' || currentBand === 'double_digit') {
      return ['mixed', 'addition', 'subtraction'];
    }
    return ['mixed', 'addition', 'subtraction', 'multiplication', 'division'];
  }

  function randomNumber(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function randomItem(items) {
    return items[randomNumber(0, items.length - 1)];
  }

  function shuffle(items) {
    const clone = items.slice();
    for (let index = clone.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [clone[index], clone[swapIndex]] = [clone[swapIndex], clone[index]];
    }
    return clone;
  }

  function formatTime(milliseconds) {
    if (!milliseconds || !Number.isFinite(milliseconds)) {
      return '--';
    }
    return (milliseconds / 1000).toFixed(1) + 's';
  }

  function setStatus(message, tone) {
    statusElement.textContent = message;
    statusElement.classList.remove('right', 'wrong', 'soft', 'special');
    if (tone) {
      statusElement.classList.add(tone);
    }
  }

  function showRewardFlash(message) {
    rewardFlashElement.textContent = message;
    rewardFlashElement.hidden = false;
    rewardFlashElement.classList.remove('is-visible');
    void rewardFlashElement.offsetWidth;
    rewardFlashElement.classList.add('is-visible');

    if (rewardFlashTimer) {
      window.clearTimeout(rewardFlashTimer);
    }
    rewardFlashTimer = window.setTimeout(function hideRewardFlash() {
      rewardFlashElement.classList.remove('is-visible');
      rewardFlashElement.hidden = true;
    }, 900);
  }

  function showUnlockToast(message) {
    unlockToastElement.textContent = message;
    unlockToastElement.hidden = false;
    unlockToastElement.classList.add('is-visible');

    if (unlockToastTimer) {
      window.clearTimeout(unlockToastTimer);
    }
    unlockToastTimer = window.setTimeout(function hideUnlockToast() {
      unlockToastElement.classList.remove('is-visible');
      unlockToastElement.hidden = true;
    }, 1900);
  }

  function hideCelebrationBadge() {
    celebrationBadgeElement.classList.remove('is-visible');
  }

  function showCelebrationBadge(message) {
    const avatar = getCurrentAvatar();
    celebrationAvatarElement.textContent = avatar.emoji;
    celebrationTextElement.textContent = message;
    celebrationBadgeElement.classList.add('is-visible');

    if (celebrationTimer) {
      window.clearTimeout(celebrationTimer);
    }
    celebrationTimer = window.setTimeout(hideCelebrationBadge, celebrationDurationMs - 120);
  }

  function activateCelebrationScene(intensity) {
    if (!gamePanelElement) {
      return;
    }

    gamePanelElement.classList.remove('is-celebrating-small', 'is-celebrating-medium', 'is-celebrating-big');
    gamePanelElement.classList.add('is-celebrating-' + intensity);

    if (celebrationSceneTimer) {
      window.clearTimeout(celebrationSceneTimer);
    }

    celebrationSceneTimer = window.setTimeout(function clearCelebrationScene() {
      gamePanelElement.classList.remove('is-celebrating-small', 'is-celebrating-medium', 'is-celebrating-big');
    }, intensity === 'big' ? 1300 : 1050);
  }

  function launchFireworks(intensity) {
    const colors = getCurrentFireworkColors();
    const bursts = intensity === 'big' ? 40 : intensity === 'medium' ? 26 : 16;
    fireworksElement.innerHTML = '';
    activateCelebrationScene(intensity);

    for (let index = 0; index < bursts; index += 1) {
      const spark = document.createElement('span');
      const angle = (Math.PI * 2 * index) / bursts;
      const distance = intensity === 'big'
        ? randomNumber(130, 240)
        : intensity === 'medium'
          ? randomNumber(90, 180)
          : randomNumber(70, 130);
      spark.className = 'game-firework';
      if (index % 5 === 0) {
        spark.classList.add('game-firework-orbit');
      }
      spark.style.left = randomNumber(10, 90) + '%';
      spark.style.top = randomNumber(8, 62) + '%';
      spark.style.color = colors[index % colors.length];
      spark.style.setProperty('--dx', Math.cos(angle) * distance + 'px');
      spark.style.setProperty('--dy', Math.sin(angle) * distance + 'px');
      spark.style.setProperty('--spark-size', randomNumber(8, intensity === 'big' ? 18 : 14) + 'px');
      spark.style.animationDelay = (index % 8) * 22 + 'ms';
      fireworksElement.appendChild(spark);
    }

    window.setTimeout(function clearFireworks() {
      fireworksElement.innerHTML = '';
    }, 1100);
  }

  function launchConfetti(intensity) {
    const colors = getCurrentFireworkColors();
    const pieces = intensity === 'big' ? 72 : intensity === 'medium' ? 44 : 26;
    confettiElement.innerHTML = '';
    activateCelebrationScene(intensity);

    for (let index = 0; index < pieces; index += 1) {
      const piece = document.createElement('span');
      piece.className = 'game-confetti-piece';
      if (index % 6 === 0) {
        piece.classList.add('is-star');
      } else if (index % 2 === 0) {
        piece.classList.add('is-ribbon');
      }
      piece.style.left = randomNumber(2, 98) + '%';
      piece.style.background = colors[index % colors.length];
      piece.style.animationDelay = randomNumber(0, 260) + 'ms';
      piece.style.setProperty('--drift', randomNumber(-46, 46) + 'px');
      piece.style.setProperty('--spin', randomNumber(180, 520) + 'deg');
      piece.style.setProperty('--fall-distance', intensity === 'big' ? '340px' : '280px');
      confettiElement.appendChild(piece);
    }

    if (confettiTimer) {
      window.clearTimeout(confettiTimer);
    }
    confettiTimer = window.setTimeout(function clearConfetti() {
      confettiElement.innerHTML = '';
    }, 1500);
  }

  function getBandAdjustedRange(level) {
    if (currentBand === 'single_digit') {
      return { addSubMax: Math.min(10 + level * 2, 20), multiMaxFactor: 0, divisionMaxFactor: 0, largeNumberMax: 20 };
    }
    if (currentBand === 'double_digit') {
      return { addSubMax: Math.min(30 + level * 8, 100), multiMaxFactor: 6, divisionMaxFactor: 6, largeNumberMax: 100 };
    }
    if (currentBand === 'fact_fluency') {
      return {
        addSubMax: Math.min(120 + level * 35, 1000),
        multiMaxFactor: Math.min(5 + level, 10),
        divisionMaxFactor: Math.min(5 + level, 10),
        largeNumberMax: Math.min(220 + level * 60, 1000)
      };
    }
    return {
      addSubMax: Math.min(280 + level * 120, 10000),
      multiMaxFactor: Math.min(8 + level, 12),
      divisionMaxFactor: Math.min(8 + level, 12),
      largeNumberMax: Math.min(1200 + level * 250, 100000)
    };
  }

  function buildAdditionProblem(level, isBoss) {
    const range = getBandAdjustedRange(level);
    const firstNumber = randomNumber(0, range.addSubMax);
    const secondNumber = randomNumber(0, range.addSubMax);
    if (isBoss) {
      const total = firstNumber + secondNumber;
      return {
        answer: secondNumber,
        label: firstNumber + ' + ? = ' + total,
        explanation: firstNumber + ' and ' + secondNumber + ' make ' + total + '.',
        mode: 'addition'
      };
    }
    return {
      answer: firstNumber + secondNumber,
      label: firstNumber + ' + ' + secondNumber + ' = ?',
      explanation: firstNumber + ' and ' + secondNumber + ' make ' + (firstNumber + secondNumber) + '.',
      mode: 'addition'
    };
  }

  function buildSubtractionProblem(level, isBoss) {
    const range = getBandAdjustedRange(level);
    let firstNumber = randomNumber(0, range.largeNumberMax);
    let secondNumber = randomNumber(0, firstNumber);
    if (secondNumber > firstNumber) {
      [firstNumber, secondNumber] = [secondNumber, firstNumber];
    }
    const answer = firstNumber - secondNumber;
    if (isBoss) {
      return {
        answer: firstNumber,
        label: '? - ' + secondNumber + ' = ' + answer,
        explanation: answer + ' plus ' + secondNumber + ' makes ' + firstNumber + '.',
        mode: 'subtraction'
      };
    }
    return {
      answer: answer,
      label: firstNumber + ' - ' + secondNumber + ' = ?',
      explanation: firstNumber + ' take away ' + secondNumber + ' leaves ' + answer + '.',
      mode: 'subtraction'
    };
  }

  function buildMultiplicationProblem(level, isBoss) {
    const range = getBandAdjustedRange(level);
    const maxFactor = Math.max(2, range.multiMaxFactor);
    const firstNumber = randomNumber(0, maxFactor);
    const secondNumber = randomNumber(0, maxFactor);
    const answer = firstNumber * secondNumber;
    if (isBoss) {
      return {
        answer: secondNumber,
        label: firstNumber + ' x ? = ' + answer,
        explanation: firstNumber + ' groups of ' + secondNumber + ' make ' + answer + '.',
        mode: 'multiplication'
      };
    }
    return {
      answer: answer,
      label: firstNumber + ' x ' + secondNumber + ' = ?',
      explanation: firstNumber + ' groups of ' + secondNumber + ' make ' + answer + '.',
      mode: 'multiplication'
    };
  }

  function buildDivisionProblem(level, isBoss) {
    const range = getBandAdjustedRange(level);
    const maxFactor = Math.max(2, range.divisionMaxFactor);
    const answer = randomNumber(1, maxFactor);
    const secondNumber = randomNumber(1, maxFactor);
    const firstNumber = answer * secondNumber;
    if (isBoss) {
      return {
        answer: firstNumber,
        label: '? / ' + secondNumber + ' = ' + answer,
        explanation: answer + ' groups of ' + secondNumber + ' make ' + firstNumber + '.',
        mode: 'division'
      };
    }
    return {
      answer: answer,
      label: firstNumber + ' / ' + secondNumber + ' = ?',
      explanation: firstNumber + ' shared by ' + secondNumber + ' is ' + answer + '.',
      mode: 'division'
    };
  }

  function pickProblemMode() {
    const availableModes = getAllowedModes().filter(function onlyMathModes(mode) {
      return mode !== 'mixed';
    });
    return currentMode === 'mixed'
      ? availableModes[randomNumber(0, availableModes.length - 1)]
      : currentMode;
  }

  function buildChoices(answer, spread) {
    const choices = new Set([answer]);
    while (choices.size < 4) {
      const candidate = Math.max(0, answer + randomNumber(-spread, spread));
      choices.add(candidate);
    }
    return shuffle(Array.from(choices));
  }

  function buildProblem() {
    const selectedMode = pickProblemMode();
    const isBossQuestion = pendingBossQuestion;
    let problem;

    if (selectedMode === 'addition') {
      problem = buildAdditionProblem(currentLevel + (isBossQuestion ? 1 : 0), isBossQuestion);
    } else if (selectedMode === 'subtraction') {
      problem = buildSubtractionProblem(currentLevel + (isBossQuestion ? 1 : 0), isBossQuestion);
    } else if (selectedMode === 'multiplication') {
      problem = buildMultiplicationProblem(currentLevel + (isBossQuestion ? 1 : 0), isBossQuestion);
    } else {
      problem = buildDivisionProblem(currentLevel + (isBossQuestion ? 1 : 0), isBossQuestion);
    }

    const choiceSpread = isBossQuestion
      ? currentBand === 'single_digit'
        ? 4
        : currentBand === 'double_digit'
          ? 10
          : currentBand === 'fact_fluency'
            ? 14
            : 28
      : currentBand === 'single_digit'
        ? 3
        : currentBand === 'double_digit'
          ? 8
          : currentBand === 'fact_fluency'
            ? 12
            : 25;
    currentProblem = {
      answer: problem.answer,
      label: problem.label,
      explanation: problem.explanation,
      mode: problem.mode,
      isBoss: isBossQuestion,
      rewardStars: isBossQuestion ? 3 : 1,
      choices: buildChoices(problem.answer, choiceSpread)
    };
    pendingBossQuestion = false;
  }

  function renderProblem() {
    answersLocked = false;
    buildProblem();
    equationElement.textContent = currentProblem.label;
    currentQuestionStartedAt = Date.now();
    answerGrid.innerHTML = '';
    specialBannerElement.hidden = !currentProblem.isBoss;
    specialCopyElement.textContent = currentProblem.isBoss
      ? 'Bonus blast! This one is worth extra stars.'
      : '';

    currentProblem.choices.forEach(function renderChoice(choice) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'game-answer';
      button.textContent = String(choice);
      button.setAttribute('aria-label', 'Answer ' + choice);
      button.addEventListener('click', function handleAnswer() {
        checkAnswer(choice);
      });
      answerGrid.appendChild(button);
    });
  }

  function disableAnswerButtons() {
    Array.from(answerGrid.querySelectorAll('.game-answer')).forEach(function disableButton(button) {
      button.disabled = true;
    });
  }

  function saveBestProgress() {
    if (score > bestScore) {
      bestScore = score;
      window.localStorage.setItem(storageKeys.bestScore, String(bestScore));
    }
    if (currentLevel > bestLevel) {
      bestLevel = currentLevel;
      window.localStorage.setItem(storageKeys.bestLevel, String(bestLevel));
    }
    if (currentStreak > profile.bestStreak) {
      profile.bestStreak = currentStreak;
    }
    saveProfile();
  }

  function getCelebrationTier(isBossQuestion) {
    if (isBossQuestion || currentStreak >= 10) {
      return 'big';
    }
    if (currentStreak >= 5) {
      return 'medium';
    }
    if (currentStreak >= 3) {
      return 'small';
    }
    return 'small';
  }

  function getCorrectMessage(isBossQuestion, leveledUp, newlyUnlockedCount) {
    const avatar = getCurrentAvatar();
    const avatarLine = randomItem(avatar.praise);

    if (leveledUp) {
      return 'Blast off! ' + avatar.name + ' reached level ' + currentLevel + '.';
    }
    if (newlyUnlockedCount > 0) {
      return avatarLine + ' New reward unlocked!';
    }
    if (isBossQuestion) {
      return avatarLine + ' Bonus stars earned!';
    }
    if (currentStreak >= 10) {
      return 'Super solver! ' + currentStreak + ' in a row!';
    }
    if (currentStreak >= 5) {
      return 'Hot streak! ' + currentStreak + ' in a row!';
    }
    if (currentStreak >= 3) {
      return avatarLine + ' Hot streak!';
    }
    return randomItem(warmPraiseMessages) + ' ' + avatarLine;
  }

  function getSupportiveMissMessage() {
    return randomItem(softFeedbackMessages);
  }

  function tryLevelUp() {
    if (levelProgress < getLevelTarget(currentLevel)) {
      return false;
    }
    currentLevel += 1;
    levelProgress = 0;
    saveBestProgress();
    launchFireworks('big');
    launchConfetti('big');
    return true;
  }

  function getAvatarUnlockThresholds() {
    return Object.keys(avatars).map(function collectAvatarReward(id) {
      const avatar = avatars[id];
      return {
        id: avatar.id,
        label: avatar.name,
        unlockStars: avatar.unlockStars,
        type: 'avatar'
      };
    });
  }

  function getThemeUnlockThresholds() {
    return Object.keys(themeCatalog).map(function collectThemeReward(id) {
      const theme = themeCatalog[id];
      return {
        id: theme.id,
        label: theme.label,
        unlockStars: theme.unlockStars,
        type: 'theme'
      };
    });
  }

  function getFireworkUnlockThresholds() {
    return Object.keys(fireworkCatalog).map(function collectFireworkReward(id) {
      const firework = fireworkCatalog[id];
      return {
        id: firework.id,
        label: firework.label,
        unlockStars: firework.unlockStars,
        type: 'firework'
      };
    });
  }

  function collectNewUnlocks() {
    const newUnlockMessages = [];

    getAvatarUnlockThresholds().forEach(function checkAvatarUnlock(reward) {
      if (profile.totalStarsEarned >= reward.unlockStars && !profile.unlockedAvatars.includes(reward.id)) {
        profile.unlockedAvatars.push(reward.id);
        newUnlockMessages.push('New friend unlocked: ' + reward.label + '!');
      }
    });

    getThemeUnlockThresholds().forEach(function checkThemeUnlock(reward) {
      if (profile.totalStarsEarned >= reward.unlockStars && !profile.unlockedThemes.includes(reward.id)) {
        profile.unlockedThemes.push(reward.id);
        newUnlockMessages.push('New theme unlocked: ' + reward.label + '!');
      }
    });

    getFireworkUnlockThresholds().forEach(function checkFireworkUnlock(reward) {
      if (profile.totalStarsEarned >= reward.unlockStars && !profile.unlockedFireworks.includes(reward.id)) {
        profile.unlockedFireworks.push(reward.id);
        newUnlockMessages.push('New sparkle unlocked: ' + reward.label + '!');
      }
    });

    if (newUnlockMessages.length) {
      showUnlockToast(newUnlockMessages[0]);
    }

    return newUnlockMessages;
  }

  function updateParentStats(problemMode, wasCorrect, responseMs) {
    profile.stats.answered += 1;
    profile.stats.totalResponseMs += responseMs;
    if (wasCorrect) {
      profile.stats.correct += 1;
    }

    if (!profile.stats.byMode[problemMode]) {
      profile.stats.byMode[problemMode] = { answered: 0, correct: 0 };
    }
    profile.stats.byMode[problemMode].answered += 1;
    if (wasCorrect) {
      profile.stats.byMode[problemMode].correct += 1;
    }
    saveProfile();
  }

  function updateChallengeProgress(wasCorrect) {
    if (!challengeState.active) {
      return false;
    }

    challengeState.answered += 1;
    if (wasCorrect) {
      challengeState.correct += 1;
    }
    updateChallengeUI();
    return challengeState.answered >= challengeQuestionCount;
  }

  function finishChallengeRound() {
    challengeState.active = false;
    if (challengeTicker) {
      window.clearInterval(challengeTicker);
      challengeTicker = null;
    }

    const elapsedMs = Date.now() - challengeState.startedAt;
    const accuracy = challengeQuestionCount ? Math.round((challengeState.correct / challengeQuestionCount) * 100) : 0;
    const isBetterRound = challengeState.correct > profile.bestChallenge.score
      || (challengeState.correct === profile.bestChallenge.score
        && challengeState.correct > 0
        && (!profile.bestChallenge.timeMs || elapsedMs < profile.bestChallenge.timeMs));

    if (isBetterRound) {
      profile.bestChallenge = {
        score: challengeState.correct,
        timeMs: elapsedMs,
        accuracy: accuracy
      };
      saveProfile();
    }

    if (challengeState.correct === challengeQuestionCount) {
      profile.totalStarsEarned += 3;
      showRewardFlash('+3 Bonus Stars!');
      collectNewUnlocks();
      launchFireworks('big');
      launchConfetti('big');
      setStatus('Perfect lightning round! Extra stars for your mission!', 'special');
    } else {
      setStatus('Lightning Round done! ' + challengeState.correct + ' out of 10 correct.', 'special');
    }

    saveProfile();
    updateChallengeUI();
    updateStats();
  }

  function getExplanationForMiss() {
    if (!currentProblem || !currentProblem.explanation) {
      return getSupportiveMissMessage() + ' Let’s try another one!';
    }
    return getSupportiveMissMessage() + ' ' + currentProblem.explanation + ' Let’s try another one!';
  }

  function getStarJarBonus() {
    if (sessionStarJar < starJarSize) {
      return 0;
    }
    sessionStarJar = 0;
    starJarCopyElement.textContent = 'Star jar bonus! You earned 2 extra stars.';
    launchFireworks('medium');
    return 2;
  }

  function updateBossCadence() {
    pendingBossQuestion = answeredThisSession > 0 && answeredThisSession % bossQuestionCadence === 0;
  }

  function checkAnswer(choice) {
    if (!currentProblem || answersLocked) {
      return;
    }

    answersLocked = true;
    disableAnswerButtons();
    const responseMs = Date.now() - currentQuestionStartedAt;
    const wasCorrect = choice === currentProblem.answer;
    let renderDelay = 700;
    let shouldFinishChallenge = false;

    updateParentStats(currentProblem.mode, wasCorrect, responseMs);

    if (wasCorrect) {
      const scoreGain = gradeBands[currentBand].points + (currentProblem.isBoss ? Math.round(gradeBands[currentBand].points / 2) : 0);
      let earnedStars = currentProblem.rewardStars;
      score += scoreGain;
      levelProgress += scoreGain;
      currentStreak += 1;
      sessionStarJar += 1;
      profile.totalStarsEarned += earnedStars;
      answeredThisSession += 1;
      updateBossCadence();

      const bonusStars = getStarJarBonus();
      if (bonusStars) {
        profile.totalStarsEarned += bonusStars;
        earnedStars += bonusStars;
      }

      const newUnlocks = collectNewUnlocks();
      const leveledUp = tryLevelUp();
      const celebrationTier = getCelebrationTier(currentProblem.isBoss);
      const statusMessage = getCorrectMessage(currentProblem.isBoss, leveledUp, newUnlocks.length);

      showRewardFlash('+' + earnedStars + ' Star' + (earnedStars === 1 ? '!' : 's!'));
      showCelebrationBadge(statusMessage);
      setStatus(statusMessage, leveledUp || currentProblem.isBoss ? 'special' : 'right');

      if (celebrationTier === 'big') {
        launchFireworks('big');
        launchConfetti('big');
        renderDelay = 1080;
      } else if (celebrationTier === 'medium') {
        launchFireworks('medium');
        launchConfetti('medium');
        renderDelay = 920;
      } else {
        launchFireworks('small');
        renderDelay = currentProblem.isBoss ? 920 : 760;
      }

      saveBestProgress();
    } else {
      currentStreak = 0;
      answeredThisSession += 1;
      updateBossCadence();
      hideCelebrationBadge();
      setStatus(getExplanationForMiss(), 'soft');
      renderDelay = 820;
    }

    shouldFinishChallenge = updateChallengeProgress(wasCorrect);
    updateStats();

    window.setTimeout(function renderNext() {
      hideCelebrationBadge();
      if (shouldFinishChallenge) {
        finishChallengeRound();
        renderProblem();
        return;
      }
      renderProblem();
    }, renderDelay);
  }

  function startChallengeRound() {
    pendingBossQuestion = false;
    challengeState = {
      active: true,
      answered: 0,
      correct: 0,
      startedAt: Date.now()
    };
    challengeBannerElement.hidden = false;
    setStatus('Lightning Round! Ten quick questions. You can do it!', 'special');
    updateChallengeUI();

    if (challengeTicker) {
      window.clearInterval(challengeTicker);
    }
    challengeTicker = window.setInterval(updateChallengeUI, 100);
    renderProblem();
  }

  function updateChallengeUI() {
    const roundActive = challengeState.active;
    challengeBannerElement.hidden = !roundActive;
    startChallengeButton.disabled = roundActive;
    startChallengeSideButton.disabled = roundActive;
    nextProblemButton.disabled = roundActive;
    startChallengeButton.textContent = roundActive ? 'Lightning Round Running' : 'Lightning Round';
    startChallengeSideButton.textContent = roundActive ? 'Round Running' : 'Start Lightning Round';

    if (roundActive) {
      const remaining = challengeQuestionCount - challengeState.answered;
      challengeStatusElement.textContent = 'Quick answers, bright stars, and a speedy finish.';
      challengeProgressElement.textContent = remaining + ' left';
      challengeTimerElement.textContent = formatTime(Date.now() - challengeState.startedAt);
    } else {
      challengeProgressElement.textContent = challengeQuestionCount + ' left';
      challengeTimerElement.textContent = '0.0s';
    }

    challengeBestScoreElement.textContent = String(profile.bestChallenge.score || 0);
    challengeBestTimeElement.textContent = formatTime(profile.bestChallenge.timeMs);
  }

  function renderAvatarPicker() {
    avatarPickerElement.innerHTML = '';

    Object.keys(avatars).forEach(function appendAvatarOption(avatarId) {
      const avatar = avatars[avatarId];
      const unlocked = profile.unlockedAvatars.includes(avatarId);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'game-avatar-option';
      button.classList.toggle('is-active', profile.selectedAvatar === avatarId);
      button.classList.toggle('is-locked', !unlocked);
      button.innerHTML = '<span class="game-avatar-option-emoji">' + avatar.emoji + '</span>'
        + '<span class="game-avatar-option-name">' + avatar.name + '</span>'
        + '<span class="game-avatar-option-meta">' + (unlocked ? 'Ready to play' : 'Unlock at ' + avatar.unlockStars + ' stars') + '</span>';

      button.addEventListener('click', function handleAvatarPick() {
        if (!unlocked) {
          setStatus('Keep collecting stars to unlock ' + avatar.name + '.', 'soft');
          return;
        }
        profile.selectedAvatar = avatarId;
        avatarHelperCopyElement.textContent = avatar.heroCopy;
        saveProfile();
        renderAvatarPicker();
        renderUnlockGrid();
        updateStats();
        setStatus(avatar.name + ' is ready to help!', 'right');
      });

      avatarPickerElement.appendChild(button);
    });
  }

  function createUnlockSection(title, items) {
    const section = document.createElement('section');
    section.className = 'game-unlock-section';

    const heading = document.createElement('h3');
    heading.textContent = title;
    section.appendChild(heading);

    const grid = document.createElement('div');
    grid.className = 'game-unlock-section-grid';

    items.forEach(function appendUnlockCard(item) {
      const card = document.createElement('article');
      const unlocked = item.unlocked;
      card.className = 'game-unlock-card';
      card.classList.toggle('is-unlocked', unlocked);
      card.classList.toggle('is-equipped', item.equipped);
      card.innerHTML = '<div class="game-unlock-preview">' + item.preview + '</div>'
        + '<div class="game-unlock-copy">'
        + '<strong>' + item.label + '</strong>'
        + '<span>' + (unlocked ? item.unlockedCopy : 'Unlock at ' + item.unlockStars + ' stars') + '</span>'
        + '</div>';

      const actionButton = document.createElement('button');
      actionButton.type = 'button';
      actionButton.className = 'btn ghost';
      actionButton.textContent = unlocked ? (item.equipped ? 'Using' : 'Use') : 'Locked';
      actionButton.disabled = !unlocked || item.equipped;

      if (unlocked && !item.equipped) {
        actionButton.addEventListener('click', function handleUnlockAction() {
          item.onSelect();
        });
      }

      card.appendChild(actionButton);
      grid.appendChild(card);
    });

    section.appendChild(grid);
    return section;
  }

  function renderUnlockGrid() {
    unlockGridElement.innerHTML = '';

    unlockGridElement.appendChild(createUnlockSection('Friends', Object.keys(avatars).map(function buildAvatarReward(avatarId) {
      const avatar = avatars[avatarId];
      return {
        label: avatar.name,
        preview: avatar.emoji,
        unlockStars: avatar.unlockStars,
        unlocked: profile.unlockedAvatars.includes(avatarId),
        equipped: profile.selectedAvatar === avatarId,
        unlockedCopy: 'Friend ready to play',
        onSelect: function selectAvatar() {
          profile.selectedAvatar = avatarId;
          saveProfile();
          renderAvatarPicker();
          renderUnlockGrid();
          updateStats();
          setStatus(avatar.name + ' joined the mission!', 'right');
        }
      };
    })));

    unlockGridElement.appendChild(createUnlockSection('Background Themes', Object.keys(themeCatalog).map(function buildThemeReward(themeId) {
      const theme = themeCatalog[themeId];
      return {
        label: theme.label,
        preview: theme.preview,
        unlockStars: theme.unlockStars,
        unlocked: profile.unlockedThemes.includes(themeId),
        equipped: profile.equippedTheme === themeId,
        unlockedCopy: 'Theme ready to use',
        onSelect: function selectTheme() {
          profile.equippedTheme = themeId;
          saveProfile();
          renderUnlockGrid();
          updateStats();
          setStatus(theme.label + ' is glowing now!', 'right');
        }
      };
    })));

    unlockGridElement.appendChild(createUnlockSection('Sparkle Packs', Object.keys(fireworkCatalog).map(function buildFireworkReward(fireworkId) {
      const firework = fireworkCatalog[fireworkId];
      return {
        label: firework.label,
        preview: '✨',
        unlockStars: firework.unlockStars,
        unlocked: profile.unlockedFireworks.includes(fireworkId),
        equipped: profile.equippedFirework === fireworkId,
        unlockedCopy: 'Sparkle pack ready',
        onSelect: function selectFireworkTheme() {
          profile.equippedFirework = fireworkId;
          saveProfile();
          renderUnlockGrid();
          updateStats();
          setStatus(firework.label + ' is ready to sparkle!', 'right');
        }
      };
    })));

    const nextUnlock = getNextUnlock();
    unlockSummaryElement.textContent = nextUnlock
      ? 'Earn ' + Math.max(0, nextUnlock.unlockStars - profile.totalStarsEarned) + ' more stars to unlock ' + nextUnlock.label + '.'
      : 'Every current reward is unlocked. Great job!';
  }

  function getNextUnlock() {
    const allUnlocks = getAvatarUnlockThresholds().concat(getThemeUnlockThresholds(), getFireworkUnlockThresholds());
    const lockedUnlocks = allUnlocks.filter(function onlyLocked(reward) {
      if (reward.type === 'avatar') {
        return !profile.unlockedAvatars.includes(reward.id);
      }
      if (reward.type === 'theme') {
        return !profile.unlockedThemes.includes(reward.id);
      }
      return !profile.unlockedFireworks.includes(reward.id);
    });

    lockedUnlocks.sort(function compareUnlocks(left, right) {
      return left.unlockStars - right.unlockStars;
    });
    return lockedUnlocks[0] || null;
  }

  function renderParentStats() {
    const answered = profile.stats.answered;
    const accuracy = answered ? Math.round((profile.stats.correct / answered) * 100) : 0;
    const averageSpeed = answered ? Math.round(profile.stats.totalResponseMs / answered) : 0;

    parentAccuracyElement.textContent = accuracy + '%';
    parentSpeedElement.textContent = averageSpeed ? formatTime(averageSpeed) : '--';
    parentBestStreakElement.textContent = String(profile.bestStreak || 0);
    parentGradeElement.textContent = gradeBands[currentBand].label;
    parentOperationStatsElement.innerHTML = '';

    Object.keys(profile.stats.byMode).forEach(function appendOperationStat(mode) {
      const modeStats = profile.stats.byMode[mode];
      const accuracyValue = modeStats.answered ? Math.round((modeStats.correct / modeStats.answered) * 100) : 0;
      const row = document.createElement('div');
      row.className = 'game-parent-operation-row';
      row.innerHTML = '<span>' + capitalize(mode) + '</span>'
        + '<span>' + modeStats.correct + '/' + modeStats.answered + ' correct</span>'
        + '<strong>' + accuracyValue + '%</strong>';
      parentOperationStatsElement.appendChild(row);
    });
  }

  function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function updateStats() {
    const progressTarget = getLevelTarget(currentLevel);
    const progressPercent = Math.min(100, (levelProgress / progressTarget) * 100);
    const journeyPercent = Math.min(100, ((currentLevel - 1 + (levelProgress / progressTarget)) / journeyStages.length) * 100);
    const currentStageIndex = Math.min(journeyStages.length - 1, Math.floor((journeyPercent / 100) * journeyStages.length));
    const avatar = getCurrentAvatar();
    const nextUnlock = getNextUnlock();

    scoreCountElement.textContent = String(score);
    starCountElement.textContent = String(profile.totalStarsEarned);
    bestCountElement.textContent = String(bestScore);
    levelCountElement.textContent = String(currentLevel);
    streakCountElement.textContent = String(currentStreak);
    modeDescriptionElement.textContent = modeDescriptions[currentMode];
    gradeBandDescriptionElement.textContent = gradeBands[currentBand].description;
    gradeBandPointsElement.textContent = gradeBands[currentBand].points + ' points each';
    levelDescriptionElement.textContent = journeyStages[currentStageIndex];
    levelGoalElement.textContent = 'Earn ' + progressTarget + ' points to reach the next stop';
    levelProgressTextElement.textContent = levelProgress + ' / ' + progressTarget + ' points';
    levelBadgeElement.textContent = currentLevel === bestLevel && bestLevel > 1
      ? 'Best Journey Yet'
      : levelBadges[getDisplayLevelIndex(currentLevel)];
    levelProgressFillElement.style.width = progressPercent + '%';
    journeyRocketElement.style.left = 'calc(' + journeyPercent + '% - 18px)';
    avatarDisplayElement.textContent = avatar.emoji;
    heroCopyElement.textContent = avatar.heroCopy;
    avatarHelperCopyElement.textContent = avatar.heroCopy;
    gameShellElement.dataset.theme = profile.equippedTheme;

    starJar.forEach(function updateStarJar(star, index) {
      star.classList.toggle('earned', index < sessionStarJar);
    });
    starJarCopyElement.textContent = sessionStarJar
      ? sessionStarJar + ' of ' + starJarSize + ' stars lit up.'
      : 'Fill all 5 stars for a bonus reward.';
    nextUnlockCopyElement.textContent = nextUnlock
      ? nextUnlock.label + ' unlocks at ' + nextUnlock.unlockStars + ' stars.'
      : 'Every reward is unlocked. Keep playing for big streaks!';

    modeButtons.forEach(function updateModeButton(button) {
      const buttonMode = button.dataset.mode || '';
      button.classList.toggle('is-active', buttonMode === currentMode);
      button.disabled = challengeState.active || !getAllowedModes().includes(buttonMode);
    });

    gradeBandButtons.forEach(function updateBandButton(button) {
      button.classList.toggle('is-active', button.dataset.band === currentBand);
      button.disabled = challengeState.active;
    });

    journeyStops.forEach(function updateJourneyStop(stop, index) {
      stop.classList.toggle('is-active', index <= currentStageIndex);
    });

    renderAvatarPicker();
    renderUnlockGrid();
    renderParentStats();
    updateChallengeUI();
  }

  function toggleRewardsPanel() {
    const currentlyHidden = rewardsPanelElement.hidden;
    rewardsPanelElement.hidden = !currentlyHidden;
    toggleRewardsButton.textContent = currentlyHidden ? 'Hide Rewards' : 'Rewards';
  }

  function toggleParentPanel() {
    const currentlyHidden = parentPanelElement.hidden;
    parentPanelElement.hidden = !currentlyHidden;
    toggleParentButton.textContent = currentlyHidden ? 'Hide Parent' : 'Parent';
  }

  nextProblemButton.addEventListener('click', function handleNextProblem() {
    hideCelebrationBadge();
    setStatus('Fresh question coming up!', 'special');
    renderProblem();
  });

  modeButtons.forEach(function attachModeHandler(button) {
    button.addEventListener('click', function handleModeChange() {
      currentMode = button.dataset.mode || 'mixed';
      saveProfile();
      setStatus('Switched to ' + button.textContent + '.', 'right');
      updateStats();
      renderProblem();
    });
  });

  gradeBandButtons.forEach(function attachBandHandler(button) {
    button.addEventListener('click', function handleBandChange() {
      currentBand = button.dataset.band || 'single_digit';
      if (!getAllowedModes().includes(currentMode)) {
        currentMode = 'mixed';
      }
      saveProfile();
      setStatus('Math path changed to ' + gradeBands[currentBand].label + '.', 'right');
      updateStats();
      renderProblem();
    });
  });

  startChallengeButton.addEventListener('click', startChallengeRound);
  startChallengeSideButton.addEventListener('click', startChallengeRound);
  toggleRewardsButton.addEventListener('click', toggleRewardsPanel);
  toggleParentButton.addEventListener('click', toggleParentPanel);

  if (!getAllowedModes().includes(currentMode)) {
    currentMode = 'mixed';
  }
  updateStats();
  renderProblem();
  setStatus('Tap the answer and collect a star.', 'special');
})();
