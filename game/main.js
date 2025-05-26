const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const sparkCanvas = document.getElementById('sparkCanvas');
const sparkCtx = sparkCanvas.getContext('2d');
const winLabel = document.getElementById('winLabel');
...
gameLoop();