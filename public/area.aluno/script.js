// --- LÓGICA DE NAVEGAÇÃO E ESTADO GLOBAL ---
console.log("Script carregado. Aguardando eventos...");

const allScreens = document.querySelectorAll('.screen');
const studentDashboard = document.getElementById('studentDashboard');
const quizWrapper = document.getElementById('quizWrapper');
const disciplinasScreen = document.getElementById('disciplinasScreen');
const calendarScreen = document.getElementById('calendarScreen');
const loginScreen = document.getElementById('loginScreen');
const profileScreen = document.getElementById('profileScreen');
const homeButton = document.getElementById('homeButton');
const disciplinasButton = document.getElementById('disciplinasButton');
const backToDashButtons = document.querySelectorAll('.back-to-dash-button');
const navItems = document.querySelectorAll('.nav-item');
const loginForm = document.getElementById('loginForm');
const logoutButton = document.getElementById('logoutButton');
const studentBirthDateInput = document.getElementById('studentBirthDateInput');
const bottomNav = document.querySelector('.bottom-nav');

// --- NOVOS ELEMENTOS DO DOM ---
const headerProfileButton = document.getElementById('headerProfileButton');
const profileInitial = document.getElementById('profileInitial');
const profileNameHeader = document.getElementById('profileNameHeader');
const profileSubtext = document.getElementById('profileSubtext');
const xpDisplay = document.getElementById('xpDisplay');
const streakDisplay = document.getElementById('streakDisplay');
const pointsDisplay = document.getElementById('pointsDisplay');
const livesDisplay = document.getElementById('livesDisplay');
const trilhaContainer = document.getElementById('trilhaContainer');
const hamburgerButton = document.getElementById('hamburgerButton');
const menuPopup = document.getElementById('menuPopup');
const closeMenuPopup = document.getElementById('closeMenuPopup');
const menuCalendarButton = document.getElementById('menuCalendarButton');
const streakIcon = document.getElementById('streakIcon');
const rankingButton = document.getElementById('rankingButton');


let userToken = null;
let gradeUpdateInterval = null;

function showScreen(screenToShow) {
    console.log(`Navegando para a tela: ${screenToShow.id}`);
    allScreens.forEach(s => s.classList.remove('active'));
    screenToShow.classList.add('active');
    window.scrollTo(0, 0);
}

function updateNav(activeButton) {
    navItems.forEach(item => item.classList.remove('active'));
    if (activeButton) {
        console.log(`Atualizando navegação para: ${activeButton.id}`);
        activeButton.classList.add('active');
    }
}

// --- LÓGICA DO QUIZ ---
const quizContainer = document.getElementById('quizContainer');
const resultsContainer = document.getElementById('resultsContainer');
const prevButton = document.getElementById('prevButton');
const nextButton = document.getElementById('nextButton');
const progressBar = document.getElementById('progressBar');
const questionsWrapper = document.getElementById('questions-wrapper');
const validationMessage = document.getElementById('validation-message');

// --- Elementos do Pop-up de Dicas ---
const hintPopup = document.getElementById('hintPopup');
const closeHintPopup = document.getElementById('closeHintPopup');
const hintPopupTitle = document.getElementById('hintPopupTitle');
const hintPopupText = document.getElementById('hintPopupText');

const APPSCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyPWy8SHpOTsZAqFKoUTNOrgJkZKVVtYAMRXNDBQ3Nnalkr2k5c6CrUYtfmSuTQ5rbqhw/exec';

let currentQuizData = {};
let currentQuestionIndex = 0;
let userAnswers = [];

// FUNÇÃO STARTQUIZ SIMPLIFICADA
function startQuiz(quizId) {
    console.log(`Função startQuiz iniciada para o quiz: ${quizId}`);
    currentQuizData = quizzes[quizId];
    userAnswers = new Array(currentQuizData.questions.length).fill(null);
    currentQuestionIndex = 0;
    
    // Pula a confirmação e vai direto para as questões
    showScreen(quizWrapper);
    quizContainer.style.display = 'block';
    resultsContainer.style.display = 'none';
    
    document.getElementById('welcomeMessage').textContent = `Boa sorte, ${userToken.name}!`;
    showQuestion(0);
}

// --- INICIALIZAÇÃO E AUTENTICAÇÃO ---
window.addEventListener('load', () => {
    console.log("Página carregada. Verificando token de login...");
    const savedToken = localStorage.getItem('studentToken');
    if (savedToken) {
        console.log("Token encontrado. Inicializando dashboard.");
        userToken = JSON.parse(savedToken);
        loginScreen.classList.add('token-client-pg');
        initializeDashboard();
    } else {
        console.log("Nenhum token encontrado. Exibindo tela de login.");
        loginScreen.classList.remove('token-client-pg');
        showScreen(loginScreen);
    }
});

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    console.log("Formulário de login enviado.");
    const name = document.getElementById('studentNameInput').value;
    const birthDate = studentBirthDateInput.value;
    userToken = { name, birthDate };
    localStorage.setItem('studentToken', JSON.stringify(userToken));

    if (!localStorage.getItem('studentXP')) {
        console.log("Novo usuário detectado. Inicializando dados de gamificação.");
        localStorage.setItem('studentXP', '0');
        localStorage.setItem('studentStreak', '0');
        localStorage.setItem('studentPoints', '0');
        localStorage.setItem('studentLives', '5');
        localStorage.setItem('completedQuizzes', JSON.stringify([]));
    }

    loginScreen.classList.add('token-client-pg');
    initializeDashboard();
});

function getGamificationData() {
    return {
        xp: parseInt(localStorage.getItem('studentXP') || '0'),
        streak: parseInt(localStorage.getItem('studentStreak') || '0'),
        points: parseInt(localStorage.getItem('studentPoints') || '0'),
        lives: parseInt(localStorage.getItem('studentLives') || '5'),
        completed: JSON.parse(localStorage.getItem('completedQuizzes') || '[]')
    };
}

function initializeDashboard() {
    console.log("Inicializando o dashboard do aluno.");
    const gameData = getGamificationData();
    const nivel = Math.floor(gameData.xp / 100) + 1;

    profileNameHeader.textContent = `Olá, ${userToken.name.split(' ')[0]}!`;
    profileInitial.textContent = userToken.name.charAt(0).toUpperCase();
    profileSubtext.textContent = `Nível ${nivel}`;

    xpDisplay.textContent = gameData.xp;
    streakDisplay.textContent = gameData.streak;
    pointsDisplay.textContent = gameData.points;
    livesDisplay.textContent = gameData.lives;

    if (gameData.streak > 0) {
        streakIcon.classList.remove('inactive');
    } else {
        streakIcon.classList.add('inactive');
    }

    renderTrilha();

    bottomNav.style.display = 'flex';
    if (gradeUpdateInterval) clearInterval(gradeUpdateInterval);
    gradeUpdateInterval = setInterval(renderTrilha, 60000);
    showScreen(studentDashboard);
    updateNav(homeButton);
}

// FUNÇÃO RENDERTRILHA SIMPLIFICADA
function renderTrilha() {
    console.log("Renderizando a trilha de atividades...");
    trilhaContainer.innerHTML = '';
    const completedQuizzes = getGamificationData().completed;
    let nextQuizFound = false;

    Object.keys(quizzes).forEach(quizId => {
        const quiz = quizzes[quizId];
        let status = 'locked';
        let icon = 'bxs-lock';

        if (completedQuizzes.includes(quizId)) {
            status = 'completed';
            icon = 'bxs-check-shield';
        } else if (!nextQuizFound) {
            status = 'unlocked';
            icon = 'bxs-joystick-button';
            nextQuizFound = true;
        }

        const nodeHTML = `
            <div class="trilha-node">
                <div class="node-wrapper">
                    <div class="node-icon ${status}" data-quiz-id="${quizId}" title="${quiz.title}">
                        <i class='bx ${icon}'></i>
                    </div>
                </div>
            </div>
        `;
        trilhaContainer.innerHTML += nodeHTML;
    });

    document.querySelectorAll('.trilha-node .node-icon').forEach(icon => {
        if (!icon.classList.contains('node-locked')) {
            icon.addEventListener('click', (e) => {
                const quizId = e.currentTarget.dataset.quizId;
                console.log(`Ícone da trilha clicado! Iniciando quiz: ${quizId}`);
                startQuiz(quizId);
            });
        }
    });

    console.log("Renderização da trilha concluída.");
}


logoutButton.addEventListener('click', () => {
    console.log("Botão de logout clicado.");
    localStorage.clear();
    if (gradeUpdateInterval) clearInterval(gradeUpdateInterval);
    userToken = null;
    bottomNav.style.display = 'none';
    loginScreen.classList.remove('token-client-pg');
    showScreen(loginScreen);
});

studentBirthDateInput.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 2) value = `${value.slice(0, 2)}/${value.slice(2)}`;
    if (value.length > 5) value = `${value.slice(0, 5)}/${value.slice(5, 9)}`;
    e.target.value = value;
});

// Event Listeners de Navegação
disciplinasButton.addEventListener('click', () => { showScreen(disciplinasScreen); updateNav(disciplinasButton); });
homeButton.addEventListener('click', () => { showScreen(studentDashboard); updateNav(homeButton); });
backToDashButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        console.log("Botão 'Voltar ao Painel' clicado.");
        initializeDashboard();
        showScreen(studentDashboard);
    });
});
headerProfileButton.addEventListener('click', () => {
    console.log("Header do perfil clicado.");
    showProfile();
});

hamburgerButton.addEventListener('click', () => { console.log("Menu hamburger clicado."); menuPopup.style.display = 'flex'; });
closeMenuPopup.addEventListener('click', () => { menuPopup.style.display = 'none'; });
menuCalendarButton.addEventListener('click', () => {
    console.log("Botão 'Calendário' do menu clicado.");
    showScreen(calendarScreen);
    menuPopup.style.display = 'none';
});

// Listeners para funcionalidades sem tela (não fazem nada por enquanto)
document.getElementById('menuNotasButton').addEventListener('click', () => { console.log("Botão 'Notas' (sem ação) clicado."); menuPopup.style.display = 'none'; });
document.getElementById('menuProgressoButton').addEventListener('click', () => { console.log("Botão 'Progresso' (sem ação) clicado."); menuPopup.style.display = 'none'; });
document.getElementById('menuMaterialButton').addEventListener('click', () => { console.log("Botão 'Material' (sem ação) clicado."); menuPopup.style.display = 'none'; });
rankingButton.addEventListener('click', () => { console.log("Botão 'Ranking' (sem ação) clicado."); });


function showProfile() {
    console.log("Mostrando tela do perfil.");
    document.getElementById('profileName').textContent = userToken.name;
    document.getElementById('profileBirthDate').textContent = userToken.birthDate;
    showScreen(profileScreen);
    updateNav(null);
}

// --- LÓGICA COMPLETA DO QUIZ ---
function goToNextQuestion() {
    saveCurrentAnswer();
    if (currentQuestionIndex < currentQuizData.questions.length - 1) {
        currentQuestionIndex++; showQuestion(currentQuestionIndex);
    } else {
        console.log("Quiz finalizado. Calculando resultados...");
        calculateAndShowResults();
    }
}

nextButton.addEventListener('click', () => {
    const selectedOption = document.querySelector(`input[name="q${currentQuestionIndex}"]:checked`);
    if (!selectedOption) {
        validationMessage.style.display = 'block';
        setTimeout(() => { validationMessage.style.display = 'none'; }, 2500);
        return;
    }
    console.log("Botão 'Próxima' clicado.");
    goToNextQuestion();
});

prevButton.addEventListener('click', () => {
    console.log("Botão 'Voltar' clicado.");
    saveCurrentAnswer();
    if (currentQuestionIndex > 0) { currentQuestionIndex--; showQuestion(currentQuestionIndex); }
});

function renderQuestions() {
    let html = '';
    currentQuizData.questions.forEach((q, index) => {
        html += `<div class="question-block" id="q${index}">`;
        html += `<p class="question-text"><b>Questão ${index + 1}:</b> ${q.question}</p>`;
        for (const key in q.options) {
            const isChecked = userAnswers[index] === key ? 'checked' : '';
            html += `<label><input type="radio" name="q${index}" value="${key}"> <span>${q.options[key]}</span></label>`;
        }
        if (q.tip) {
            html += `<button type="button" class="hint-button" data-question-index="${index}">Precisa de uma Dica?</button>`;
        }
        html += `</div>`;
    });
    questionsWrapper.innerHTML = html;

    document.querySelectorAll('.hint-button').forEach(button => {
        button.addEventListener('click', (e) => {
            const index = e.target.dataset.questionIndex;
            showHint(index);
        });
    });
}

function showQuestion(index) {
    console.log(`Mostrando questão ${index + 1}`);
    renderQuestions();
    document.querySelectorAll('.question-block').forEach(q => q.classList.remove('active'));
    document.getElementById(`q${index}`).classList.add('active');
    progressBar.style.width = `${((index + 1) / currentQuizData.questions.length) * 100}%`;
    prevButton.style.display = index === 0 ? 'none' : 'inline-block';
    nextButton.textContent = (index === currentQuizData.questions.length - 1) ? "Finalizar e Ver Resultado" : "Próxima";
}

function showHint(index) {
    console.log(`Mostrando dica para a questão ${index + 1}`);
    const question = currentQuizData.questions[index];
    hintPopupText.innerHTML = question.tip;
    hintPopupTitle.textContent = `Dica da Questão ${parseInt(index) + 1}`;
    hintPopup.style.display = 'flex';
}

closeHintPopup.addEventListener('click', () => {
    hintPopup.style.display = 'none';
});

function saveCurrentAnswer() {
    const selectedOption = document.querySelector(`input[name="q${currentQuestionIndex}"]:checked`);
    if (selectedOption) {
        userAnswers[currentQuestionIndex] = selectedOption.value;
    }
}

function calculateAndShowResults() {
    let correct = 0,
        incorrect = 0,
        unanswered = 0;
    const totalQuestions = currentQuizData.questions.length;
    let xpGanhos = 0;
    let pontosGanhos = 0;

    userAnswers.forEach((answer, index) => {
        const question = currentQuizData.questions[index];
        if (answer === question.answer) {
            correct++;
            xpGanhos += 10;
            pontosGanhos += 5;
        } else if (answer === null) {
            unanswered++;
        } else {
            incorrect++;
        }
    });

    const gameData = getGamificationData();
    gameData.xp += xpGanhos;
    gameData.points += pontosGanhos;
    gameData.streak += 1;

    if (!gameData.completed.includes(currentQuizData.id)) {
        gameData.completed.push(currentQuizData.id);
    }

    localStorage.setItem('studentXP', gameData.xp);
    localStorage.setItem('studentPoints', gameData.points);
    localStorage.setItem('studentStreak', gameData.streak);
    localStorage.setItem('completedQuizzes', JSON.stringify(gameData.completed));

    quizContainer.style.display = 'none';
    resultsContainer.style.display = 'block';

    document.getElementById('resultsSummary').innerHTML = `
        <div class="summary-box summary-correct"><div class="count">${correct}</div><div class="label">Acertos</div></div>
        <div class="summary-box summary-incorrect"><div class="count">${incorrect}</div><div class="label">Erros</div></div>
        <div class="summary-box summary-unanswered"><div class="count">${unanswered}</div><div class="label">Não Resp.</div></div>
    `;

    let message = '';
    const percentage = (correct / totalQuestions) * 100;

    if (percentage === 100) message = `<span class="highlight">Gabaritou! Parabéns, ${userToken.name}!</span>`;
    else if (percentage >= 70) message = `Parabéns, ${userToken.name}! Você mandou muito bem!`;
    else if (percentage >= 50) message = `Bom trabalho, ${userToken.name}! Continue praticando.`;
    else message = `Não desanime, ${userToken.name}! A prática leva à perfeição.`;

    message += `<br><strong>Você ganhou +${xpGanhos} XP e +${pontosGanhos} Pontos!</strong>`;
    document.getElementById('motivationalMessage').innerHTML = message;

    const gabaritoDiv = document.getElementById('gabarito');
    gabaritoDiv.innerHTML = '';
    userAnswers.forEach((answer, index) => {
        const question = currentQuizData.questions[index];
        const resultItem = document.createElement('div');
        resultItem.classList.add('gabarito-item');
        let statusClass = 'unanswered';
        let statusText = 'Não Respondida';

        if (answer === question.answer) { statusClass = 'correct'; statusText = 'Correta'; }
        else if (answer === null) { statusClass = 'unanswered'; statusText = 'Não soube responder'; }
        else { statusClass = 'incorrect'; statusText = 'Incorreta'; }
        resultItem.innerHTML = `<strong>Questão ${index + 1}:</strong> ${statusText}`;

        resultItem.classList.add(statusClass);
        gabaritoDiv.appendChild(resultItem);
    });

    sendDataToSheet(correct, finalWeightedScore);
}

function sendDataToSheet(finalScore, finalWeightedScore) {
    const submissionData = new FormData();
    submissionData.append('nomeAluno', userToken.name);
    submissionData.append('dataNascimento', userToken.birthDate);
    submissionData.append('acertos', finalScore);
    submissionData.append('pontuacao', finalWeightedScore);
    submissionData.append('simuladoTitulo', currentQuizData.title);
    submissionData.append('totalQuestoes', currentQuizData.questions.length);
    userAnswers.forEach((answer, index) => {
        submissionData.append(`q${index + 1}`, answer || "Nao Respondida");
    });
    fetch(APPSCRIPT_URL, { method: 'POST', body: submissionData })
        .then(response => {
            if (response.ok) console.log('Dados enviados com sucesso.');
            else return response.text().then(text => { throw new Error(text) });
        })
        .catch(error => console.error('Erro ao enviar os dados:', error));
}

shareButton.addEventListener('click', () => { resultsContainer.style.display = 'none'; shareContainerWrapper.style.display = 'block'; });
backToResultsButton.addEventListener('click', () => { shareContainerWrapper.style.display = 'none'; resultsContainer.style.display = 'block'; });
downloadButton.addEventListener('click', () => {
    html2canvas(document.getElementById('shareContainer')).then(canvas => {
        const link = document.createElement('a');
        link.download = `resultado-${userToken.name.replace(/\s+/g, '-').toLowerCase()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    });
});
