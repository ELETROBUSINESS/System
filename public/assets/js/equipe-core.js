
// Mock Data for Users
const teamUsers = {
    'nathan': {
        name: 'Nathan',
        role: 'Videomaker & Editor',
        balance: 1250.00,
        receivable: 450.00,
        tasks: [
            { title: 'Edição Vlog #42', due: 'Hoje', type: 'edit' },
            { title: 'Gravação Drone', due: 'Amanhã', type: 'rec' }
        ]
    },
    'eduardo': {
        name: 'Eduardo',
        role: 'Diretor de Fotografia',
        balance: 1800.00,
        receivable: 900.00,
        tasks: [
            { title: 'Roteiro Comercial', due: 'Hoje', type: 'writer' },
            { title: 'Color Grading Institucional', due: '23/01', type: 'edit' }
        ]
    }
};

let currentUser = 'nathan'; // Default

function initEquipeDashboard() {
    console.log("Equipe Dashboard Init");

    // Select Elements
    const selector = document.getElementById('user-switcher');

    if (selector) {
        selector.addEventListener('change', (e) => {
            currentUser = e.target.value;
            updateDashboard(currentUser);
            localStorage.setItem('team_current_user', currentUser);
        });

        // Load saved user
        const saved = localStorage.getItem('team_current_user');
        if (saved && teamUsers[saved]) {
            selector.value = saved;
            currentUser = saved;
        }

        updateDashboard(currentUser);
    }

    // Animate marker
    updateNavMarker();
}

function updateDashboard(userKey) {
    const user = teamUsers[userKey];
    if (!user) return;

    // Update Financials
    document.getElementById('valor1').textContent = formatCurrency(user.balance);
    document.getElementById('valor2').textContent = formatCurrency(user.receivable);
    document.getElementById('user-role-display').textContent = user.role;

    // Update Greeting (Optionally, but the select already shows it)

    // Update Tasks List (Mock)
    const list = document.getElementById('tasks-list');
    if (list) {
        list.innerHTML = '';
        user.tasks.forEach(task => {
            const color = task.type === 'rec' ? 'red' : (task.type === 'edit' ? 'blue' : 'purple');

            const html = `
            <div class="project-card flex items-center justify-between border-l-4 border-${color}-500 rounded-lg p-3 bg-white shadow-sm">
                <div>
                    <h4 class="text-sm font-bold text-gray-800">${task.title}</h4>
                    <p class="text-[10px] text-gray-400">Responsável: ${user.name}</p>
                </div>
                <span class="text-xs font-bold text-${color}-500 bg-${color}-50 px-2 py-1 rounded">${task.due}</span>
            </div>
            `;
            list.insertAdjacentHTML('beforeend', html);
        });
    }
}

function formatCurrency(val) {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Navigation Logic
function navigateTo(url) {
    if (url.startsWith('#')) return;
    window.location.href = url;
}


function toggleSidebar() {
    // Mock sidebar toggle
    alert("Menu lateral");
}

function updateNavMarker() {
    // Reuse logic from script26.js simplified
    const activeItem = document.querySelector('.nav-item.active');
    const marker = document.getElementById('nav-marker');

    if (activeItem && marker) {
        // Adjust for mobile logic if needed
        // For now just basic placeholder
        marker.style.opacity = '1';
    }
}
