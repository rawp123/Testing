(function initializeShellGame() {
  const startButton = document.getElementById('shell-start');
  const statusElement = document.getElementById('shell-status');
  const movesLeftElement = document.getElementById('shell-moves-left');
  const winsElement = document.getElementById('shell-wins');
  const ballElement = document.getElementById('shell-ball');
  const cupElements = Array.from(document.querySelectorAll('.shell-cup'));
  const cupSlots = [-220, 0, 220];
  const mobileCupSlots = [-110, 0, 110];
  const totalMoves = 10;
  const winsStorageKey = 'shell-game-wins';

  let cups = [
    { id: 0, slot: 0 },
    { id: 1, slot: 1 },
    { id: 2, slot: 2 }
  ];
  let ballCupId = 1;
  let wins = Number(window.localStorage.getItem(winsStorageKey)) || 0;
  let acceptingGuess = false;
  let shuffling = false;

  function getSlotOffsets() {
    return window.innerWidth <= 700 ? mobileCupSlots : cupSlots;
  }

  function findCupById(cupId) {
    return cups.find(function findCup(cup) {
      return cup.id === cupId;
    });
  }

  function updateBallPosition() {
    const slotOffsets = getSlotOffsets();
    const ballCup = findCupById(ballCupId);
    const cupOffset = slotOffsets[ballCup ? ballCup.slot : 1];
    ballElement.style.transform = 'translateX(' + cupOffset + 'px)';
  }

  function renderCups() {
    const slotOffsets = getSlotOffsets();

    cupElements.forEach(function renderCup(button) {
      const cupId = Number(button.dataset.cupId);
      const cupData = findCupById(cupId);
      button.style.setProperty('--cup-x', slotOffsets[cupData.slot] + 'px');
    });

    updateBallPosition();
  }

  function setStatus(message, tone) {
    statusElement.textContent = message;
    statusElement.classList.remove('right', 'wrong');
    if (tone) {
      statusElement.classList.add(tone);
    }
  }

  function setGuessEnabled(enabled) {
    acceptingGuess = enabled;
    cupElements.forEach(function updateButton(button) {
      button.disabled = !enabled;
    });
  }

  function clearCupHighlights() {
    cupElements.forEach(function clearClasses(button) {
      button.classList.remove('is-picked', 'is-correct', 'is-wrong', 'is-lifted');
    });
  }

  function resetRound() {
    clearCupHighlights();
    cups = [
      { id: 0, slot: 0 },
      { id: 1, slot: 1 },
      { id: 2, slot: 2 }
    ];
    ballCupId = Math.floor(Math.random() * 3);
    movesLeftElement.textContent = String(totalMoves);
    renderCups();
    updateBallPosition();
  }

  function pause(ms) {
    return new Promise(function wait(resolve) {
      window.setTimeout(resolve, ms);
    });
  }

  async function revealBallAtStart() {
    const startingCup = cupElements.find(function findButton(button) {
      return Number(button.dataset.cupId) === ballCupId;
    });

    ballElement.style.opacity = '1';
    if (startingCup) {
      startingCup.classList.add('is-lifted');
      await pause(850);
      startingCup.classList.remove('is-lifted');
      await pause(280);
    }
    ballElement.style.opacity = '0';
  }

  function swapTwoRandomCups() {
    const firstIndex = Math.floor(Math.random() * cups.length);
    let secondIndex = Math.floor(Math.random() * cups.length);

    while (secondIndex === firstIndex) {
      secondIndex = Math.floor(Math.random() * cups.length);
    }

    const firstCup = cups[firstIndex];
    const secondCup = cups[secondIndex];
    const originalSlot = firstCup.slot;

    firstCup.slot = secondCup.slot;
    secondCup.slot = originalSlot;
  }

  async function startRound() {
    if (shuffling) {
      return;
    }

    shuffling = true;
    setGuessEnabled(false);
    clearCupHighlights();
    resetRound();
    setStatus('Watch closely. The ball is showing first.');
    await revealBallAtStart();
    setStatus('Shuffling the cups now.');
    ballElement.style.opacity = '0';

    for (let move = 1; move <= totalMoves; move += 1) {
      swapTwoRandomCups();
      renderCups();
      movesLeftElement.textContent = String(totalMoves - move);
      await pause(780);
    }

    setGuessEnabled(true);
    shuffling = false;
    setStatus('Pick a cup. Which one has the ball?');
  }

  function handleGuess(event) {
    if (!acceptingGuess || shuffling) {
      return;
    }

    const chosenCup = Number(event.currentTarget.dataset.cupId);
    const correctCupButton = cupElements.find(function findButton(button) {
      return Number(button.dataset.cupId) === ballCupId;
    });

    setGuessEnabled(false);
    clearCupHighlights();
    event.currentTarget.classList.add('is-picked');

    if (correctCupButton) {
      correctCupButton.classList.add('is-lifted', 'is-correct');
    }

    if (chosenCup === ballCupId) {
      wins += 1;
      winsElement.textContent = String(wins);
      window.localStorage.setItem(winsStorageKey, String(wins));
      setStatus('You found it. Nice job!', 'right');
    } else {
      event.currentTarget.classList.add('is-wrong');
      setStatus('Not that one. The ball was under cup ' + (ballCupId + 1) + '.', 'wrong');
    }

    ballElement.style.opacity = '1';
    updateBallPosition();
  }

  cupElements.forEach(function attachGuessHandler(button) {
    button.addEventListener('click', handleGuess);
  });

  startButton.addEventListener('click', startRound);
  window.addEventListener('resize', renderCups);

  winsElement.textContent = String(wins);
  setGuessEnabled(false);
  resetRound();
})();
