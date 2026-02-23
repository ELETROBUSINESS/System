const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'public', 'pdv', 'fiscal', 'index.html');
let content = fs.readFileSync(filePath, 'utf8');

const newCSS = `<style>
    :root {
        --bg-body: #f8fafc;
        --bg-card: #ffffff;
        --text-main: #0f172a;
        --text-muted: #64748b;
        --border-color: #e2e8f0;
        --btn-dark: #0f172a;
        --btn-dark-hover: #1e293b;
        --btn-outline: #ffffff;
        --btn-outline-border: #cbd5e1;
        --btn-outline-hover: #f1f5f9;
        --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
        --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        --warning-red: #ef4444;
        --font-family: 'Inter', system-ui, -apple-system, sans-serif;
    }

    body {
        background-color: var(--bg-body);
        font-family: var(--font-family);
        margin: 0;
        padding: 0;
        color: var(--text-main);
        -webkit-font-smoothing: antialiased;
    }

    /* Fiscal Container */
    .fiscal-container {
        max-width: 1100px;
        margin: 40px auto;
        background: var(--bg-card);
        padding: 40px 48px;
        border-radius: 16px;
        box-shadow: var(--shadow-md);
        border: 1px solid var(--border-color);
        transition: filter 0.3s ease;
    }

    /* Header */
    .header-fiscal {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-bottom: 24px;
        border-bottom: 1px solid var(--border-color);
        margin-bottom: 32px;
    }

    .company-info h1 {
        font-size: 1.5rem;
        color: var(--text-main);
        margin: 0;
        font-weight: 600;
        letter-spacing: -0.02em;
    }

    .company-info h2 {
        font-size: 0.95rem;
        color: var(--text-muted);
        margin: 6px 0 0;
        font-weight: 400;
    }

    .fiscal-info {
        text-align: right;
        background: #f8fafc;
        padding: 14px 20px;
        border-radius: 10px;
        border: 1px solid #f1f5f9;
    }

    .fiscal-info h3 {
        font-size: 1.1rem;
        color: var(--text-main);
        margin: 0;
        font-weight: 600;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        letter-spacing: -0.5px;
    }

    .fiscal-info p {
        font-size: 0.85rem;
        color: var(--text-muted);
        margin: 6px 0 0;
    }

    /* Controls */
    .controls-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 24px;
        gap: 16px;
        flex-wrap: wrap;
    }

    .filter-group {
        display: flex;
        align-items: center;
        gap: 12px;
        background: #f8fafc;
        padding: 8px 12px;
        border-radius: 10px;
        border: 1px solid var(--border-color);
    }

    .filter-group label {
        font-size: 0.9rem;
        font-weight: 500;
        color: var(--text-main);
    }

    .month-select {
        padding: 8px 14px;
        border: 1px solid var(--border-color);
        border-radius: 6px;
        font-size: 0.95rem;
        min-width: 180px;
        background-color: var(--bg-card);
        color: var(--text-main);
        outline: none;
        transition: all 0.2s ease;
        cursor: pointer;
        font-weight: 500;
    }

    .month-select:focus {
        border-color: #94a3b8;
        box-shadow: 0 0 0 3px rgba(148, 163, 184, 0.15);
    }

    .actions-group {
        display: flex;
        gap: 12px;
    }

    .btn-action {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 18px;
        font-size: 0.9rem;
        font-weight: 500;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
        border: 1px solid transparent;
        letter-spacing: -0.01em;
    }

    .btn-dark {
        background-color: var(--btn-dark);
        color: white;
        box-shadow: 0 2px 4px rgba(15, 23, 42, 0.1);
    }

    .btn-dark:hover {
        background-color: var(--btn-dark-hover);
        transform: translateY(-1px);
        box-shadow: 0 4px 6px rgba(15, 23, 42, 0.15);
    }

    .btn-dark:active {
        transform: translateY(0);
    }

    .btn-outline {
        background-color: var(--btn-outline);
        color: var(--text-main);
        border-color: var(--btn-outline-border);
        box-shadow: var(--shadow-sm);
    }

    .btn-outline:hover {
        background-color: var(--btn-outline-hover);
        border-color: #94a3b8;
    }

    .btn-icon-only {
        padding: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        color: var(--text-main);
        cursor: pointer;
        transition: 0.2s;
        box-shadow: var(--shadow-sm);
    }
    
    .btn-icon-only:hover {
        background: var(--btn-outline-hover);
        color: #0f172a;
        border-color: #94a3b8;
    }

    /* Table Structure */
    .table-responsive {
        border: 1px solid var(--border-color);
        border-radius: 12px;
        overflow-x: auto;
        background: var(--bg-card);
        box-shadow: var(--shadow-sm);
    }

    .fiscal-table {
        width: 100%;
        border-collapse: collapse;
        white-space: nowrap;
    }

    .fiscal-table th,
    .fiscal-table td {
        padding: 16px 24px;
        text-align: left;
        border-bottom: 1px solid var(--border-color);
    }

    .fiscal-table th {
        background-color: #f8fafc;
        font-weight: 500;
        font-size: 0.8rem;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .fiscal-table tbody tr {
        transition: background-color 0.15s ease;
    }

    .fiscal-table tbody tr:hover {
        background-color: #f8fafc;
    }

    .fiscal-table tbody tr:last-child td {
        border-bottom: none;
    }

    .key-cell {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 0.85rem;
        color: var(--text-muted);
        letter-spacing: -0.02em;
    }

    .currency-cell {
        font-weight: 500;
        color: var(--text-main);
        font-feature-settings: "tnum";
        font-variant-numeric: tabular-nums;
    }

    /* Subtle Status Badges */
    .status-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 999px;
        font-size: 0.75rem;
        font-weight: 500;
        border: 1px solid var(--border-color);
        background: var(--bg-card);
        color: var(--text-main);
    }

    .status-badge::before {
        content: '';
        display: block;
        width: 6px;
        height: 6px;
        border-radius: 50%;
    }

    .status-authorized::before { background-color: #10b981; }
    .status-rejected::before { background-color: #f43f5e; }
    .status-cancelled {
        color: var(--text-muted);
        text-decoration: line-through;
    }
    .status-cancelled::before { background-color: #94a3b8; }

    /* Summary */
    .summary-box {
        background: #f8fafc;
        padding: 24px 32px;
        border-radius: 12px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        align-items: flex-end;
        margin-top: 32px;
        border: 1px solid var(--border-color);
    }

    .summary-row {
        display: flex;
        justify-content: space-between;
        width: 340px;
        font-size: 0.95rem;
        color: var(--text-muted);
    }

    .summary-row span:last-child {
        color: var(--text-main);
        font-weight: 500;
        font-feature-settings: "tnum";
        font-variant-numeric: tabular-nums;
    }

    .summary-row.total {
        padding-top: 16px;
        border-top: 1px solid var(--border-color);
        margin-top: 4px;
    }

    .summary-row.total span:first-child {
        font-weight: 600;
        color: var(--text-main);
        font-size: 1.1rem;
    }

    .summary-row.total span:last-child {
        font-weight: 600;
        font-size: 1.4rem;
        color: var(--text-main);
        letter-spacing: -0.02em;
    }

    .summary-row.projection span:last-child {
        color: var(--text-muted);
    }

    /* Modal Auth */
    #main-content.blurred {
        filter: blur(8px) grayscale(20%);
        pointer-events: none;
        user-select: none;
    }

    .modal-overlay {
        position: fixed;
        top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(15, 23, 42, 0.6);
        backdrop-filter: blur(4px);
        display: none;
        justify-content: center;
        align-items: center;
        z-index: 10000;
    }

    .modal-overlay.active {
        display: flex;
        animation: fadeIn 0.3s ease;
    }

    .modal-content {
        background: var(--bg-card);
        padding: 40px;
        border-radius: 16px;
        width: 100%;
        max-width: 400px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        animation: modalPop 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        border: 1px solid rgba(255,255,255,0.1);
    }

    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }

    @keyframes modalPop {
        from { opacity: 0; transform: scale(0.96) translateY(20px); }
        to { opacity: 1; transform: scale(1) translateY(0); }
    }

    .auth-icon-wrapper {
        width: 56px;
        height: 56px;
        background: #f8fafc;
        color: #0f172a;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.5rem;
        margin: 0 auto 24px;
        border: 1px solid var(--border-color);
        box-shadow: 0 2px 4px rgba(0,0,0,0.02);
    }

    .auth-title {
        font-size: 1.35rem;
        font-weight: 600;
        color: var(--text-main);
        margin: 0 0 8px;
        text-align: center;
        letter-spacing: -0.02em;
    }

    .auth-subtitle {
        color: var(--text-muted);
        text-align: center;
        margin-bottom: 32px;
        font-size: 0.95rem;
    }

    .auth-input {
        width: 100%;
        box-sizing: border-box;
        padding: 14px 16px;
        border: 1px solid var(--border-color);
        border-radius: 10px;
        font-size: 1.05rem;
        outline: none;
        transition: all 0.2s ease;
        text-align: center;
        letter-spacing: 3px;
        background: #f8fafc;
        font-weight: 500;
    }

    .auth-input:focus {
        border-color: #0f172a;
        background: #fff;
        box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.1);
    }

    .auth-error {
        color: #ef4444;
        font-size: 0.85rem;
        text-align: center;
        margin-top: 12px;
        display: none;
        font-weight: 500;
    }

    .auth-actions {
        display: flex;
        gap: 12px;
        margin-top: 32px;
    }

    .btn-auth-confirm,
    .btn-auth-cancel {
        flex: 1;
        padding: 12px;
        border-radius: 10px;
        font-weight: 500;
        font-size: 0.95rem;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .btn-auth-confirm {
        background: var(--btn-dark);
        color: white;
        border: 1px solid var(--btn-dark);
        box-shadow: 0 2px 4px rgba(15, 23, 42, 0.1);
    }

    .btn-auth-confirm:hover {
        background: var(--btn-dark-hover);
        transform: translateY(-1px);
    }

    .btn-auth-cancel {
        background: white;
        color: var(--text-main);
        border: 1px solid var(--border-color);
    }

    .btn-auth-cancel:hover {
        background: #f8fafc;
        border-color: #cbd5e1;
    }

    .empty-state {
        text-align: center;
        padding: 64px 24px;
        color: var(--text-muted);
    }

    .empty-state i {
        font-size: 3rem;
        margin-bottom: 16px;
        display: block;
        color: #cbd5e1;
    }
    
    .shake {
        animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both;
    }

    @keyframes shake {
        10%, 90% { transform: translate3d(-1px, 0, 0); }
        20%, 80% { transform: translate3d(2px, 0, 0); }
        30%, 50%, 70% { transform: translate3d(-3px, 0, 0); }
        40%, 60% { transform: translate3d(3px, 0, 0); }
    }

    /* --- PRINT STYLES (A4 LANDSCAPE) CORRIGIDOS --- */
    @media print {
        @page {
            size: A4 landscape;
            margin: 1cm;
        }

        body {
            background-color: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            margin: 0;
            padding: 0;
        }

        /* Esconde todos os elementos do nível do body exceto o main-content */
        body > *:not(#main-content) {
            display: none !important;
        }

        #main-content {
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            max-width: none !important;
            width: 100% !important;
            filter: none !important;
            position: relative !important;
            left: 0 !important;
            top: 0 !important;
        }

        /* Esconde controles explicitamente */
        .controls-bar,
        #loading-spinner,
        #modal-admin-auth {
            display: none !important;
        }

        .header-fiscal {
            border-bottom: 2px solid #000;
            padding-bottom: 15px;
            margin-bottom: 25px;
        }
        
        .header-fiscal .fiscal-info {
            background: transparent !important;
            border: none !important;
            padding: 0 !important;
        }

        h1, h2, h3, p, th, td, span, div {
            color: black !important;
        }

        .fiscal-table th {
            background-color: transparent !important;
            border-bottom: 2px solid #000 !important;
            border-top: 1px solid #000 !important;
        }

        .fiscal-table td {
            border-bottom: 1px solid #ddd !important;
            padding: 8px 12px !important;
        }

        .table-responsive {
            border: none !important;
            box-shadow: none !important;
            overflow: visible !important;
        }

        #print-month-label {
            display: block !important;
            font-size: 1.1rem;
            margin-top: 8px;
            visibility: visible;
            font-weight: 600;
        }
        
        .status-badge {
            border: 1px solid #666 !important;
            box-shadow: none !important;
            background: transparent !important;
        }
        
        .status-authorized::before { background-color: #000 !important; }
        .status-rejected::before { background-color: #666 !important; }
        .status-cancelled::before { background-color: #ccc !important; text-decoration: none !important; }
        
        .summary-box {
            background: transparent !important;
            border: 1px solid #000 !important;
            padding: 15px 20px !important;
            margin-top: 25px !important;
            page-break-inside: avoid;
        }
        
        .summary-row.total span, .summary-row.projection span:last-child {
            color: #000 !important;
        }
    }
</style>`;

const newHTML = `
        <div class="controls-bar">
            <div class="filter-group">
                <label for="month-filter">Mês</label>
                <select id="month-filter" class="month-select">
                    <!-- Opções geradas via JS -->
                </select>
                <button class="btn-icon-only" id="btn-refresh" title="Atualizar dados">
                    <i class='bx bx-refresh'></i>
                </button>
            </div>

            <div class="actions-group">
                <!-- Botão de Imprimir Adicionado -->
                <button class="btn-action btn-outline" id="btn-print" title="Imprimir Relatório (A4 Deitado)">
                    <i class='bx bx-printer'></i> Imprimir
                </button>

                <button class="btn-action btn-dark" id="btn-download-zip" title="Baixar todas as notas do mês em XML">
                    <i class='bx bx-download'></i> Baixar ZIP
                </button>
            </div>
        </div>`;

content = content.replace(/<style>[\s\S]*?<\/style>/, newCSS);
content = content.replace(/<div class="controls-bar">[\s\S]*?<div class="table-responsive">/, newHTML + '\n\n        <div class="table-responsive">');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Update Complete.');
