// --- BANCO DE QUESTÕES ESTRUTURADO PELAS HABILIDADES DO PDF ---

const quizzes = {

    'trilha-h08': {
        id: 'trilha-h08',
        title: 'H08: Gráfico e a Lei da Função Afim',
        videoId: '9U3rkjaVp7I',
        
        tip: {
            text: "Pense no gráfico como um mapa! A regra <strong>f(x) = ax + b</strong> é o segredo para desenhar a linha reta.<br><br><strong>'b' é o ponto de partida:</strong> É onde a linha cruza o 'elevador' (eixo Y). O ponto (0, 5) nos diz que começamos no 5º andar. Então, <strong>b = 5</strong>.<br><br><strong>'a' é o segredo da inclinação:</strong> Ele diz quantos andares subimos para cada passo que damos para a direita. Para ir do ponto (0, 5) ao (2, 11), demos 2 passos para a direita e subimos 6 andares (de 5 para 11). Quantos andares subimos por passo?",
            type: 'graph',
            data: {
                points: [{x: 0, y: 5}, {x: 2, y: 11}],
                range: {xMin: -2, xMax: 12, yMin: -2, yMax: 12}
            }
        },

        questions: [
            {
                steps: [
                    {
                        header: "Passo 1: Encontre o valor de 'b'",
                        instruction: "A fórmula é <strong>f(x) = ax + b</strong>. O ponto <strong>(0, 5)</strong> nos mostra o valor de 'b'. Preencha a lacuna:",
                        template: "f(x) = ax + {blank}",
                        blankOptions: [5, 0, 2, 11],
                        correctAnswer: 5,
                        explanation: "Correto! O valor de 'b' é sempre a coordenada Y quando a coordenada X é 0."
                    },
                    {
                        header: "Passo 2: Substitua o valor de 'y'",
                        instruction: "Agora vamos usar o outro ponto, <strong>(2, 11)</strong>, na fórmula base <strong>y = ax + b</strong>. Em (x, y), qual número representa o 'y'?",
                        template: "{blank} = a * x + b",
                        blankOptions: [11, 2, 5, 0],
                        correctAnswer: 11,
                        explanation: "Perfeito! Em um ponto (x, y), o segundo número é sempre o valor de y."
                    },
                    {
                        header: "Passo 2: Substitua o valor de 'x'",
                        instruction: "Ótimo! Agora, na mesma fórmula e usando o mesmo ponto <strong>(2, 11)</strong>, qual número representa o 'x'?",
                        template: "11 = a * {blank} + b",
                        blankOptions: [2, 11, 5, 0],
                        correctAnswer: 2,
                        explanation: "Isso! O primeiro número no par (x, y) é sempre o valor de x."
                    },
                    {
                        header: "Passo 2: Substitua o valor de 'b'",
                        instruction: "Excelente! Para completar a equação, qual foi o valor de 'b' que encontramos no Passo 1?",
                        template: "11 = a * 2 + {blank}",
                        blankOptions: [5, 11, 2, 3],
                        correctAnswer: 5,
                        explanation: "Exatamente! Esse foi o ponto de partida que encontramos antes."
                    },
                    {
                        header: "Passo 3: Resolvendo para 'a' - Parte 1",
                        instruction: "Agora temos a equação <strong>11 = a * 2 + 5</strong>. Para isolar o 'a', primeiro passamos o <strong>+5</strong> para o outro lado. Lembre-se: ele muda o sinal! Preencha a operação correta:",
                        template: "11 {blank} 5 = a * 2",
                        blankOptions: ["-", "+", "×", "÷"],
                        correctAnswer: "-",
                        explanation: "Isso mesmo! O que é positivo de um lado, vira negativo do outro."
                    },
                    {
                        header: "Passo 3: Resolvendo para 'a' - Parte 2",
                        instruction: "Perfeito. Agora, quanto é <strong>11 - 5</strong>?",
                        template: "{blank} = a * 2",
                        blankOptions: [6, 16, -6, 5],
                        correctAnswer: 6,
                        explanation: "Ótimo! Simplificamos a equação."
                    },
                    {
                        header: "Passo 3: Resolvendo para 'a' - Parte 3",
                        instruction: "Estamos quase lá! Agora temos <strong>6 = a * 2</strong>. O <strong>* 2</strong> passa para o outro lado dividindo. Qual o resultado final de 'a'?",
                        template: "{blank} = a",
                        blankOptions: [3, 4, 12, 8],
                        correctAnswer: 3,
                        explanation: "Correto! 6 dividido por 2 é igual a 3. Você encontrou o coeficiente angular!"
                    },
                    {
                        header: "Passo Final: Monte a função",
                        instruction: "Junte os valores de 'a' e 'b' que você descobriu para formar a lei da função.",
                        template: "f(x) = {blank}x + {blank}",
                        correctAnswers: [3, 5], 
                        blankOptions: [
                            [3, 2, 5, 11],
                            [5, 11, 3, 2]
                        ],
                        explanation: "Perfeito! Você montou a função corretamente."
                    }
                ]
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