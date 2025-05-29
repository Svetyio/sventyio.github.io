(() => {
  // --- Централизирани константи и конфиг ---
  const GRID_SIZE = 5;
  const VALID_BETS = [20, 40, 60, 100, 200];
  const FRUITS = [
    { char: '🍒', name: 'Череша', points: 20, color: "#ff5bcd" },
    { char: '🍉', name: 'Диня', points: 40, color: "#42e1fe" },
    { char: '🍇', name: 'Грозде', points: 60, color: "#a87fff" },
    { char: '🍎', name: 'Ябълка', points: 80, color: "#ff4040" },
    { char: '🍀', name: 'Детелина', points: 100, color: "#00e676" }
  ];
  const FRUIT_CHARS = FRUITS.map(f => f.char);
  const FRUIT_POINTS = Object.fromEntries(FRUITS.map(f => [f.char, f.points]));
  const FRUIT_PROBS = [0.28, 0.25, 0.20, 0.16, 0.11];
  const ACCUM_PROBS = FRUIT_PROBS.reduce((acc, p, i) => (acc[i] = (acc[i - 1] || 0) + p, acc), []);

  // --- DOM Elements (кеширани) ---
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const spinBtn = document.getElementById('spinBtn');
  const restartBtn = document.getElementById('restartBtn');
  const winLabel = document.getElementById('winLabel');
  const loseLabel = document.getElementById('loseLabel');
  const currentBetBox = document.getElementById('currentBet');
  const coinContainer = document.getElementById('coinContainer');
  const paytableBet = document.getElementById('paytableBet');
  const betBtns = [
    document.getElementById('betBtn20'),
    document.getElementById('betBtn40'),
    document.getElementById('betBtn60'),
    document.getElementById('betBtn100'),
    document.getElementById('betBtn200')
  ];
  const autoSpinIndicator = document.getElementById('autoSpinIndicator');
  const noCoinsMsg = document.getElementById('noCoinsMsg');
  const spinTooltip = document.getElementById('spinTooltip');
  const bigWinEffect = document.getElementById('bigWinEffect');
  const winHistoryEl = document.getElementById('winHistory');
  const ppCherry = document.getElementById('ppCherry');
  const ppWatermelon = document.getElementById('ppWatermelon');
  const ppGrape = document.getElementById('ppGrape');
  const ppApple = document.getElementById('ppApple');
  const ppClover = document.getElementById('ppClover');
  const coinsBox = document.getElementById('coins');
  const lastWinBox = document.getElementById('lastWin');
  const totalWinBox = document.getElementById('totalWin');

  // --- Аудио елементи и контрол ---
  const audioSpin = document.getElementById('audio-spin');
  const audioWin = document.getElementById('audio-win');
  const audioLose = document.getElementById('audio-lose');
  const audioBigWin = document.getElementById('audio-bigwin');
  const audioBtn = document.getElementById('audio-btn');
  const audioMusic = document.getElementById('audio-music');
  const musicBtn = document.getElementById('musicBtn');
  const fxBtn = document.getElementById('fxBtn');
  const musicVol = document.getElementById('musicVol');
  const fxVol = document.getElementById('fxVol');

  // --- Играчи, прогрес и състояния ---
  let selectedBet = 20, coins = 500, lastWin = 0, totalWin = 0, grid = [];
  let spinning = false, autoSpin = false, autoSpinTimer = null, spinHoldTimeout = null;
  let pointerDownTime = 0, pointerIsDown = false;
  let winLines = [], winEffectActive = false, winEffectFrame = 0;
  let loseEffectActive = false, loseEffectFrame = 0;
  let debounceTimer = null;
  let isShaking = false, shakeStart = 0, shakeDuration = 500;
  let musicEnabled = true, fxEnabled = true, musicStarted = false;
  let winHistory = [];
  let animationRunning = false;
  let animationFrameId = null;

  // --- Checksum за сигурност ---
  function crc32(str) {
    let c = 0 ^ -1;
    for (let i = 0; i < str.length; i++) {
      c = (c >>> 8) ^ [0,1996959894,3993919788,2567524794,124634137,1886057615,3915621685,4037000439,  ...Array(248).fill(0)][(c ^ str.charCodeAt(i)) & 0xFF];
    }
    return (c ^ -1) >>> 0;
  }
  function encodeData(obj) {
    const plain = JSON.stringify(obj);
    const sum = crc32(plain);
    return btoa(encodeURIComponent(plain)) + '.' + sum;
  }
  function decodeData(str) {
    try {
      const [data, checksum] = str.split('.');
      const plain = decodeURIComponent(atob(data));
      if (crc32(plain) !== Number(checksum)) throw new Error("Corrupted data");
      return JSON.parse(plain);
    } catch(e) { return null; }
  }

  // --- LocalStorage save/load с try/catch и checksum ---
  function saveProgress(immediate) {
    if (debounceTimer) clearTimeout(debounceTimer);
    const write = () => {
      const data = { coins, lastWin, totalWin, selectedBet, winHistory };
      try {
        localStorage.setItem("svetlyo_slot_progress", encodeData(data));
      } catch (e) {
        console.warn("Грешка при запис в LocalStorage", e);
        autoSpinIndicator.style.display = "block";
        autoSpinIndicator.innerText = "⚠️ Проблем със запис!";
      }
    };
    if (immediate) write();
    else debounceTimer = setTimeout(write, 500);
  }
  function loadProgress() {
    try {
      const data = localStorage.getItem("svetlyo_slot_progress");
      if (data) {
        const obj = decodeData(data);
        if (!obj || typeof obj !== 'object') throw new Error("Invalid");
        if (typeof obj.coins !== 'number' || typeof obj.lastWin !== 'number' ||
            typeof obj.totalWin !== 'number' || !VALID_BETS.includes(obj.selectedBet)) throw new Error("Corrupted");
        coins = obj.coins;
        lastWin = obj.lastWin;
        totalWin = obj.totalWin;
        selectedBet = obj.selectedBet;
        winHistory = Array.isArray(obj.winHistory) ? obj.winHistory : [];
      }
    } catch (e) { 
      try { localStorage.removeItem("svetlyo_slot_progress"); } catch(e){}
      coins = 500; lastWin = 0; totalWin = 0; winHistory = [];
    }
  }
  window.addEventListener("unload", () => saveProgress(true), {once:true});

  // --- Daily бонус (със защита) ---
  function grantDailyBonus() {
    const today = new Date().toLocaleDateString();
    try {
      if (localStorage.getItem('svetlyo_slot_dailybonus') !== today) {
        coins += 200;
        saveProgress(true);
        localStorage.setItem('svetlyo_slot_dailybonus', today);
        setTimeout(() => {
          winLabel.textContent = "ДНЕВЕН БОНУС +200";
          winLabel.classList.add("active");
          setTimeout(() => winLabel.classList.remove("active"), 2200);
        }, 450);
      }
    } catch(e){ /* ignore */ }
  }

  // --- Idle оптимизация и сигурност (само 1 listener) ---
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      safeMusicPause();
      winEffectActive = false;
      loseEffectActive = false;
      isShaking = false;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      animationRunning = false;
    } else {
      if (musicEnabled) safeMusicPlay();
      if (winLines.length) startWinEffect();
    }
  });

  // --- Аудио логика ---
  function safePlay(audio) {
    if (!audio || !fxEnabled) return;
    try {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = Number(fxVol.value);
      let p = audio.play();
      if (p && p.catch) p.catch(() => { });
    } catch (e) { }
  }
  function safeMusicPlay() {
    if (!musicEnabled) return;
    if (audioMusic.paused) musicStarted = false;
    audioMusic.volume = Number(musicVol.value);
    if (!musicStarted) {
      try {
        audioMusic.currentTime = 0;
        audioMusic.play().then(() => { musicStarted = true; }).catch(() => { });
      } catch (e) { }
    } else if (audioMusic.paused) {
      audioMusic.play().catch(() => {});
    }
  }
  function safeMusicPause() {
    try { audioMusic.pause(); } catch (e) { }
    musicStarted = false;
  }

  // --- Canvas адаптивен размер и throttled redraw ---
  let redrawRequested = false;
  function requestRedraw() {
    if (!redrawRequested) {
      redrawRequested = true;
      requestAnimationFrame(() => {
        drawGrid();
        redrawRequested = false;
      });
    }
  }
  function resizeCanvas() {
    let s = Math.min(window.innerWidth * 0.95, 400, window.innerHeight * 0.65);
    s = Math.max(s, 220);
    canvas.width = s;
    canvas.height = s;
    requestRedraw();
  }
  window.addEventListener("resize", resizeCanvas, {passive:true});

  // --- Win History визуализация ---
  function updateWinHistoryUI() {
    winHistoryEl.innerHTML = winHistory.slice(-20).reverse().map(e =>
      `<div>+${e.win} <span>${new Date(e.time).toLocaleTimeString()}</span></div>`
    ).join('');
  }

  // --- Draw grid (безопасно/оптимално) ---
  function drawGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (loseEffectActive) {
      let t = Math.abs(Math.sin(loseEffectFrame * 0.18));
      ctx.save();
      ctx.globalAlpha = 0.23 + 0.12 * t;
      ctx.fillStyle = "#FFD700";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;
      ctx.restore();
    }
    const c = canvas.width / (GRID_SIZE + .14), m = c * .125;
    const o = (canvas.width - (GRID_SIZE * c + (GRID_SIZE - 1) * m)) / 2;
    const y = (canvas.height - (GRID_SIZE * c + (GRID_SIZE - 1) * m)) / 2;
    const winSet = new Set(winLines.flatMap(l => l.coords.map(c => `${c[0]}-${c[1]}`)));
    for (let r = 0; r < GRID_SIZE; r++) for (let col = 0; col < GRID_SIZE; col++) {
      let x = o + col * (c + m), y0 = y + r * (c + m);
      if (isShaking) {
        const phase = Math.random() * 2 * Math.PI;
        const amp = 6 + Math.random() * 7;
        x += Math.cos(phase) * amp;
        y0 += Math.sin(phase) * amp;
      }
      ctx.save();
      ctx.fillStyle = '#141418';
      ctx.globalAlpha = .98;
      ctx.fillRect(x, y0, c, c);
      ctx.restore();
      ctx.save();
      ctx.font = `bold ${Math.floor(c * .54)}px 'Luckiest Guy',cursive,serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const fruit = grid[r]?.[col] || ' ';
      let highlight = false, lineIndex = -1;
      if (winSet.has(`${r}-${col}`)) {
        highlight = true;
        lineIndex = winLines.findIndex(l => l.coords.some(c => c[0] === r && c[1] === col));
      }
      if (highlight && winEffectActive) {
        const phase = (winEffectFrame / 9 + lineIndex) % 1;
        const colors = ['#FFD700', '#fff', '#FF5BCD', '#42e1fe', '#00e676', '#ff4040', '#a87fff'];
        let color = colors[lineIndex % colors.length];
        if (phase > 0.5) color = "#fff";
        ctx.shadowColor = color;
        ctx.shadowBlur = 35 + 14 * Math.abs(Math.sin(winEffectFrame / 7));
        ctx.globalAlpha = 0.88 + 0.12 * Math.sin(winEffectFrame / 3);
        ctx.fillStyle = color;
        ctx.fillText(fruit, x + c / 2, y0 + c / 2);
      } else {
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 1;
        ctx.fillText(fruit, x + c / 2, y0 + c / 2);
      }
      ctx.restore();
    }
    winSet.clear && winSet.clear();
  }

  // --- Централизирано animationLoop ---
  function animationLoop(ts) {
    let anyActive = false;
    if (winEffectActive) {
      winEffectFrame++;
      anyActive = true;
    }
    if (loseEffectActive) {
      loseEffectFrame++;
      if (loseEffectFrame > 20) loseEffectActive = false;
      else anyActive = true;
    }
    if (isShaking && shakeStart !== 0) {
      if (ts - shakeStart >= shakeDuration) {
        isShaking = false;
        shakeStart = 0;
      } else { anyActive = true; }
    }
    requestRedraw();
    if (anyActive) {
      animationRunning = true;
      animationFrameId = requestAnimationFrame(animationLoop);
    } else {
      animationRunning = false;
      animationFrameId = null;
    }
  }
  function startWinEffect() {
    winEffectActive = true; winEffectFrame = 0;
    if (!animationRunning) {
      animationRunning = true;
      animationFrameId = requestAnimationFrame(animationLoop);
    }
  }
  function stopWinEffect() {
    winEffectActive = false; winLines = [];
  }
  function startLoseEffect() {
    loseEffectActive = true; loseEffectFrame = 0;
    if (!animationRunning) {
      animationRunning = true;
      animationFrameId = requestAnimationFrame(animationLoop);
    }
  }
      // --- Win/Lose ефекти и монети ---
  function showCoinFall(amount) {
    const n = Math.min(10, Math.max(3, Math.floor(amount / 40)));
    for (let i = 0; i < n; i++) {
      const coin = document.createElement('div');
      coin.className = "coin-fall";
      coin.style.left = `${45 + Math.random() * 10}%`;
      coin.innerHTML = "🪙";
      coinContainer.appendChild(coin);
      setTimeout(() => { coin.remove(); }, 900);
    }
  }

  function updateInfo() {
    coinsBox.innerText = `Монети: ${coins}`;
    lastWinBox.innerText = `Последна печалба: ${lastWin}`;
    totalWinBox.innerText = `Обща печалба: ${totalWin}`;
    currentBetBox.innerText = `Залог: ${selectedBet}`;
    spinBtn.disabled = coins < selectedBet || coins <= 0;
    spinBtn.style.opacity = spinBtn.disabled ? "0.6" : "1";
    spinBtn.style.cursor = spinBtn.disabled ? "not-allowed" : "pointer";
    noCoinsMsg.style.display = coins < selectedBet ? 'block' : 'none';
    showLose(coins < selectedBet);
    for (let i = 0; i < betBtns.length; ++i) {
      betBtns[i].disabled = (coins <= 0);
    }
    if (autoSpin) autoSpinIndicator.style.display = "inline-block";
    else autoSpinIndicator.style.display = "none";
  }
  function showLose(show) {
    loseLabel.classList.toggle("show", !!show);
  }

  // --- Spin логика с двойна защита и почистване ---
  function spin(isAuto) {
    if (spinning || coins < selectedBet) return;
    spinning = true;
    stopWinEffect();
    safePlay(audioSpin);
    shakeFruits(() => {
      if (spinning && coins >= selectedBet) {
        coins -= selectedBet;
        if (coins < 0) coins = 0;
        if (coins < selectedBet && autoSpin) stopAutoSpin();
        const newGrid = generateGridSafe();
        animateSpin(newGrid, () => {
          const { lines } = calcWins();
          let totalWinRound = 0;
          winLines = [];
          lines.forEach(line => { totalWinRound += line.points; winLines.push(line); });
          lastWin = totalWinRound;
          totalWin += totalWinRound;
          if (totalWinRound > 0) {
            coins += totalWinRound;
            showCoinFall(totalWinRound);
            winHistory.push({ win: totalWinRound, time: Date.now() });
            if (winHistory.length > 20) winHistory.shift();
          }
          if (totalWinRound > 0 && winLines.length) {
            startWinEffect();
            winLabel.textContent = `ПЕЧАЛБА +${totalWinRound}`;
            winLabel.classList.add("active");
            if (totalWinRound >= selectedBet * 5) {
              safePlay(audioBigWin);
              bigWinEffect.style.display = "block";
              bigWinEffect.style.animation = "bigpulse 1.2s 3";
              document.getElementById('gameFrame').classList.add('frame-win-anim');
              setTimeout(() => {
                bigWinEffect.style.display = "none";
                document.getElementById('gameFrame').classList.remove('frame-win-anim');
              }, 1200);
            } else {
              safePlay(audioWin);
            }
          } else {
            startLoseEffect(); safePlay(audioLose);
          }
          setTimeout(() => winLabel.classList.remove("active"), 1700);
          spinning = false;
          saveProgress();
          updateInfo();
          updateWinHistoryUI();
          if (autoSpin && coins < selectedBet) stopAutoSpin();
          if (autoSpin && !isAuto) doAutoSpin();
          // Почистване на winLines за GC
          if (!winEffectActive) winLines = null;
        });
      } else {
        spinning = false;
      }
    });
  }

  // --- Централизирани анимации и почистване ---
  function shakeFruits(cb) {
    isShaking = true;
    shakeStart = performance.now();
    if (!animationRunning) {
      animationRunning = true;
      animationFrameId = requestAnimationFrame(animationLoop);
    }
    setTimeout(() => {
      isShaking = false;
      shakeStart = 0;
      if (typeof cb === "function") cb();
    }, shakeDuration);
  }

  function animateSpin(newGrid, cb) {
    const frames = 10;
    let frame = 0;
    let tempGrid = grid.map(row => row.slice());
    function spinAnim() {
      for (let r = 0; r < GRID_SIZE; r++)
        for (let c = 0; c < GRID_SIZE; c++)
          tempGrid[r][c] = FRUIT_CHARS[Math.floor(Math.random() * FRUIT_CHARS.length)];
      grid = tempGrid.map(row => row.slice());
      requestRedraw();
      frame++;
      if (frame < frames) {
        requestAnimationFrame(spinAnim);
      } else {
        grid = newGrid;
        requestRedraw();
        tempGrid = null; // Почистване
        setTimeout(cb, 250);
      }
    }
    requestAnimationFrame(spinAnim);
  }

  // --- AutoSpin anti-abuse и визуална защита ---
  let autoSpinCount = 0, autoSpinWindow = Date.now();
  function antiAutoSpinAbuse() {
    const now = Date.now();
    if (now - autoSpinWindow > 60000) { autoSpinCount = 0; autoSpinWindow = now; }
    autoSpinCount++;
    if (autoSpinCount > 100) {
      stopAutoSpin();
      autoSpinIndicator.style.display = "block";
      autoSpinIndicator.innerText = "⚠️ Лимит на авто-спинове!";
      setTimeout(() => autoSpinIndicator.style.display = "none", 6000);
      return false;
    }
    return true;
  }

  function doAutoSpin() {
    if (!antiAutoSpinAbuse()) return;
    if (autoSpinTimer) clearTimeout(autoSpinTimer);
    if (!autoSpin || spinning) { spinBtn.classList.remove('auto'); autoSpinIndicator.style.display = "none"; return; }
    if (coins < selectedBet) { stopAutoSpin(); return; }
    spin(true);
    autoSpinTimer = setTimeout(doAutoSpin, 1800 + Math.random() * 1000);
  }
  function stopAutoSpin() {
    if (!autoSpin) return;
    autoSpin = false;
    spinBtn.classList.remove('auto');
    autoSpinIndicator.innerText = "Автоматичен режим СПРЯН";
    autoSpinIndicator.style.display = "none";
    setTimeout(() => {
      autoSpinIndicator.innerText = "Автоматичен режим";
    }, 2000);
    if (autoSpinTimer) { clearTimeout(autoSpinTimer); autoSpinTimer = null; }
  }

  // --- Събития ---
  spinBtn.addEventListener('mousedown', startSpinHold, {passive:true});
  spinBtn.addEventListener('touchstart', startSpinHold, {passive:true});
  spinBtn.addEventListener('pointercancel', stopSpinHold, {passive:true});
  spinBtn.addEventListener('mouseenter', () => { spinTooltip.style.display = "block"; }, {passive:true});
  spinBtn.addEventListener('mouseleave', () => { spinTooltip.style.display = "none"; }, {passive:true});
  spinBtn.addEventListener('mouseup', spinBtnReleaseLogic, {passive:true});
  spinBtn.addEventListener('touchend', spinBtnReleaseLogic, {passive:true});
  spinBtn.addEventListener('click', function (e) {
    stopWinEffect();
    safePlay(audioBtn);
  }, {passive:true});

  function spinBtnReleaseLogic(e) {
    stopSpinHold();
    let held = Date.now() - pointerDownTime;
    if (held < 1500 && !spinning && coins >= selectedBet) {
      if (autoSpin) stopAutoSpin();
      else spin();
    }
  }
  function startSpinHold(e) {
    if (spinHoldTimeout) clearTimeout(spinHoldTimeout);
    pointerIsDown = true; pointerDownTime = Date.now();
    spinTooltip.style.display = "block";
    spinHoldTimeout = setTimeout(() => {
      if (pointerIsDown && !autoSpin) {
        autoSpin = true;
        spinBtn.classList.add('auto');
        autoSpinIndicator.innerText = "Автоматичен режим";
        autoSpinIndicator.style.display = "inline-block";
        doAutoSpin();
      }
    }, 1500);
  }
  function stopSpinHold(e) {
    pointerIsDown = false;
    spinTooltip.style.display = "none";
    if (spinHoldTimeout) { clearTimeout(spinHoldTimeout); spinHoldTimeout = null; }
  }

  document.addEventListener('keydown', function (e) {
    if (document.activeElement && /input|textarea|button/i.test(document.activeElement.tagName)) return;
    if (e.code === "Space" && coins > 0 && !spinning && coins >= selectedBet) {
      spin();
      e.preventDefault();
    }
    if (e.key >= '1' && e.key <= '5' && coins > 0) {
      const idx = Number(e.key) - 1;
      if (VALID_BETS[idx] && !betBtns[idx].disabled) setBet(VALID_BETS[idx]);
    }
  }, {passive:true});

  restartBtn.addEventListener('click', restartGame, {passive:true, once:true});

  betBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const val = Number(btn.innerText);
      setBet(val);
    }, {passive:true});
  });

  window.addEventListener("pagehide", function () { saveProgress(true); }, {once:true});
  window.addEventListener("beforeunload", function () { saveProgress(true); }, {once:true});

  function setBet(bet) {
    bet = Number(bet);
    if (!VALID_BETS.includes(bet)) return;
    selectedBet = bet;
    betBtns.forEach(btn => {
      const val = Number(btn.innerText);
      btn.classList.toggle('selected-bet', val === bet);
      if (val === bet) { btn.style.animation = "betpulse 0.31s"; setTimeout(() => btn.style.animation = "", 350); }
    });
    updatePaytable();
    updateInfo();
    showLose(coins < selectedBet);
    saveProgress();
    if (coins < selectedBet && autoSpin) stopAutoSpin();
    safePlay(audioBtn);
  }

  function updatePaytable() {
    paytableBet.innerText = selectedBet;
    ppCherry.innerText = FRUITS[0].points * (selectedBet / 20);
    ppWatermelon.innerText = FRUITS[1].points * (selectedBet / 20);
    ppGrape.innerText = FRUITS[2].points * (selectedBet / 20);
    ppApple.innerText = FRUITS[3].points * (selectedBet / 20);
    ppClover.innerText = FRUITS[4].points * (selectedBet / 20);
  }

  function restartGame() {
    if (!confirm("Сигурен ли си, че искаш да рестартираш играта? Целият прогрес ще бъде изгубен.")) return;
    stopWinEffect();
    coins = 500; lastWin = 0; totalWin = 0; grid = generateGridSafe();
    winHistory = [];
    saveProgress(true); showLose(false); requestRedraw();
    updatePaytable();
    updateInfo();
    updateWinHistoryUI();
    safeMusicPause(); musicStarted = false; musicBtn.classList.add("on"); fxBtn.classList.add("on");
  }

  // --- Инициализация ---
  grantDailyBonus();
  loadProgress();
  grid = generateGridSafe();
  setBet(selectedBet);
  resizeCanvas();
  requestRedraw();
  updatePaytable();
  updateInfo();
  updateWinHistoryUI();
})();
