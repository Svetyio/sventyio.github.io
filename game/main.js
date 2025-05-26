document.addEventListener("DOMContentLoaded", function() {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const spinBtn = document.getElementById('spinBtn');
  const restartBtn = document.getElementById('restartBtn');
  const winLabel = document.getElementById('winLabel');
  const FRUITS = ['🍎','🍒','🍇','🍀','🍉'];
  const GRID_SIZE = 5;
  let selectedBet = 20;
  let coins = 500;
  let lastWin = 0;
  let totalWin = 0;
  let grid = [];
  let spinning = false;

  function resizeCanvas() {
    let s = Math.min(window.innerWidth * 0.95, 380, window.innerHeight * 0.65);
    s = Math.max(s, 220);
    canvas.width = s;
    canvas.height = s;
    drawGrid();
  }
  window.addEventListener('resize', resizeCanvas);

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
    for (let row = 0; row < GRID_SIZE; row++) {
      let rowData = [];
      for (let col = 0; col < GRID_SIZE; col++) {
        rowData.push(randomFruit());
      }
      arr.push(rowData);
    }
    return arr;
  }

  function drawGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!grid.length) return;
    const c = canvas.width / (GRID_SIZE + 0.16);
    const m = c * 0.13;
    const o = (canvas.width - (GRID_SIZE * c + (GRID_SIZE - 1) * m)) / 2;
    const y = (canvas.height - (GRID_SIZE * c + (GRID_SIZE - 1) * m)) / 2;
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const x = o + col * (c + m), y0 = y + r * (c + m);
        ctx.save();
        ctx.fillStyle = '#111';
        ctx.globalAlpha = 0.97;
        ctx.fillRect(x, y0, c, c);
        ctx.restore();
        ctx.save();
        ctx.font = `${Math.floor(c * 0.46)}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#444';
        ctx.shadowBlur = 6;
        ctx.translate(x + c / 2, y0 + c / 2 + .5);
        ctx.fillText(grid[r][col], 0, 0);
        ctx.restore();
      }
    }
    updateInfo();
  }

  function updateInfo() {
    document.getElementById('coins').innerText = `Монети: ${coins}`;
    document.getElementById('lastWin').innerText = `Последна печалба: ${lastWin}`;
    document.getElementById('totalWin').innerText = `Обща печалба: ${totalWin}`;
    if (coins <= 0) {
      spinBtn.style.display = 'none';
      restartBtn.style.display = 'block';
    } else {
      spinBtn.style.display = 'block';
      restartBtn.style.display = 'none';
    }
  }

  function spin() {
    if (spinning || coins < selectedBet) return;
    spinning = true;
    coins -= selectedBet;
    grid = generateGrid();
    let win = checkWin();
    lastWin = win;
    totalWin += win;
    if (win > 0) coins += win;
    drawGrid();
    if (win > 0) {
      winLabel.textContent = `ПЕЧАЛБА +${win}`;
      winLabel.classList.add("active");
      setTimeout(() => winLabel.classList.remove("active"), 1500);
    }
    spinning = false;
  }

  function checkWin() {
    // Проверява дали има пълна редица, колона или диагонал с еднакви плодове
    let win = 0;
    for (let r = 0; r < GRID_SIZE; r++) {
      if (grid[r].every(f => f === grid[r][0])) win += 100;
    }
    for (let c = 0; c < GRID_SIZE; c++) {
      let colF = [];
      for (let r = 0; r < GRID_SIZE; r++) colF.push(grid[r][c]);
      if (colF.every(f => f === colF[0])) win += 150;
    }
    let d1 = [], d2 = [];
    for (let i = 0; i < GRID_SIZE; i++) {
      d1.push(grid[i][i]);
      d2.push(grid[i][GRID_SIZE - 1 - i]);
    }
    if (d1.every(f => f === d1[0])) win += 200;
    if (d2.every(f => f === d2[0])) win += 200;
    return win;
  }

  function restartGame() {
    coins = 500;
    lastWin = 0;
    totalWin = 0;
    grid = generateGrid();
    drawGrid();
  }

  spinBtn.addEventListener('click', spin);
  restartBtn.addEventListener('click', restartGame);

  // Залагане
  document.querySelectorAll('#bets .btn').forEach(btn => {
    btn.addEventListener('click', () => setBet(parseInt(btn.innerText)));
  });

  // Начално състояние
  grid = generateGrid();
  setBet(selectedBet);
  // Винаги първо resize, после draw!
  resizeCanvas();
  drawGrid();
  window.addEventListener("load", () => {
    resizeCanvas();
    drawGrid();
  });
});
