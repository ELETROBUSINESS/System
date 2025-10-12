// --- LÓGICA DE NAVEGAÇÃO E ESTADO GLOBAL ---
document.addEventListener('DOMContentLoaded', () => {
    // --- SELETORES DE ELEMENTOS ---
    const allScreens = document.querySelectorAll('.screen');
    const studentDashboard = document.getElementById('studentDashboard');
    const quizWrapper = document.getElementById('quizWrapper');
    const disciplinasScreen = document.getElementById('disciplinasScreen');
    const calendarScreen = document.getElementById('calendarScreen');
    const loginScreen = document.getElementById('loginScreen');
    const profileScreen = document.getElementById('profileScreen');
    const resultsScreen = document.getElementById('resultsScreen');
    const bottomNav = document.querySelector('.bottom-nav');
    const homeButton = document.getElementById('homeButton');
    const disciplinasButton = document.getElementById('disciplinasButton');
    const backToDashButtons = document.querySelectorAll('.back-to-dash-button');
    const navItems = document.querySelectorAll('.nav-item');
    const hamburgerButton = document.getElementById('hamburgerButton');
    const loginForm = document.getElementById('loginForm');
    const logoutButton = document.getElementById('logoutButton');
    const studentBirthDateInput = document.getElementById('studentBirthDateInput');
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
    const quizLivesDisplay = document.getElementById('quizLivesDisplay');
    const progressBar = document.getElementById('progressBar');
    const characterBubble = document.getElementById('characterBubble');
    const characterImage = document.getElementById('characterImage');
    const questionTitle = document.getElementById('questionTitle');
    const optionsWrapper = document.getElementById('optionsWrapper');
    const nextButton = document.getElementById('nextButton');
    const menuPopup = document.getElementById('menuPopup');
    const closeMenuPopup = document.getElementById('closeMenuPopup');
    const menuCalendarButton = document.getElementById('menuCalendarButton');
    const gameOverPopup = document.getElementById('gameOverPopup');
    const closeGameOverPopup = document.getElementById('closeGameOverPopup');

    // --- SELETORES PARA O SISTEMA DE DICAS ---
    const hintButton = document.getElementById('hintButton');
    const hintPopup = document.getElementById('hintPopup');
    const closeHintPopup = document.getElementById('closeHintPopup');
    const hintGraphContainer = document.getElementById('hintGraphContainer');
    const hintPointsList = document.getElementById('hintPointsList');
    const hintText = document.getElementById('hintText');
    const showExampleButton = document.getElementById('showExampleButton');
    const hintExampleContainer = document.getElementById('hintExampleContainer');

    // --- ESTADO GLOBAL ---
    let userToken = null;
    let currentQuizData = {};
    let currentQuestionIndex = 0;
    let quizLives = 0;
    let xpGanhosNaSessao = 0;
    let acertosNaSessao = 0;
    let quizState = 'answering';

    // --- FUNÇÕES DE NAVEGAÇÃO E INICIALIZAÇÃO ---
    function showScreen(screenToShow) { allScreens.forEach(s => s.classList.remove('active')); screenToShow.classList.add('active'); window.scrollTo(0, 0); }
    function updateNav(activeButton) { navItems.forEach(item => item.classList.remove('active')); if (activeButton) activeButton.classList.add('active'); }
    window.addEventListener('load', () => { const savedToken = localStorage.getItem('studentToken'); if (savedToken) { userToken = JSON.parse(savedToken); loginScreen.classList.add('token-client-pg'); initializeDashboard(); } else { loginScreen.classList.remove('token-client-pg'); showScreen(loginScreen); bottomNav.style.display = 'none'; } });
    loginForm.addEventListener('submit', (e) => { e.preventDefault(); const name = document.getElementById('studentNameInput').value; const birthDate = studentBirthDateInput.value; userToken = { name, birthDate }; localStorage.setItem('studentToken', JSON.stringify(userToken)); if (!localStorage.getItem('studentXP')) { localStorage.setItem('studentXP', '0'); localStorage.setItem('studentStreak', '0'); localStorage.setItem('studentPoints', '0'); localStorage.setItem('studentLives', '5'); localStorage.setItem('completedQuizzes', JSON.stringify([])); } loginScreen.classList.add('token-client-pg'); initializeDashboard(); });
    
    // --- GAMIFICAÇÃO E DASHBOARD ---
    function getGamificationData() { return { xp: parseInt(localStorage.getItem('studentXP') || '0'), streak: parseInt(localStorage.getItem('studentStreak') || '0'), points: parseInt(localStorage.getItem('studentPoints') || '0'), lives: parseInt(localStorage.getItem('studentLives') || '5'), completed: JSON.parse(localStorage.getItem('completedQuizzes') || '[]') }; }
    function updateGamificationData(data) { localStorage.setItem('studentXP', data.xp.toString()); localStorage.setItem('studentStreak', data.streak.toString()); localStorage.setItem('studentPoints', data.points.toString()); localStorage.setItem('studentLives', data.lives.toString()); localStorage.setItem('completedQuizzes', JSON.stringify(data.completed)); }
    function initializeDashboard() { const gameData = getGamificationData(); const nivel = Math.floor(gameData.xp / 100) + 1; profileNameHeader.textContent = `Olá, ${userToken.name.split(' ')[0]}!`; profileInitial.textContent = userToken.name.charAt(0).toUpperCase(); profileSubtext.textContent = `Nível ${nivel}`; xpDisplay.textContent = gameData.xp; streakDisplay.textContent = gameData.streak; pointsDisplay.textContent = gameData.points; livesDisplay.textContent = gameData.lives; streakIcon.classList.toggle('inactive', gameData.streak === 0); renderTrilha(); bottomNav.style.display = 'flex'; showScreen(studentDashboard); updateNav(homeButton); }
    function renderTrilha() { trilhaContainer.innerHTML = ''; const completedQuizzes = getGamificationData().completed; const quizOrder = Object.keys(quizzes); let nextQuizFound = false; quizOrder.forEach(quizId => { const quiz = quizzes[quizId]; if (!quiz.title) return; let status = 'locked'; let icon = 'bxs-lock'; if (completedQuizzes.includes(quizId)) { status = 'completed'; icon = 'bxs-check-shield'; } else if (!nextQuizFound) { status = 'unlocked'; icon = 'bxs-joystick-button'; nextQuizFound = true; } const nodeHTML = `<div class="trilha-node"><div class="node-wrapper"><div class="node-icon ${status}" data-quiz-id="${quizId}" title="${quiz.title}"><i class='bx ${icon}'></i></div></div></div>`; trilhaContainer.innerHTML += nodeHTML; }); document.querySelectorAll('.node-icon.unlocked, .node-icon.completed').forEach(icon => { icon.addEventListener('click', (e) => { const quizId = e.currentTarget.dataset.quizId; if (getGamificationData().lives > 0) { startQuiz(quizId); } else { alert("Você está sem vidas! Recupere-as para continuar."); } }); }); }

    // --- LÓGICA DO QUIZ ---
    function startQuiz(quizId) { currentQuizData = quizzes[quizId]; currentQuestionIndex = 0; quizLives = getGamificationData().lives; xpGanhosNaSessao = 0; acertosNaSessao = 0; quizLivesDisplay.textContent = quizLives; showQuestion(currentQuestionIndex); showScreen(quizWrapper); updateNav(null); }
    function showQuestion(index) { quizState = 'answering'; const question = currentQuizData.questions[index]; updateCharacter('neutral', 'Vamos lá! Qual é a resposta correta?'); progressBar.style.width = `${((index) / currentQuizData.questions.length) * 100}%`; questionTitle.textContent = question.question; hintButton.style.display = question.tip ? 'flex' : 'none'; optionsWrapper.innerHTML = ''; Object.keys(question.options).forEach(key => { const optionHTML = `<label for="q${index}_${key}"><input type="radio" name="q${index}" id="q${index}_${key}" value="${key}"><span>${question.options[key]}</span></label>`; optionsWrapper.innerHTML += optionHTML; }); document.querySelectorAll('input[name^="q"]').forEach(radio => { radio.addEventListener('change', () => { document.querySelectorAll('label').forEach(l => l.classList.remove('selected')); radio.closest('label').classList.add('selected'); nextButton.disabled = false; }); }); nextButton.textContent = 'Confirmar resposta'; nextButton.className = ''; nextButton.disabled = true; }
    function checkAnswer() { quizState = 'feedback'; const selectedRadio = optionsWrapper.querySelector('input:checked'); if (!selectedRadio) { quizState = 'answering'; return; } const userAnswer = selectedRadio.value; const currentQuestion = currentQuizData.questions[currentQuestionIndex]; const correctAnswer = currentQuestion.answer; const allLabels = optionsWrapper.querySelectorAll('label'); allLabels.forEach(label => label.classList.add('disabled')); const selectedLabel = selectedRadio.closest('label'); const correctLabel = optionsWrapper.querySelector(`input[value="${correctAnswer}"]`).closest('label'); if (userAnswer === correctAnswer) { acertosNaSessao++; xpGanhosNaSessao += 10; updateCharacter('happy', 'Isso mesmo! Você acertou em cheio!'); selectedLabel.classList.add('correct'); nextButton.className = 'correct-btn'; } else { quizLives--; quizLivesDisplay.textContent = quizLives; updateCharacter('sad', `A resposta correta era: ${currentQuestion.options[correctAnswer]}`); selectedLabel.classList.add('incorrect'); correctLabel.classList.add('correct'); nextButton.className = 'incorrect-btn'; if (quizLives <= 0) { setTimeout(showGameOver, 1500); return; } } nextButton.textContent = 'Continuar'; nextButton.disabled = false; }
    function goToNextQuestion() { if (currentQuestionIndex < currentQuizData.questions.length - 1) { currentQuestionIndex++; showQuestion(currentQuestionIndex); } else { finishQuiz(); } }
    function finishQuiz() { const gameData = getGamificationData(); gameData.xp += xpGanhosNaSessao; gameData.points += (acertosNaSessao * 5); gameData.lives = quizLives; gameData.streak += 1; if (!gameData.completed.includes(currentQuizData.id)) { gameData.completed.push(currentQuizData.id); } updateGamificationData(gameData); document.getElementById('resultsSummary').innerHTML = `<div class="summary-box summary-correct"><div class="count">${acertosNaSessao}</div><div class="label">Acertos</div></div><div class="summary-box summary-xp"><div class="count">+${xpGanhosNaSessao}</div><div class="label">XP Ganhos</div></div>`; document.getElementById('motivationalMessage').textContent = `Parabéns, você completou a lição!`; showScreen(resultsScreen); }
    function showGameOver() { const gameData = getGamificationData(); gameData.lives = 0; updateGamificationData(gameData); gameOverPopup.style.display = 'flex'; }
    function updateCharacter(state, message) { characterBubble.textContent = message; if (state === 'happy') { characterImage.textContent = '😊'; characterImage.style.transform = 'scale(1.1) rotate(5deg)'; } else if (state === 'sad') { characterImage.textContent = '😢'; characterImage.style.transform = 'scale(0.9) rotate(-5deg)'; } else { characterImage.textContent = '🦉'; characterImage.style.transform = 'scale(1) rotate(0deg)'; } }
    
    // --- LÓGICA DO SISTEMA DE DICAS (REMODELADO) ---
    function renderGraphHint(data) {
        const { points, range } = data;
        const container = hintGraphContainer;
        container.innerHTML = ''; // Limpa o conteúdo anterior
        const containerWidth = container.offsetWidth;
        const containerHeight = container.offsetHeight;

        const mapCoords = (x, y) => {
            const totalX = range.xMax - range.xMin;
            const totalY = range.yMax - range.yMin;
            const left = ((x - range.xMin) / totalX) * containerWidth;
            const top = ((range.yMax - y) / totalY) * containerHeight;
            return { left, top };
        };

        const origin = mapCoords(0, 0);

        // Renderiza eixos e rótulos
        const xAxis = document.createElement('div');
        xAxis.className = 'axis x-axis';
        xAxis.style.top = `${origin.top}px`;
        xAxis.innerHTML = '<div class="axis-arrow arrow-right"></div><div class="axis-label x-axis">x</div>';
        container.appendChild(xAxis);

        const yAxis = document.createElement('div');
        yAxis.className = 'axis y-axis';
        yAxis.style.left = `${origin.left}px`;
        yAxis.innerHTML = '<div class="axis-arrow arrow-up"></div><div class="axis-label y-axis">y</div>';
        container.appendChild(yAxis);

        // Renderiza marcadores e números nos eixos
        for (let i = Math.ceil(range.xMin); i <= range.xMax; i++) {
            if (i === 0) continue;
            const pos = mapCoords(i, 0);
            const marker = document.createElement('div');
            marker.className = 'axis-marker marker-x';
            marker.style.left = `${pos.left - 1}px`;
            marker.style.top = `${pos.top - 5}px`;
            container.appendChild(marker);

            const label = document.createElement('div');
            label.className = 'marker-label';
            label.textContent = i;
            label.style.left = `${pos.left}px`;
            label.style.top = `${pos.top + 8}px`;
            label.style.transform = 'translateX(-50%)';
            container.appendChild(label);
        }

        for (let i = Math.ceil(range.yMin); i <= range.yMax; i++) {
            if (i === 0) continue;
            const pos = mapCoords(0, i);
            const marker = document.createElement('div');
            marker.className = 'axis-marker marker-y';
            marker.style.left = `${pos.left - 5}px`;
            marker.style.top = `${pos.top - 1}px`;
            container.appendChild(marker);

            const label = document.createElement('div');
            label.className = 'marker-label';
            label.textContent = i;
            label.style.left = `${pos.left - 15}px`;
            label.style.top = `${pos.top}px`;
            label.style.transform = 'translateY(-50%)';
            container.appendChild(label);
        }

        hintPointsList.innerHTML = '<div class="points-header">x&nbsp;&nbsp;&nbsp;y</div>' + points.map(p => `(${p.x}, ${p.y})`).join('<br>');

        const createElements = (p, delay) => {
            setTimeout(() => {
                const pos = mapCoords(p.x, p.y);
                const pointEl = document.createElement('div');
                pointEl.className = 'graph-point';
                pointEl.style.left = `${pos.left}px`;
                pointEl.style.top = `${pos.top}px`;
                container.appendChild(pointEl);
                
                const vLine = document.createElement('div');
                vLine.className = 'dashed-line vertical';
                vLine.style.left = `${pos.left}px`;
                vLine.style.top = `${Math.min(pos.top, origin.top)}px`;
                vLine.style.height = `${Math.abs(pos.top - origin.top)}px`;
                container.appendChild(vLine);

                const hLine = document.createElement('div');
hLine.className = 'dashed-line horizontal';
hLine.style.top = `${pos.top}px`; // Corrigido de 'bottom' para 'top'
hLine.style.left = `${Math.min(pos.left, origin.left)}px`;
hLine.style.width = `${Math.abs(pos.left - origin.left)}px`;
container.appendChild(hLine);
                
                setTimeout(() => { vLine.classList.add('visible'); hLine.classList.add('visible'); }, 50);
            }, delay);
        };
        createElements(points[0], 500);
        createElements(points[1], 1200);

        setTimeout(() => {
            const pos1 = mapCoords(points[0].x, points[0].y);
            const pos2 = mapCoords(points[1].x, points[1].y);
            const length = Math.hypot(pos2.left - pos1.left, pos2.top - pos1.top);
            const angle = Math.atan2(pos2.top - pos1.top, pos2.left - pos1.left) * 180 / Math.PI;
            const lineEl = document.createElement('div');
            lineEl.className = 'graph-line';
            lineEl.style.width = `0px`; // Inicia com 0 para animar
            lineEl.style.transform = `rotate(${angle}deg)`;
            lineEl.style.left = `${pos1.left}px`;
            lineEl.style.top = `${pos1.top}px`;
            container.appendChild(lineEl);
            setTimeout(() => {
                lineEl.classList.add('visible');
                lineEl.style.width = `${length}px`; // Define o tamanho final para a animação
            }, 50);
        }, 2000);
    }


    // --- EVENT LISTENERS ---
    hintButton.addEventListener('click', () => {
        const question = currentQuizData.questions[currentQuestionIndex];
        hintText.innerHTML = question.tip;
        hintExampleContainer.style.display = 'none';
        showExampleButton.style.display = question.example ? 'block' : 'none';
        
        if (question.tipType === 'graph') {
            hintGraphContainer.parentElement.style.display = 'flex';
            renderGraphHint(question.tipData);
        } else {
            hintGraphContainer.parentElement.style.display = 'none';
        }
        hintPopup.style.display = 'flex';
    });

    showExampleButton.addEventListener('click', () => {
        const example = currentQuizData.questions[currentQuestionIndex].example;
        hintText.innerHTML = example.text;
        showExampleButton.style.display = 'none';

        if (example.tipType === 'graph') {
            renderGraphHint(example.tipData);
        }
    });

    closeHintPopup.addEventListener('click', () => { hintPopup.style.display = 'none'; });
    nextButton.addEventListener('click', () => { if (quizState === 'answering') { checkAnswer(); } else { goToNextQuestion(); } });
    backToDashButtons.forEach(btn => btn.addEventListener('click', initializeDashboard));
    disciplinasButton.addEventListener('click', () => { showScreen(disciplinasScreen); updateNav(disciplinasButton); });
    homeButton.addEventListener('click', () => { showScreen(studentDashboard); updateNav(homeButton); });
    headerProfileButton.addEventListener('click', () => { const profileName = document.getElementById('profileName'); const profileBirthDate = document.getElementById('profileBirthDate'); profileName.textContent = userToken.name; profileBirthDate.textContent = userToken.birthDate; showScreen(profileScreen); updateNav(null); });
    hamburgerButton.addEventListener('click', () => { menuPopup.style.display = 'flex'; });
    closeMenuPopup.addEventListener('click', () => { menuPopup.style.display = 'none'; });
    closeGameOverPopup.addEventListener('click', () => { gameOverPopup.style.display = 'none'; initializeDashboard(); });
    menuCalendarButton.addEventListener('click', () => { showScreen(calendarScreen); menuPopup.style.display = 'none'; });
    logoutButton.addEventListener('click', () => { localStorage.clear(); userToken = null; bottomNav.style.display = 'none'; loginScreen.classList.remove('token-client-pg'); showScreen(loginScreen); });
    studentBirthDateInput.addEventListener('input', (e) => { let value = e.target.value.replace(/\D/g, ''); if (value.length > 2) value = `${value.slice(0, 2)}/${value.slice(2)}`; if (value.length > 5) value = `${value.slice(0, 5)}/${value.slice(5, 9)}`; e.target.value = value; });
});