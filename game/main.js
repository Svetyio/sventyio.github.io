(function() {
    // --- AUDIO LOGIC ---

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
    let musicEnabled = true, fxEnabled = true;
    let musicStarted = false;
    function safePlay(audio) {
        if (!audio || !fxEnabled) return;
        try {
            audio.pause();
            audio.currentTime = 0;
            audio.volume = Number(fxVol.value);
            let p = audio.play();
            if (p && p.catch) p.catch(()=>{});
        } catch(e){}
    }
    function safeMusicPlay() {
        if (!musicEnabled) return;
        audioMusic.volume = Number(musicVol.value);
        if (!musicStarted) {
            try {
                audioMusic.currentTime = 0;
                audioMusic.play().then(()=>{ musicStarted = true; }).catch(()=>{});
            } catch(e){}
        } else {
            if (audioMusic.paused) {
                audioMusic.play().catch(()=>{});
            }
        }
    }
    function safeMusicPause() {
        try { audioMusic.pause(); } catch(e){}
    }
    document.addEventListener('visibilitychange', ()=>{
        if (!document.hidden && musicEnabled) safeMusicPlay();
    });
    function userFirstActionHandler() {
        if (musicEnabled) safeMusicPlay();
        safePlay(audioBtn);
        document.removeEventListener('click', userFirstActionHandler);
        document.removeEventListener('touchstart', userFirstActionHandler);
    }
    document.addEventListener('click', userFirstActionHandler);
    document.addEventListener('touchstart', userFirstActionHandler);

    musicBtn.onclick = function() {
        musicEnabled = !musicEnabled;
        musicBtn.classList.toggle("on", musicEnabled);
        if (musicEnabled) safeMusicPlay(); else safeMusicPause();
    };
    fxBtn.onclick = function() {
        fxEnabled = !fxEnabled;
        fxBtn.classList.toggle("on", fxEnabled);
        [audioSpin, audioWin, audioLose, audioBigWin, audioBtn].forEach(a=>a.volume = Number(fxVol.value));
    };
    musicVol.oninput = function() {
        audioMusic.volume = Number(musicVol.value);
        if (musicEnabled) safeMusicPlay();
    };
    fxVol.oninput = function() {
        [audioSpin, audioWin, audioLose, audioBigWin, audioBtn].forEach(a=>a.volume = Number(fxVol.value));
    };
    audioMusic.volume = Number(musicVol.value);
    [audioSpin, audioWin, audioLose, audioBigWin, audioBtn].forEach(a=>a.volume = Number(fxVol.value));
    musicBtn.classList.add("on");
    fxBtn.classList.add("on");

    // --- GAME DATA ---
    const FRUITS = [
        {char:'🍒', name:'Череша',   points:20,  color:"#ff5bcd"},
        {char:'🍉', name:'Диня',     points:40,  color:"#42e1fe"},
        {char:'🍇', name:'Грозде',   points:60,  color:"#a87fff"},
        {char:'🍎', name:'Ябълка',   points:80,  color:"#ff4040"},
        {char:'🍀', name:'Детелина', points:100, color:"#00e676"}
    ];
    const FRUIT_CHARS = FRUITS.map(f=>f.char);
    const FRUIT_POINTS = {}; FRUITS.forEach(f=>FRUIT_POINTS[f.char]=f.points);
    const FRUIT_PROBS = [0.28, 0.25, 0.20, 0.16, 0.11];
    const ACCUM_PROBS = FRUIT_PROBS.reduce((acc, p, i) => (acc[i] = (acc[i-1]||0)+p, acc), []);

    let selectedBet=20, coins=500, lastWin=0, totalWin=0, grid=[];
    let spinning=false, autoSpin=false, autoSpinTimer=null, spinHoldTimeout=null;
    let animating=false, animationType="", animationProgress=0, animationGrid=[], animFrameId=null;
    let pointerDownTime=0, pointerIsDown=false;
    let winLines=[], winEffectActive=false, winEffectFrame=0, winAnimFrameId=null;
    let loseEffectActive=false, loseEffectFrame=0, loseAnimFrameId=null;
    let debounceTimer=null;
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const spinBtn = document.getElementById('spinBtn');
    const restartBtn = document.getElementById('restartBtn');
    const winLabel = document.getElementById('winLabel');
    const loseLabel = document.getElementById('loseLabel');
    const currentBetBox = document.getElementById('currentBet');
    const coinContainer = document.getElementById('coinContainer');
    const startScreen = document.getElementById('startScreen');
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
    const VALID_BETS = [20,40,60,100,200];
    const GRID_SIZE = 5;

    function saveProgress(immediate) {
        try {
            if (debounceTimer) clearTimeout(debounceTimer);
            const write = () => {
                const data = {coins,lastWin,totalWin,selectedBet};
                try { localStorage.setItem("svetlyo_slot_progress", JSON.stringify(data)); } catch(e){}
            };
            if(immediate) write();
            else debounceTimer = setTimeout(write, 500);
        } catch(e){}
    }
    function loadProgress() {
        try {
            const data = localStorage.getItem("svetlyo_slot_progress");
            if (data) {
                try {
                    const obj = JSON.parse(data);
                    if (typeof obj.coins==='number') coins=obj.coins;
                    if (typeof obj.lastWin==='number') lastWin=obj.lastWin;
                    if (typeof obj.totalWin==='number') totalWin=obj.totalWin;
                    if (VALID_BETS.includes(obj.selectedBet)) selectedBet=obj.selectedBet;
                } catch(e){}
            }
        } catch(e){}
    }

    function resizeCanvas() {
        let s=Math.min(window.innerWidth*0.95,400,window.innerHeight*0.65);
        s=Math.max(s,240);
        canvas.width=s;
        canvas.height=s;
        drawGrid();
    }
    window.addEventListener("resize",resizeCanvas);

    function setBet(bet){
        bet=Number(bet);
        if(!VALID_BETS.includes(bet))return;
        selectedBet=bet;
        betBtns.forEach(btn => {
            const val = Number(btn.innerText);
            btn.classList.toggle('selected-bet', val === bet);
            if(val === bet) { btn.style.animation="betpulse 0.31s"; setTimeout(()=>btn.style.animation="",350);}
        });
        updatePaytable();
        updateInfo();
        saveProgress();
        if (coins < selectedBet && autoSpin) stopAutoSpin();
        safePlay(audioBtn);
    }

    function updatePaytable() {
        paytableBet.innerText = selectedBet;
        document.getElementById('ppCherry').innerText = FRUITS[0].points * (selectedBet/20);
        document.getElementById('ppWatermelon').innerText = FRUITS[1].points * (selectedBet/20);
        document.getElementById('ppGrape').innerText = FRUITS[2].points * (selectedBet/20);
        document.getElementById('ppApple').innerText = FRUITS[3].points * (selectedBet/20);
        document.getElementById('ppClover').innerText = FRUITS[4].points * (selectedBet/20);
    }

    function randomFruit() {
        let r = Math.random();
        for (let i = 0; i < ACCUM_PROBS.length; i++) {
            if (r < ACCUM_PROBS[i]) return FRUITS[i].char;
        }
        return FRUITS[FRUITS.length-1].char;
    }
    function generateGrid() {
        let arr=[];
        for(let r=0;r<GRID_SIZE;r++){
            let row=[];
            for(let c=0;c<GRID_SIZE;c++) row.push(randomFruit());
            arr.push(row);
        }
        if(Math.random()<0.40) generateWinningRow(arr);
        if(Math.random()<0.25) generateWinningCol(arr);
        if(Math.random()<0.15) generateWinningDiag(arr);
        if(Math.random()<0.12) generateWinningDiag2(arr);
        return arr;
    }
    function generateWinningRow(arr) {
        let winRow=Math.floor(Math.random()*GRID_SIZE);
        let winFruit=FRUIT_CHARS[Math.floor(Math.random()*FRUIT_CHARS.length)];
        for(let c=0;c<GRID_SIZE;c++)arr[winRow][c]=winFruit;
    }
    function generateWinningCol(arr) {
        let winCol=Math.floor(Math.random()*GRID_SIZE);
        let winFruit=FRUIT_CHARS[Math.floor(Math.random()*FRUIT_CHARS.length)];
        for(let r=0;r<GRID_SIZE;r++)arr[r][winCol]=winFruit;
    }
    function generateWinningDiag(arr) {
        let winFruit=FRUIT_CHARS[Math.floor(Math.random()*FRUIT_CHARS.length)];
        for(let i=0;i<GRID_SIZE;i++)arr[i][i]=winFruit;
    }
    function generateWinningDiag2(arr) {
        let winFruit=FRUIT_CHARS[Math.floor(Math.random()*FRUIT_CHARS.length)];
        for(let i=0;i<GRID_SIZE;i++)arr[i][GRID_SIZE-1-i]=winFruit;
    }

    function drawGrid() {
        ctx.clearRect(0,0,canvas.width,canvas.height);
        if(loseEffectActive){
            let t=Math.abs(Math.sin(loseEffectFrame*0.18));
            ctx.save();
            ctx.globalAlpha=0.23+0.12*t;
            ctx.fillStyle="#FFD700";
            ctx.fillRect(0,0,canvas.width,canvas.height);
            ctx.globalAlpha=1;
            ctx.restore();
        }
        const c=canvas.width/(GRID_SIZE+.14),m=c*.125;
        const o=(canvas.width-(GRID_SIZE*c+(GRID_SIZE-1)*m))/2;
        const y=(canvas.height-(GRID_SIZE*c+(GRID_SIZE-1)*m))/2;
        for(let r=0;r<GRID_SIZE;r++) for(let col=0;col<GRID_SIZE;col++){
            const x=o+col*(c+m), y0=y+r*(c+m);
            ctx.save();
            ctx.fillStyle='#141418';
            ctx.globalAlpha=.98;
            ctx.fillRect(x,y0,c,c);
            ctx.restore();

            ctx.save();
            ctx.font=`bold ${Math.floor(c*.54)}px 'Luckiest Guy',cursive,serif`;
            ctx.textAlign='center';
            ctx.textBaseline='middle';
            let fruit=grid[r][col];
            let highlight=false, lineIndex=-1;
            if(winEffectActive && winLines.length){
                for(let i=0;i<winLines.length;i++){
                    let line=winLines[i];
                    for(let j=0;j<line.coords.length;j++){
                        if(line.coords[j][0]===r && line.coords[j][1]===col){
                            highlight=true;lineIndex=i;
                        }
                    }
                }
            }
            if(highlight && winEffectActive){
                let phase=(winEffectFrame/9+lineIndex)%1;
                const colors=['#FFD700','#fff','#FF5BCD','#42e1fe','#00e676','#ff4040','#a87fff'];
                let color=colors[lineIndex%colors.length];
                if(phase>0.5) color="#fff";
                ctx.shadowColor=color;
                ctx.shadowBlur=35+14*Math.abs(Math.sin(winEffectFrame/7));
                ctx.globalAlpha=0.88+0.12*Math.sin(winEffectFrame/3);
                ctx.fillStyle=color;
                ctx.fillText(fruit,x+c/2,y0+c/2);
            }else{
                ctx.shadowColor='#FFD700';
                ctx.shadowBlur=10;
                ctx.fillStyle='#fff';
                ctx.globalAlpha=1;
                ctx.fillText(fruit,x+c/2,y0+c/2);
            }
            ctx.restore();
        }
        updateInfo();
    }

    function updateInfo() {
        document.getElementById('coins').innerText=`Монети: ${coins}`;
        document.getElementById('lastWin').innerText=`Последна печалба: ${lastWin}`;
        document.getElementById('totalWin').innerText=`Обща печалба: ${totalWin}`;
        currentBetBox.innerText=`Залог: ${selectedBet}`;
        spinBtn.style.display=coins>0?'block':'none';
        noCoinsMsg.style.display = coins <= 0 ? 'block' : 'none';
        showLose(coins===0);
        for(let i=0;i<betBtns.length;++i){
            betBtns[i].disabled = (coins <= 0);
        }
        if(autoSpin) autoSpinIndicator.style.display="inline-block";
        else autoSpinIndicator.style.display="none";
    }

    function showLose(show) {
        loseLabel.classList.toggle("show",!!show);
    }

    function startWinEffect() {
        winEffectActive=true;winEffectFrame=0;
        function winAnimLoop(){
            if(!winEffectActive)return;
            winEffectFrame++;
            drawGrid();
            winAnimFrameId = requestAnimationFrame(winAnimLoop);
        }
        winAnimLoop();
    }
    function stopWinEffect(){
        winEffectActive=false;winLines=[];
        if(winAnimFrameId) { cancelAnimationFrame(winAnimFrameId); winAnimFrameId=null; }
    }
    function startLoseEffect(){
        loseEffectActive=true;loseEffectFrame=0;
        function loseAnimLoop(){
            if(!loseEffectActive)return;
            loseEffectFrame++;
            drawGrid();
            loseAnimFrameId = requestAnimationFrame(() => {
                if(loseEffectFrame<20) loseAnimLoop();
                else{loseEffectActive=false;drawGrid();}
            });
        }
        loseAnimLoop();
    }

    // --- SHAKE ANIMATION (канвас разклащане) ---
    function shakeCanvas(duration = 600, intensity = 11, cb) {
        const canvas = document.getElementById('gameCanvas');
        let start = null;
        function shakeFrame(ts) {
            if (!start) start = ts;
            let p = (ts - start) / duration;
            if (p < 1) {
                const dx = (Math.random() - 0.5) * intensity;
                const dy = (Math.random() - 0.5) * intensity;
                canvas.style.transform = `translate(${dx}px,${dy}px) rotate(${(Math.random()-0.5)*4}deg)`;
                requestAnimationFrame(shakeFrame);
            } else {
                canvas.style.transform = '';
                if (typeof cb === 'function') cb();
            }
        }
        requestAnimationFrame(shakeFrame);
    }

    // --- SPIN FUNCTION (сега с shake ефект) ---
    function spin(isAuto){
        if (spinning) return;
        spinning = true;
        stopWinEffect();
        safePlay(audioSpin);

        // 1. SHAKE, после сменя комбинацията
        shakeCanvas(550, 13, () => {
            coins -= selectedBet;
            if (coins < 0) coins = 0;
            if (coins < selectedBet && autoSpin) stopAutoSpin();
            let newGrid=generateGrid();
            animateSpin(newGrid,()=>{
                let {win,lines}=calcWins();
                win = Number(win.toFixed(0));
                lastWin=win;
                totalWin+=win;
                if(win>0){
                    coins+=win;
                    showCoinFall(win);
                }
                drawGrid();
                if(win>0&&lines.length){
                    winLines=lines;
                    startWinEffect();
                    winLabel.textContent=`ПЕЧАЛБА +${win}`;
                    winLabel.classList.add("active");
                    if(win >= selectedBet * 5){
                        safePlay(audioBigWin);
                        bigWinEffect.style.display="block";
                        bigWinEffect.style.animation="bigpulse 1.2s 3";
                        setTimeout(()=>{bigWinEffect.style.display="none";},3100);
                    } else {
                        safePlay(audioWin);
                    }
                }else{
                    startLoseEffect();safePlay(audioLose);
                }
                setTimeout(()=>winLabel.classList.remove("active"),1700);
                spinning=false;
                saveProgress();
                if(autoSpin&&coins<selectedBet)stopAutoSpin();
                if(autoSpin&&!isAuto)doAutoSpin();
            });
        });
    }

    // --- Останалата логика не се променя --- 

    function showCoinFall(amount){
        let n=Math.min(10,Math.max(3,Math.floor(amount/40)));
        for(let i=0;i<n;i++){
            let coin=document.createElement('div');
            coin.className="coin-fall";
            coin.style.left=`${45+Math.random()*10}%`;
            coin.innerHTML="🪙";
            coinContainer.appendChild(coin);
            setTimeout(()=>{coin.remove();},900);
        }
    }

    function calcWins() {
        let win=0,lines=[];
        for(let r=0;r<GRID_SIZE;r++){
            let f=grid[r][0];
            if(grid[r].every(ff=>ff===f)){
                let points=FRUIT_POINTS[f]*selectedBet/20;
                win+=points;
                lines.push({type:"row",coords:Array.from({length:GRID_SIZE},(_,i)=>[r,i]),fruit:f});
            }
        }
        for(let c=0;c<GRID_SIZE;c++){
            let f=grid[0][c],all=true;
            for(let r=0;r<GRID_SIZE;r++)if(grid[r][c]!==f)all=false;
            if(all){
                let points=FRUIT_POINTS[f]*selectedBet/20;
                win+=points;
                lines.push({type:"col",coords:Array.from({length:GRID_SIZE},(_,i)=>[i,c]),fruit:f});
            }
        }
        let f1=grid[0][0],all1=true;
        for(let i=0;i<GRID_SIZE;i++) if(grid[i][i]!==f1) all1=false;
        if(all1){
            let points=FRUIT_POINTS[f1]*selectedBet/20;
            win+=points;
            lines.push({type:"diag",coords:Array.from({length:GRID_SIZE},(_,i)=>[i,i]),fruit:f1});
        }
        let f2=grid[0][GRID_SIZE-1],all2=true;
        for(let i=0;i<GRID_SIZE;i++) if(grid[i][GRID_SIZE-1-i]!==f2) all2=false;
        if(all2){
            let points=FRUIT_POINTS[f2]*selectedBet/20;
            win+=points;
            lines.push({type:"diag2",coords:Array.from({length:GRID_SIZE},(_,i)=>[i,GRID_SIZE-1-i]),fruit:f2});
        }
        win = Number(win.toFixed(0));
        return {win,lines};
    }

    function restartGame(){
        if(!confirm("Сигурен ли си, че искаш да рестартираш играта? Целият прогрес ще бъде изгубен.")) return;
        stopWinEffect();
        if(winAnimFrameId) { cancelAnimationFrame(winAnimFrameId); winAnimFrameId=null; }
        if(loseAnimFrameId) { cancelAnimationFrame(loseAnimFrameId); loseAnimFrameId=null; }
        coins=500;lastWin=0;totalWin=0;grid=generateGrid();
        saveProgress(true);showLose(false);drawGrid();
        updatePaytable();
        safeMusicPause(); musicStarted=false; musicBtn.classList.add("on"); fxBtn.classList.add("on");
    }

    // --- AUTO-SPIN TOGGLE LOGIC ---
    function startSpinHold(e){
        if(spinHoldTimeout)clearTimeout(spinHoldTimeout);
        pointerIsDown=true;pointerDownTime=Date.now();
        spinTooltip.style.display="block";
        spinHoldTimeout=setTimeout(()=>{
            if(pointerIsDown&&!autoSpin){
                autoSpin=true;
                spinBtn.classList.add('auto');
                autoSpinIndicator.style.display="inline-block";
                doAutoSpin();
            }
        },1500);
    }
    function stopSpinHold(e){
        pointerIsDown=false;
        spinTooltip.style.display="none";
        if(spinHoldTimeout){clearTimeout(spinHoldTimeout);spinHoldTimeout=null;}
    }
    function doAutoSpin(){
        if (autoSpinTimer) clearTimeout(autoSpinTimer);
        if(!autoSpin || spinning) {spinBtn.classList.remove('auto');autoSpinIndicator.style.display="none";return;}
        if(coins<selectedBet){stopAutoSpin();return;}
        safePlay(audioSpin);
        spin(true);
        autoSpinTimer=setTimeout(doAutoSpin,1800+Math.random()*1000);
    }
    function stopAutoSpin(){
        autoSpin=false;
        spinBtn.classList.remove('auto');
        autoSpinIndicator.style.display="none";
        if(autoSpinTimer){clearTimeout(autoSpinTimer);autoSpinTimer=null;}
    }

    // --- Клавиши: Space=spin, 1–5=bet ---
    document.addEventListener('keydown', function(e){
        if(document.activeElement && /input|textarea|button/i.test(document.activeElement.tagName)) return;
        if(e.code==="Space" && coins>0 && !spinning){
            spin();
            e.preventDefault();
        }
        if(e.key>='1' && e.key<='5' && coins>0){
            let idx = Number(e.key)-1;
            if(VALID_BETS[idx] && !betBtns[idx].disabled) setBet(VALID_BETS[idx]);
        }
    });

    // ---- СПЕЦИАЛНО: СПИН БУТОН ЛОГИКА ----
    spinBtn.addEventListener('mousedown', startSpinHold);
    spinBtn.addEventListener('touchstart', startSpinHold);
    spinBtn.addEventListener('mouseenter',()=>{spinTooltip.style.display="block";});
    spinBtn.addEventListener('mouseleave',()=>{spinTooltip.style.display="none";});

    function spinBtnReleaseLogic(e) {
        stopSpinHold();
        let held = Date.now() - pointerDownTime;
        if (held < 1500 && !spinning) {
            if (autoSpin) {
                stopAutoSpin();
            } else {
                spin();
            }
        }
    }
    spinBtn.addEventListener('mouseup', spinBtnReleaseLogic);
    spinBtn.addEventListener('touchend', spinBtnReleaseLogic);

    spinBtn.addEventListener('click', function (e) {
        stopWinEffect();
        safePlay(audioBtn);
    });

    restartBtn.addEventListener('click',restartGame);

    betBtns.forEach(btn=>{
        btn.addEventListener('click',()=>{
            const val=Number(btn.innerText);
            setBet(val);
        });
    });

    if(document.getElementById('startBtn')){
        document.getElementById('startBtn').onclick=function(){
            startScreen.style.display='none';
            if (coins <= 0) restartGame();
            resizeCanvas();
            drawGrid();
            safeMusicPlay();
        };
    }

    window.addEventListener("beforeunload", function(e){
        saveProgress(true);
    });

    // --- ТОВА Е НАЙ-ВАЖНОТО: ГРИДЪТ СЕ ГЕНЕРИРА ПРИ СТАРТИРАНЕ! ---
    loadProgress();
    grid=generateGrid();
    setBet(selectedBet);
    resizeCanvas();
    drawGrid();
    updatePaytable();

})();
