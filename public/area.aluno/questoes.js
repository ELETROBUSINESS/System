// --- BANCO DE QUESTÕES ESTRUTURADO PELAS HABILIDADES DO PDF ---

const quizzes = {
    // --- MÓDULO 1: FUNÇÕES (MAIORES DIFICULDADES) ---
    'trilha-h08': {
        id: 'trilha-h08',
        title: 'H08: Gráfico e a Lei da Função Afim',
        questions: [
            {
                type: 'multipleChoice',
                question: "O gráfico de uma função afim, f(x) = ax + b, passa pelos pontos (0, 5) e (2, 11). Qual é a lei de formação dessa função?",
                options: { a: "f(x) = 5x + 3", b: "f(x) = 2x + 5", c: "f(x) = 3x + 5", d: "f(x) = 6x + 5" },
                answer: "c",
                tipType: 'graph',
                tipData: {
                    points: [{x: 0, y: 5}, {x: 2, y: 11}],
                    range: {xMin: -2, xMax: 12, yMin: -2, yMax: 12} // Define a área visível do gráfico
                },
                tip: "Pense no gráfico como um mapa! A regra <strong>f(x) = ax + b</strong> é o segredo para desenhar a linha reta.<br><br><strong>'b' é o ponto de partida:</strong> É onde a linha cruza o 'elevador' (eixo Y). O ponto (0, 5) nos diz que começamos no 5º andar. Então, <strong>b = 5</strong>.<br><br><strong>'a' é o segredo da inclinação:</strong> Ele diz quantos andares subimos para cada passo que damos para a direita. Para ir do ponto (0, 5) ao (2, 11), demos 2 passos para a direita e subimos 6 andares (de 5 para 11). Quantos andares subimos por passo?",
                example: {
                    problem: "<strong>Exemplo Mágico:</strong> Uma reta passa pelo ponto de partida (0, 1) e pelo ponto (2, 5). Vamos descobrir a regra dela!",
                    tipType: 'graph',
                    tipData: {
                        points: [{x: 0, y: 1}, {x: 2, y: 5}],
                        range: {xMin: -2, xMax: 6, yMin: -2, yMax: 6}
                    },
                    text: "<strong>Passo 1: Achar o 'b'.</strong><br>O ponto de partida no 'elevador' Y é (0, 1). Então, <strong>b = 1</strong>. Nossa regra começa assim: f(x) = ax + 1.<br><br><strong>Passo 2: Achar o 'a'.</strong><br>Para ir de (0, 1) até (2, 5), demos 2 passos para a direita e subimos 4 andares (de 1 para 5).<br>Se subimos 4 andares em 2 passos, quantos andares subimos por passo?<br>4 ÷ 2 = 2. Então, <strong>a = 2</strong>.<br><br><strong>Resposta Mágica:</strong> A regra é <strong>f(x) = 2x + 1</strong>!"
                }
            },
            {
                type: 'multipleChoice',
                question: "Um gráfico de uma função do 1º grau intercepta o eixo y no ponto -2 e passa pelo ponto (3, 7). Qual é a expressão algébrica que representa essa função?",
                options: { a: "y = 3x - 2", b: "y = -2x + 3", c: "y = 7x + 3", d: "y = 9x - 2" },
                answer: "a",
                tip: "O coeficiente linear (b) é o ponto onde o gráfico corta o eixo y. Use o outro ponto para encontrar o coeficiente angular (a)."
            },
            {
                type: 'multipleChoice',
                question: "Analisando um gráfico, vemos uma reta decrescente que passa pelos pontos (0, 4) e (2, 0). Qual função corresponde a este gráfico?",
                options: { a: "f(x) = 4x + 2", b: "f(x) = 2x + 4", c: "f(x) = -2x + 4", d: "f(x) = -4x + 2" },
                answer: "c",
                tip: "Uma reta decrescente possui um coeficiente angular (a) negativo. O ponto onde x=0 indica o coeficiente linear (b)."
            }
        ]
    },
    'trilha-h12': {
        id: 'trilha-h12',
        title: 'H12: Identificando Funções Exponenciais',
        questions: [
            {
                type: 'multipleChoice',
                question: "Qual das seguintes funções representa um crescimento exponencial?",
                options: { a: "f(x) = x²", b: "f(x) = 2x + 1", c: "f(x) = 3 * (1.5)^x", d: "f(x) = 5 * (0.5)^x" },
                answer: "c",
                tip: "Uma função exponencial tem a variável 'x' no expoente. O crescimento ocorre quando a base é maior que 1."
            },
            {
                type: 'multipleChoice',
                question: "O gráfico de uma função exponencial f(x) = a^x sempre passa por um ponto específico, desde que a > 0 e a ≠ 1. Que ponto é esse?",
                options: { a: "(0, 0)", b: "(1, 0)", c: "(0, 1)", d: "(1, 1)" },
                answer: "c",
                tip: "Lembre-se da propriedade de potenciação em que todo número (diferente de zero) elevado a zero resulta em 1."
            },
            {
                type: 'multipleChoice',
                question: "A expressão y = 100 * (0.8)^t descreve o decaimento de uma substância ao longo do tempo 't'. Esta é uma função:",
                options: { a: "Linear crescente", b: "Exponencial decrescente", c: "Quadrática", d: "Exponencial crescente" },
                answer: "b",
                tip: "A variável está no expoente, o que a torna exponencial. A base da potência (0.8) é um número entre 0 e 1."
            }
        ]
    },
    'trilha-h13': {
        id: 'trilha-h13',
        title: 'H13: Problemas com Função Exponencial',
        questions: [
            {
                type: 'multipleChoice',
                question: "Uma população de bactérias dobra a cada hora. Se a população inicial é de 500 bactérias, qual será a população após 3 horas? A função é P(t) = 500 * 2^t.",
                options: { a: "1500", b: "3000", c: "4000", d: "8000" },
                answer: "c",
                tip: "Substitua o 't' (tempo) pelo valor 3 na função fornecida e calcule a potência primeiro."
            },
            {
                type: 'multipleChoice',
                question: "Um investimento de R$1.000,00 rende juros de 10% ao mês em regime de juros compostos. Qual será o montante após 2 meses? A fórmula é M = 1000 * (1.10)^t.",
                options: { a: "R$1.200,00", b: "R$1.210,00", c: "R$1.100,00", d: "R$2.000,00" },
                answer: "b",
                tip: "Use t=2 na fórmula. Lembre-se que (1.10)² é o mesmo que 1.10 * 1.10."
            },
            {
                type: 'multipleChoice',
                question: "O valor de um carro deprecia 20% ao ano. Se ele custa R$50.000,00 hoje, qual será seu valor após 2 anos? A função é V(t) = 50000 * (0.8)^t.",
                options: { a: "R$30.000,00", b: "R$32.000,00", c: "R$40.000,00", d: "R$10.000,00" },
                answer: "b",
                tip: "Se o carro deprecia 20%, seu valor restante é 80% do valor do ano anterior, por isso a base é 0.8. Calcule para t=2."
            }
        ]
    },
    'trilha-h21': {
        id: 'trilha-h21',
        title: 'H21: Volume e Área de Sólidos',
        questions: [
            {
                type: 'multipleChoice',
                question: "Uma piscina retangular tem 10 metros de comprimento, 5 metros de largura e 2 metros de profundidade. Qual é o seu volume em metros cúbicos?",
                options: { a: "17 m³", b: "50 m³", c: "100 m³", d: "200 m³" },
                answer: "c",
                tip: "Imagine que você quer encher a piscina com bloquinhos de 1 metro. O volume é quantos bloquinhos cabem aí dentro!<br><br>Para descobrir, é só multiplicar os três lados: <strong>Comprimento × Largura × Profundidade</strong>.",
                example: {
                    problem: "<strong>Exemplo:</strong> Uma caixa de brinquedos tem 3 metros de comprimento, 2 metros de largura e 1 metro de altura. Qual o volume dela?",
                    text: "<strong>É só multiplicar!</strong><br>Volume = 3 (comprimento) × 2 (largura) × 1 (altura)<br>Volume = 6 × 1<br><strong>Volume = 6 m³</strong><br><br><strong>Resposta do Exemplo:</strong> Cabem 6 bloquinhos gigantes de 1 metro dentro da caixa!"
                }
            },
            {
                type: 'multipleChoice',
                question: "Um cilindro (lata de refrigerante) tem raio da base de 3 cm e altura de 10 cm. Qual é a área da sua base? (Considere π ≈ 3.14)",
                options: { a: "28.26 cm²", b: "31.4 cm²", c: "90 cm²", d: "94.2 cm²" },
                answer: "a",
                tip: "A base de um cilindro é um círculo. A área de um círculo é calculada pela fórmula A = π * r²."
            },
            {
                type: 'multipleChoice',
                question: "Para pintar uma caixa cúbica com 4 metros de aresta, qual a área total a ser pintada?",
                options: { a: "16 m²", b: "64 m²", c: "80 m²", d: "96 m²" },
                answer: "d",
                tip: "Um cubo tem 6 faces quadradas iguais. Calcule a área de uma face (lado * lado) e depois multiplique por 6."
            }
        ]
    },
    'revisao-1': {
        id: 'revisao-1',
        title: 'Revisão 1: Funções e Sólidos',
        questions: [
            {
                type: 'multipleChoice',
                question: "O gráfico de uma função afim passa pelos pontos (0, -1) e (1, 2). Qual é a sua lei de formação?",
                options: { a: "f(x) = 2x - 1", b: "f(x) = -x + 2", c: "f(x) = 3x - 1", d: "f(x) = x + 1" },
                answer: "c",
                tip: "Habilidade H08: O ponto com x=0 te dá o valor de 'b'. Use o outro ponto para achar a inclinação 'a'."
            },
            {
                type: 'multipleChoice',
                question: "Uma cultura de células triplica a cada dia. Se começamos com 20 células, qual a função que modela essa situação, onde 'd' é o número de dias?",
                options: { a: "C(d) = 20 + 3d", b: "C(d) = 20 * 3^d", c: "C(d) = 3 * 20^d", d: "C(d) = 20 * d³" },
                answer: "b",
                tip: "Habilidade H12/H13: O valor inicial multiplica a base de crescimento elevada ao tempo."
            },
            {
                type: 'multipleChoice',
                question: "Qual o volume de uma caixa de sapatos com 30 cm de comprimento, 20 cm de largura e 10 cm de altura?",
                options: { a: "60 cm³", b: "600 cm³", c: "6000 cm³", d: "60000 cm³" },
                answer: "c",
                tip: "Habilidade H21: Volume de um paralelepípedo = comprimento × largura × altura."
            }
        ]
    }
};