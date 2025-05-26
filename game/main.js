const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const sparkCanvas = document.getElementById('sparkCanvas');
const sparkCtx = sparkCanvas.getContext('2d');
const winLabel = document.getElementById('winLabel');
const spinBtn = document.getElementById('spinBtn');
const restartBtn = document.getElementById('restartBtn');
const doubleModalBg = document.getElementById('doubleModalBg');
const doubleText = document.getElementById('doubleText');
const doubleResult = document.getElementById('doubleResult');
const doubleRed = document.getElementById('doubleRed');
const doubleGreen = document.getElementById('doubleGreen');

const FRUITS = ['🍎','🍒','🍇','🍀','🍉'];
const GRID_SIZE = 5;

let selectedBet = 20;
let coins = 500;
let lastWin = 0;
let totalWin = 0;
let grid = [];
let spinning = false;
let spinAnimFrame = 0;
let spinTargetGrid = [];
let winFlash = false;
let winFlashLines = [];
let doublePending = false;
let doubleAmount = 0;
let noWinCount = 0;
let animCoins = coins, animLastWin = lastWin, animTotalWin = totalWin;
let autoSpin = false, autoSpinInterval = null;
let holdTimeout = null, holdingSpin = false;
let sparks = [];

function resizeCanvas() {
  let s = Math.min(window.innerWidth * 0.95, 380, window.innerHeight * 0.65);
  s = Math.max(s, 220);
  canvas.width = s;
  canvas.height = s;
  sparkCanvas.width = s;
  sparkCanvas.height = s;
  drawGrid();
}
window.addEventListener('resize', resizeCanvas);

function saveStats() {
  localStorage.setItem('slot_coins', coins);
  localStorage.setItem('slot_lastWin', lastWin);
  localStorage.setItem('slot_totalWin', totalWin);
}
function loadStats() {
  coins = Number(localStorage.getItem('slot_coins')) || 500;
  lastWin = Number(localStorage.getItem('slot_lastWin')) || 0;
  totalWin = Number(localStorage.getItem('slot_totalWin')) || 0;
  animCoins = coins;
  animLastWin = lastWin;
  animTotalWin = totalWin;
}
function setBet(bet) {
  selectedBet = bet;
  document.querySelectorAll('#bets .btn').forEach(btn => {
    btn.classList.remove('selected-bet');
    if (parseInt(btn.innerText) === bet) btn.classList.add('selected-bet');
  });
}
function randomFruit() {
  return FRUITS[Math.floor(Math.random() * FRUITS.length)];
}
function generateGrid() {
  let arr = [];
  let r = Math.random();
  let f = noWinCount >= 5;
  if (r < 0.4 || f) {
    let winRow = Math.floor(Math.random() * GRID_SIZE);
    let fruit = randomFruit();
    for (let row = 0; row < GRID_SIZE; row++) {
      let rowData = [];
      for (let col = 0; col < GRID_SIZE; col++) {
        rowData.push(row === winRow ? fruit : randomFruit());
      }
      arr.push(rowData);
    }
  } else if (r < 0.63) {
    let winCol = Math.floor(Math.random() * GRID_SIZE);
    let fruit = randomFruit();
    for (let row = 0; row < GRID_SIZE; row++) {
      let rowData = [];
      for (let col = 0; col < GRID_SIZE; col++) {
        rowData.push(col === winCol ? fruit : randomFruit());
      }
      arr.push(rowData);
    }
  } else if (r < 0.75) {
    let mainDiag = Math.random() < 0.5;
    let fruit = randomFruit();
    for (let row = 0; row < GRID_SIZE; row++) {
      let rowData = [];
      for (let col = 0; col < GRID_SIZE; col++) {
        rowData.push((mainDiag && row === col) || (!mainDiag && col === GRID_SIZE - 1 - row) ? fruit : randomFruit());
      }
      arr.push(rowData);
    }
  } else {
    for (let row = 0; row < GRID_SIZE; row++) {
      let rowData = [];
      for (let col = 0; col < GRID_SIZE; col++) {
        rowData.push(randomFruit());
      }
      arr.push(rowData);
    }
  }
  return arr;
}
function getWinningLines(g) {
  let l = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    if (g[r].every(f => f === g[r][0])) l.push({ type: 'row', index: r, fruit: g[r][0] });
  }
  for (let c = 0; c < GRID_SIZE; c++) {
    let colF = [];
    for (let r = 0; r < GRID_SIZE; r++) colF.push(g[r][c]);
    if (colF.every(f => f === colF[0])) l.push({ type: 'col', index: c, fruit: colF[0] });
  }
  let d1 = [], d2 = [];
  for (let i = 0; i < GRID_SIZE; i++) d1.push(g[i][i]), d2.push(g[i][GRID_SIZE - 1 - i]);
  if (d1.every(f => f === d1[0])) l.push({ type: 'diag', index: 0, fruit: d1[0] });
  if (d2.every(f => f === d2[0])) l.push({ type: 'diag', index: 1, fruit: d2[0] });
  return l;
}
function getWinScore(lines) {
  let score = 0;
  for (const line of lines) {
    if (line.type === 'row') score += 100;
    else if (line.type === 'col') score += 150;
    else if (line.type === 'diag') score += 200;
  }
  return score;
}
function triggerWinFlash(lines) {
  winFlash = true;
  winFlashLines = lines;
  winLabel.classList.add("active");
  createSparks();
}
function clearWinFlash() {
  winFlash = false;
  winLabel.classList.remove("active");
  winFlashLines = [];
}
function showWinLabel(w) {
  winLabel.textContent = `ПЕЧАЛБА +${w}`;
  winLabel.classList.add("active");
}
function drawGrid() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const c = canvas.width / (GRID_SIZE + 0.16);
  const m = c * 0.13;
  const o = (canvas.width - (GRID_SIZE * c + (GRID_SIZE - 1) * m)) / 2;
  const y = (canvas.height - (GRID_SIZE * c + (GRID_SIZE - 1) * m)) / 2;
  let h = Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(false));
  for (const l of winFlashLines) {
    if (l.type === "row") for (let a = 0; a < GRID_SIZE; a++) h[l.index][a] = true;
    if (l.type === "col") for (let a = 0; a < GRID_SIZE; a++) h[a][l.index] = true;
    if (l.type === "diag" && l.index === 0) for (let a = 0; a < GRID_SIZE; a++) h[a][a] = true;
    if (l.type === "diag" && l.index === 1) for (let a = 0; a < GRID_SIZE; a++) h[a][GRID_SIZE - 1 - a] = true;
  }
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const x = o + col * (c + m), y0 = y + r * (c + m);
      ctx.save();
      ctx.fillStyle = '#111';
      ctx.globalAlpha = 0.97;
      ctx.fillRect(x, y0, c, c);
      ctx.restore();
      let shake = 0, halo = 0;
      if (h[r][col] && winFlash) {
        halo = 1;
        shake = Math.sin(Date.now() / 45 + r + col) * 3;
      }
      if (halo) {
        ctx.save();
        ctx.globalAlpha = 0.35 + 0.15 * Math.sin(Date.now() / 120 + r + col);
        ctx.beginPath();
        ctx.arc(x + c / 2, y0 + c / 2, c * 0.38, 0, 2 * Math.PI);
        ctx.fillStyle = "rgba(255,255,0,0.36)";
        ctx.filter = "blur(6px)";
        ctx.fill();
        ctx.restore();
      }
      ctx.save();
      ctx.font = `${Math.floor(c * 0.46)}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.shadowColor = '#444';
      ctx.shadowBlur = 6;
      ctx.translate(x + c / 2 + shake, y0 + c / 2 + .5 + shake);
      ctx.fillText(grid[r][col], 0, 0);
      ctx.restore();
    }
  }
  if (winFlash && winFlashLines.length > 0) {
    for (const l of winFlashLines) {
      ctx.save();
      if (l.type === "row") ctx.strokeStyle = "#ffe047";
      else if (l.type === "col") ctx.strokeStyle = "#86e0fa";
      else if (l.type === "diag") ctx.strokeStyle = "#ff88e0";
      ctx.lineWidth = c * 0.15;
      ctx.globalAlpha = 0.25 + 0.2 * Math.abs(Math.sin(Date.now() / 300));
      ctx.beginPath();
      if (l.type === "row") {
        ctx.moveTo(o, y + l.index * (c + m) + c / 2);
        ctx.lineTo(o + GRID_SIZE * c + (GRID_SIZE - 1) * m, y + l.index * (c + m) + c / 2);
      } else if (l.type === "col") {
        ctx.moveTo(o + l.index * (c + m) + c / 2, y);
        ctx.lineTo(o + l.index * (c + m) + c / 2, y + GRID_SIZE * c + (GRID_SIZE - 1) * m);
      } else if (l.type === "diag" && l.index === 0) {
        ctx.moveTo(o, y);
        ctx.lineTo(o + GRID_SIZE * (c + m) - m, y + GRID_SIZE * (c + m) - m);
      } else if (l.type === "diag" && l.index === 1) {
        ctx.moveTo(o + GRID_SIZE * (c + m) - m, y);
        ctx.lineTo(o, y + GRID_SIZE * (c + m) - m);
      }
      ctx.stroke();
      ctx.restore();
    }
  }
  updateInfo();
}
function animateNumber(cur, target) {
  if (Math.abs(cur - target) < 0.5) return target;
  return cur + (target - cur) * 0.15;
}
function updateInfo() {
  animCoins = animateNumber(animCoins, coins);
  animLastWin = animateNumber(animLastWin, lastWin);
  animTotalWin = animateNumber(animTotalWin, totalWin);
  document.getElementById('coins').innerText = `Монети: ${Math.round(animCoins)}`;
  document.getElementById('lastWin').innerText = `Последна печалба: ${Math.round(animLastWin)}`;
  document.getElementById('totalWin').innerText = `Обща печалба: ${Math.round(animTotalWin)}`;
  if (coins <= 0) {
    spinBtn.style.display = 'none';
    restartBtn.style.display = 'block';
    stopAutoSpin();
  } else {
    spinBtn.style.display = 'block';
    restartBtn.style.display = 'none';
  }
  spinBtn.classList.toggle('auto', autoSpin);
}
function createSparks() {
  sparks = [];
  const w = sparkCanvas.width, h = sparkCanvas.height;
  for (let i = 0; i < 60; i++) {
    let a = 2 * Math.PI * Math.random();
    let s = 2 + 3.5 * Math.random();
    sparks.push({
      x: w / 2, y: h / 2, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      alpha: 1,
      color0: `hsl(${360 * Math.random()},100%,85%)`,
      color1: `hsl(${360 * Math.random()},100%,60%)`,
      size: 3 + 3 * Math.random(),
      life: 24 + 18 * Math.random()
    });
  }
}
function updateSparks() {
  sparkCtx.clearRect(0, 0, sparkCanvas.width, sparkCanvas.height);
  for (let i = 0; i < sparks.length; i++) {
    let s = sparks[i];
    if (s.life > 0 && s.alpha > 0) {
      let g = sparkCtx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.size);
      g.addColorStop(0, s.color0);
      g.addColorStop(1, s.color1);
      sparkCtx.globalAlpha = s.alpha;
      sparkCtx.beginPath();
      sparkCtx.arc(s.x, s.y, s.size, 0, 2 * Math.PI);
      sparkCtx.fillStyle = g;
      sparkCtx.fill();
      sparkCtx.globalAlpha = 1;
      s.x += s.vx; s.y += s.vy;
      s.vx *= 0.95; s.vy *= 0.95;
      s.life -= 1;
      s.alpha *= 0.96;
    }
  }
  sparks = sparks.filter(s => s.life > 0 && s.alpha > 0.05);
}
function animateSpin(targetGrid, onEnd) {
  spinning = true;
  spinAnimFrame = 0;
  let n = 22;
  let tempGrid = grid.map(r => r.slice());
  (function t() {
    spinAnimFrame++;
    if (spinAnimFrame < n - GRID_SIZE) {
      for (let r = 0; r < GRID_SIZE; r++)
        for (let c = 0; c < GRID_SIZE; c++)
          tempGrid[r][c] = randomFruit();
    } else {
      let rf = spinAnimFrame - (n - GRID_SIZE);
      for (let r = 0; r < GRID_SIZE; r++) {
        if (r < rf)
          for (let c = 0; c < GRID_SIZE; c++)
            tempGrid[r][c] = targetGrid[r][c];
        else
          for (let c = 0; c < GRID_SIZE; c++)
            tempGrid[r][c] = randomFruit();
      }
    }
    grid = tempGrid.map(r => r.slice());
    drawGrid();
    if (spinAnimFrame < n) requestAnimationFrame(t);
    else {
      grid = targetGrid.map(r => r.slice());
      drawGrid();
      spinning = false;
      if (onEnd) onEnd();
    }
  })();
}
function showDoubleModal(amount) {
  doubleModalBg.classList.add('active');
  doubleText.textContent = `Спечели ${amount} монети! Искаш ли да ги удвоиш?`;
  doubleResult.textContent = '';
  doublePending = true;
  doubleAmount = amount;
  stopAutoSpin();
}
function closeDoubleModal() {
  doubleModalBg.classList.remove('active');
  doublePending = false;
}
doubleRed.onclick = () => doubleTry('red');
doubleGreen.onclick = () => doubleTry('green');
function doubleTry(color) {
  doubleRed.disabled = doubleGreen.disabled = true;
  let winColor = Math.random() < 0.5 ? 'red' : 'green';
  setTimeout(() => {
    if (color === winColor) {
      coins += doubleAmount;
      totalWin += doubleAmount;
      lastWin = 2 * doubleAmount;
      doubleResult.textContent = 'Поздравления! Удвои печалбата!';
      doubleResult.style.color = '#4f4';
      showWinLabel(2 * doubleAmount);
      setTimeout(() => {
        closeDoubleModal();
        drawGrid();
        saveStats();
        doubleRed.disabled = doubleGreen.disabled = false;
      }, 1200);
    } else {
      lastWin = 0;
      doubleResult.textContent = 'Губиш печалбата...';
      doubleResult.style.color = '#f44';
      showWinLabel(0);
      setTimeout(() => {
        closeDoubleModal();
        drawGrid();
        saveStats();
        doubleRed.disabled = doubleGreen.disabled = false;
      }, 1200);
    }
  }, 600);
}
function spin() {
  if (!spinning && coins >= selectedBet && !doublePending) {
    clearWinFlash();
    let g = generateGrid();
    coins -= selectedBet;
    saveStats();
    spinTargetGrid = g.map(r => r.slice());
    animateSpin(spinTargetGrid, () => {
      let lines = getWinningLines(grid);
      let win = getWinScore(lines);
      if (win > 0) {
        coins += win;
        lastWin = win;
        totalWin += win;
        saveStats();
        triggerWinFlash(lines);
        showWinLabel(win);
        setTimeout(() => showDoubleModal(win), 700);
        noWinCount = 0;
      } else {
        lastWin = 0;
        noWinCount++;
      }
      drawGrid();
    });
  }
}
function userSpinClick() {
  if (autoSpin) {
    stopAutoSpin();
    spinBtn.classList.remove('auto');
  } else {
    spin();
  }
}
spinBtn.addEventListener('mousedown', e => {
  if (!autoSpin && !spinning && coins >= selectedBet) {
    holdingSpin = true;
    holdTimeout = setTimeout(() => {
      if (holdingSpin) startAutoSpin();
    }, 1000);
  }
});
spinBtn.addEventListener('touchstart', e => {
  if (!autoSpin && !spinning && coins >= selectedBet) {
    holdingSpin = true;
    holdTimeout = setTimeout(() => {
      if (holdingSpin) startAutoSpin();
    }, 1000);
  }
});
spinBtn.addEventListener('mouseup', e => { holdingSpin = false; clearTimeout(holdTimeout); });
spinBtn.addEventListener('mouseleave', e => { holdingSpin = false; clearTimeout(holdTimeout); });
spinBtn.addEventListener('touchend', e => { holdingSpin = false; clearTimeout(holdTimeout); });
function startAutoSpin() {
  if (!autoSpin && coins >= selectedBet && !doublePending) {
    autoSpin = true;
    spinBtn.classList.add('auto');
    spin();
    autoSpinInterval = setInterval(() => {
      if (!autoSpin || spinning || coins < selectedBet || doublePending) return;
      spin();
    }, 5000);
  }
}
function stopAutoSpin() {
  autoSpin = false;
  clearInterval(autoSpinInterval);
  spinBtn.classList.remove('auto');
}
function restartGame() {
  coins = 500;
  lastWin = 0;
  totalWin = 0;
  noWinCount = 0;
  saveStats();
  grid = generateGrid();
  drawGrid();
  clearWinFlash();
  stopAutoSpin();
  closeDoubleModal();
  animCoins = coins;
  animLastWin = lastWin;
  animTotalWin = totalWin;
}
function gameLoop() {
  if (!spinning) drawGrid();
  updateSparks();
  requestAnimationFrame(gameLoop);
}
loadStats();
grid = generateGrid();
setBet(selectedBet);
resizeCanvas();
drawGrid();
gameLoop();
