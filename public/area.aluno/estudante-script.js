// --- LÓGICA DA PÁGINA DO ESTUDANTE (TRILHA E QUIZ) ---
document.addEventListener('DOMContentLoaded', () => {
    // --- SELETORES DE ELEMENTOS ---
    const studentDashboard = document.getElementById('studentDashboard');
    const lessonScreen = document.getElementById('lessonScreen');
    const quizWrapper = document.getElementById('quizWrapper');
    const resultsScreen = document.getElementById('resultsScreen');
    const bottomNav = document.querySelector('.navigation');
    
    const lessonTitle = document.getElementById('lessonTitle');
    const youtubePlayer = document.getElementById('youtubePlayer');
    const continueToHintButton = document.getElementById('continueToHintButton');

    const headerProfileButton = document.getElementById('headerProfileButton');
    const profileInitial = document.getElementById('profileInitial');
    const profileNameHeader = document.getElementById('profileNameHeader');
    const profileSubtext = document.getElementById('profileSubtext');
    const xpDisplay = document.getElementById('xpDisplay');
    const streakDisplay = document.getElementById('streakDisplay');
    const pointsDisplay = document.getElementById('pointsDisplay');
    const livesDisplay = document.getElementById('livesDisplay');
    const trilhaContainer = document.getElementById('trilhaContainer');
    const streakIcon = document.getElementById('streakIcon');
    
    const backToDashButtons = document.querySelectorAll('.back-to-dash-button');
    const quizLivesDisplay = document.getElementById('quizLivesDisplay');
    const progressBar = document.getElementById('progressBar');
    const characterBubble = document.getElementById('characterBubble');
    const characterImage = document.getElementById('characterImage');
    const gameOverPopup = document.getElementById('gameOverPopup');
    const closeGameOverPopup = document.getElementById('closeGameOverPopup');

    const hintPopup = document.getElementById('hintPopup');
    const closeHintPopup = document.getElementById('closeHintPopup');
    const hintGraphContainer = document.getElementById('hintGraphContainer');
    const hintPointsList = document.getElementById('hintPointsList');
    const hintText = document.getElementById('hintText');
    const startQuizButton = document.getElementById('startQuizButton');

    const interactiveQuestionContainer = document.getElementById('interactiveQuestionContainer');
    const stepHeader = document.getElementById('stepHeader');
    const stepInstruction = document.getElementById('stepInstruction');
    const stepTemplate = document.getElementById('stepTemplate');
    const stepExplanation = document.getElementById('stepExplanation');
    const nextStepButton = document.getElementById('nextStepButton');
    const blankOptionsPopup = document.getElementById('blankOptionsPopup');
    
    // --- ESTADO GLOBAL ---
    let userToken = JSON.parse(localStorage.getItem('studentToken'));
    let currentQuizData = {};
    let currentQuestionIndex = 0;
    let currentStepIndex = 0;
    let currentBlankIndex = 0;
    let quizLives = 0;
    let xpGanhosNaSessao = 0;
    let acertosNaSessao = 0;
    let optionsPopupTimer = null; // NOVO: Variável para controlar o timer do popup

    // --- FUNÇÕES DE NAVEGAÇÃO INTERNA ---
    function showScreen(screenToShow) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        screenToShow.classList.add('active');
        window.scrollTo(0, 0);
    }
    
    // --- GAMIFICAÇÃO E DASHBOARD ---
    function getGamificationData() { return { xp: parseInt(localStorage.getItem('studentXP') || '0'), streak: parseInt(localStorage.getItem('studentStreak') || '0'), points: parseInt(localStorage.getItem('studentPoints') || '0'), lives: parseInt(localStorage.getItem('studentLives') || '5'), completed: JSON.parse(localStorage.getItem('completedQuizzes') || '[]') }; }
    function updateGamificationData(data) { localStorage.setItem('studentXP', data.xp.toString()); localStorage.setItem('studentStreak', data.streak.toString()); localStorage.setItem('studentPoints', data.points.toString()); localStorage.setItem('studentLives', data.lives.toString()); localStorage.setItem('completedQuizzes', JSON.stringify(data.completed)); }
    
    function initializeDashboard() {
        if (!userToken) return;
        const gameData = getGamificationData();
        const nivel = Math.floor(gameData.xp / 100) + 1;

        profileNameHeader.textContent = `Olá, ${userToken.name.split(' ')[0]}!`;
        profileInitial.textContent = userToken.name.charAt(0).toUpperCase();
        profileSubtext.textContent = `Nível ${nivel}`;

        xpDisplay.textContent = gameData.xp;
        streakDisplay.textContent = gameData.streak;
        pointsDisplay.textContent = gameData.points;
        livesDisplay.textContent = gameData.lives;
        streakIcon.classList.toggle('inactive', gameData.streak === 0);

        renderTrilha();
        showScreen(studentDashboard);
        bottomNav.style.display = 'flex';
    }
    
    function renderTrilha() {
        trilhaContainer.innerHTML = '';
        const completedQuizzes = getGamificationData().completed;
        const quizOrder = Object.keys(quizzes);
        let nextQuizFound = false;

        quizOrder.forEach(quizId => {
            const quiz = quizzes[quizId];
            if (!quiz.title) return;
            let status = 'locked';
            let icon = 'bxs-lock';
            if (completedQuizzes.includes(quizId)) { status = 'completed'; icon = 'bxs-check-shield'; }
            else if (!nextQuizFound) { status = 'unlocked'; icon = 'bxs-joystick-button'; nextQuizFound = true; }
            
            const nodeHTML = `<div class="trilha-node"><div class="node-wrapper"><div class="node-icon ${status}" data-quiz-id="${quizId}" title="${quiz.title}"><i class='bx ${icon}'></i></div></div></div>`;
            trilhaContainer.innerHTML += nodeHTML;
        });

        document.querySelectorAll('.node-icon.unlocked, .node-icon.completed').forEach(icon => {
            icon.addEventListener('click', (e) => {
                const quizId = e.currentTarget.dataset.quizId;
                if (getGamificationData().lives > 0) {
                    prepareAndStartQuiz(quizId);
                } else {
                    alert("Você está sem vidas! Recupere-as para continuar.");
                }
            });
        });
    }

    // --- LÓGICA DO QUIZ (FLUXO ATUALIZADO) ---
    function prepareAndStartQuiz(quizId) {
        currentQuizData = quizzes[quizId];
        currentQuestionIndex = 0;
        
        if (currentQuizData.videoId) {
            startLesson();
        } else {
            showInteractiveHint();
        }
    }
    
    function startLesson() {
        lessonTitle.textContent = currentQuizData.title;
        youtubePlayer.src = `https://www.youtube.com/embed/${currentQuizData.videoId}`;
        showScreen(lessonScreen);
        bottomNav.style.display = 'none';
    }

    function showInteractiveHint() {
        const tipData = currentQuizData.tip;
        if (!tipData) {
            startQuizQuestions();
            return;
        }

        hintText.innerHTML = tipData.text;
        
        if (tipData.type === 'graph') {
            hintGraphContainer.parentElement.style.display = 'flex';
            // CORREÇÃO: Adiciona um pequeno delay para garantir que o popup esteja renderizado
            setTimeout(() => {
                renderGraphHint(tipData.data);
            }, 50);
        } else {
            hintGraphContainer.parentElement.style.display = 'none';
        }
        
        showScreen(studentDashboard);
        hintPopup.style.display = 'flex';
    }

    function startQuizQuestions() {
        hintPopup.style.display = 'none';
        quizLives = getGamificationData().lives;
        quizLivesDisplay.textContent = quizLives;
        currentStepIndex = 0;
        
        renderStep(currentStepIndex);
        showScreen(quizWrapper);
        bottomNav.style.display = 'none';
    }

    function renderStep(stepIndex) {
        const question = currentQuizData.questions[currentQuestionIndex];
        const step = question.steps[stepIndex];

        updateCharacter('neutral', step.header);
        stepHeader.textContent = step.header;
        stepInstruction.innerHTML = step.instruction;
        stepExplanation.style.display = 'none';
        nextStepButton.style.display = 'none';

        currentBlankIndex = 0;
        let templateHtml = step.template;
        if (step.template.includes('{blank}')) {
             let blankCounter = 0;
             templateHtml = step.template.replace(/\{blank\}/g, () => `<span class="blank" data-blank-index="${blankCounter++}">__</span>`);
        }
        stepTemplate.innerHTML = templateHtml;
        
        document.querySelectorAll('.blank').forEach(blank => {
            blank.addEventListener('click', handleBlankClick);
        });

        document.querySelector('.blank[data-blank-index="0"]')?.classList.add('active');
    }
    
    function handleBlankClick(event) {
        const blank = event.target;
        if (!blank.classList.contains('active') && !blank.classList.contains('incorrect')) return;

        // NOVO: Limpa qualquer timer anterior
        clearTimeout(optionsPopupTimer);

        const question = currentQuizData.questions[currentQuestionIndex];
        const step = question.steps[currentStepIndex];
        const blankIndex = parseInt(blank.dataset.blankIndex);
        const options = Array.isArray(step.blankOptions[0]) ? step.blankOptions[blankIndex] : step.blankOptions;

        blankOptionsPopup.innerHTML = '';
        options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'option-button';
            btn.textContent = opt;
            btn.onclick = () => checkBlankAnswer(blank, opt);
            blankOptionsPopup.appendChild(btn);
        });

        const rect = blank.getBoundingClientRect();
        blankOptionsPopup.style.left = `${rect.left + (rect.width / 2)}px`;
        blankOptionsPopup.style.top = `${rect.bottom + 10}px`;
        blankOptionsPopup.style.transform = 'translateX(-50%)';
        blankOptionsPopup.style.display = 'grid';

        // NOVO: Inicia um timer para fechar o popup após 10 segundos
        optionsPopupTimer = setTimeout(() => {
            blankOptionsPopup.style.display = 'none';
        }, 10000);
    }
    
    function checkBlankAnswer(blank, answer) {
        // NOVO: Esconde o popup e cancela o timer imediatamente
        blankOptionsPopup.style.display = 'none';
        clearTimeout(optionsPopupTimer);

        const question = currentQuizData.questions[currentQuestionIndex];
        const step = question.steps[currentStepIndex];
        const blankIndex = parseInt(blank.dataset.blankIndex);
        const correctAnswer = Array.isArray(step.correctAnswers) ? step.correctAnswers[blankIndex] : step.correctAnswer;
        
        if (answer === correctAnswer) {
            blank.textContent = answer;
            blank.classList.remove('active', 'incorrect');
            blank.classList.add('filled', 'correct');
            
            currentBlankIndex++;
            const nextBlank = document.querySelector(`.blank[data-blank-index="${currentBlankIndex}"]`);

            if (nextBlank) {
                nextBlank.classList.add('active');
            } else {
                stepExplanation.innerHTML = step.explanation;
                stepExplanation.style.display = 'block';
                nextStepButton.style.display = 'block';
            }
        } else {
            quizLives--;
            quizLivesDisplay.textContent = quizLives;
            updateCharacter('sad', 'Ops, não foi dessa vez. Tente de novo!');
            blank.classList.add('incorrect');
            setTimeout(() => blank.classList.remove('incorrect'), 500);

            if(quizLives <= 0) {
                setTimeout(showGameOver, 500);
            }
        }
    }
    
    function goToNextStep() {
        currentStepIndex++;
        const question = currentQuizData.questions[currentQuestionIndex];
        if (currentStepIndex < question.steps.length) {
            renderStep(currentStepIndex);
        } else {
            updateCharacter('happy', 'Você completou o desafio!');
            setTimeout(finishQuiz, 1000); 
        }
    }

    function finishQuiz() { const gameData = getGamificationData(); gameData.xp += 10; gameData.points += 5; gameData.lives = quizLives; gameData.streak += 1; if (!gameData.completed.includes(currentQuizData.id)) { gameData.completed.push(currentQuizData.id); } updateGamificationData(gameData); document.getElementById('resultsSummary').innerHTML = `<div class="summary-box summary-correct"><div class="count">+1</div><div class="label">Lição</div></div><div class="summary-box summary-xp"><div class="count">+10</div><div class="label">XP Ganhos</div></div>`; document.getElementById('motivationalMessage').textContent = `Parabéns, você completou a lição!`; showScreen(resultsScreen); }
    function showGameOver() { const gameData = getGamificationData(); gameData.lives = 0; updateGamificationData(gameData); gameOverPopup.style.display = 'flex'; }
    function updateCharacter(state, message) { characterBubble.textContent = message; if (state === 'happy') { characterImage.textContent = '😊'; characterImage.style.transform = 'scale(1.1) rotate(5deg)'; } else if (state === 'sad') { characterImage.textContent = '😢'; characterImage.style.transform = 'scale(0.9) rotate(-5deg)'; } else { characterImage.textContent = '🦉'; characterImage.style.transform = 'scale(1) rotate(0deg)'; } }
    
    function renderGraphHint(data) { const { points, range } = data; const container = hintGraphContainer; container.innerHTML = ''; const containerWidth = container.offsetWidth; const containerHeight = container.offsetHeight; const mapCoords = (x, y) => { const totalX = range.xMax - range.xMin; const totalY = range.yMax - range.yMin; const left = ((x - range.xMin) / totalX) * containerWidth; const top = ((range.yMax - y) / totalY) * containerHeight; return { left, top }; }; const origin = mapCoords(0, 0); const xAxis = document.createElement('div'); xAxis.className = 'axis x-axis'; xAxis.style.top = `${origin.top}px`; xAxis.innerHTML = '<div class="axis-arrow arrow-right"></div><div class="axis-label x-axis">x</div>'; container.appendChild(xAxis); const yAxis = document.createElement('div'); yAxis.className = 'axis y-axis'; yAxis.style.left = `${origin.left}px`; yAxis.innerHTML = '<div class="axis-arrow arrow-up"></div><div class="axis-label y-axis">y</div>'; container.appendChild(yAxis); for (let i = Math.ceil(range.xMin); i <= range.xMax; i++) { if (i === 0) continue; const pos = mapCoords(i, 0); const marker = document.createElement('div'); marker.className = 'axis-marker marker-x'; marker.style.left = `${pos.left - 1}px`; marker.style.top = `${pos.top - 5}px`; container.appendChild(marker); const label = document.createElement('div'); label.className = 'marker-label'; label.textContent = i; label.style.left = `${pos.left}px`; label.style.top = `${pos.top + 8}px`; label.style.transform = 'translateX(-50%)'; container.appendChild(label); } for (let i = Math.ceil(range.yMin); i <= range.yMax; i++) { if (i === 0) continue; const pos = mapCoords(0, i); const marker = document.createElement('div'); marker.className = 'axis-marker marker-y'; marker.style.left = `${pos.left - 5}px`; marker.style.top = `${pos.top - 1}px`; container.appendChild(marker); const label = document.createElement('div'); label.className = 'marker-label'; label.textContent = i; label.style.left = `${pos.left - 15}px`; label.style.top = `${pos.top}px`; label.style.transform = 'translateY(-50%)'; container.appendChild(label); } hintPointsList.innerHTML = '<div class="points-header">x&nbsp;&nbsp;&nbsp;y</div>' + points.map(p => `(${p.x}, ${p.y})`).join('<br>'); const createElements = (p, delay) => { setTimeout(() => { const pos = mapCoords(p.x, p.y); const pointEl = document.createElement('div'); pointEl.className = 'graph-point'; pointEl.style.left = `${pos.left}px`; pointEl.style.top = `${pos.top}px`; container.appendChild(pointEl); const vLine = document.createElement('div'); vLine.className = 'dashed-line vertical'; vLine.style.left = `${pos.left}px`; vLine.style.top = `${Math.min(pos.top, origin.top)}px`; vLine.style.height = `${Math.abs(pos.top - origin.top)}px`; container.appendChild(vLine); const hLine = document.createElement('div'); hLine.className = 'dashed-line horizontal'; hLine.style.top = `${pos.top}px`; hLine.style.left = `${Math.min(pos.left, origin.left)}px`; hLine.style.width = `${Math.abs(pos.left - origin.left)}px`; container.appendChild(hLine); setTimeout(() => { vLine.classList.add('visible'); hLine.classList.add('visible'); }, 50); }, delay); }; createElements(points[0], 500); createElements(points[1], 1200); setTimeout(() => { const pos1 = mapCoords(points[0].x, points[0].y); const pos2 = mapCoords(points[1].x, points[1].y); const length = Math.hypot(pos2.left - pos1.left, pos2.top - pos1.top); const angle = Math.atan2(pos2.top - pos1.top, pos2.left - pos1.left) * 180 / Math.PI; const lineEl = document.createElement('div'); lineEl.className = 'graph-line'; lineEl.style.width = `0px`; lineEl.style.transform = `rotate(${angle}deg)`; lineEl.style.left = `${pos1.left}px`; lineEl.style.top = `${pos1.top}px`; container.appendChild(lineEl); setTimeout(() => { lineEl.classList.add('visible'); lineEl.style.width = `${length}px`; }, 50); }, 2000); }

    // --- EVENT LISTENERS ---
    headerProfileButton.addEventListener('click', () => { window.location.href = 'perfil.html'; });
    continueToHintButton.addEventListener('click', showInteractiveHint);
    startQuizButton.addEventListener('click', startQuizQuestions);
    closeHintPopup.addEventListener('click', () => { hintPopup.style.display = 'none'; });
    nextStepButton.addEventListener('click', goToNextStep);
    backToDashButtons.forEach(btn => btn.addEventListener('click', () => initializeDashboard()));
    closeGameOverPopup.addEventListener('click', () => { gameOverPopup.style.display = 'none'; initializeDashboard(); });

    // --- INICIALIZAÇÃO DA PÁGINA ---
    initializeDashboard();
});