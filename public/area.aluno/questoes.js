// --- BANCO DE QUESTÕES ---

const quizzes = {
    // --- NOVOS SIMULADOS DE MATEMÁTICA BÁSICA ---
    'soma': {
        id: 'soma',
        title: 'Simulado de Soma',
        questions: [
            {
                type: 'multipleChoice',
                question: "Maria foi à feira e comprou 12 bananas e 8 maçãs. Quantas frutas ela comprou no total?",
                options: { a: "18", b: "20", c: "22", d: "15" },
                answer: "b",
                tip: "<strong>Passo 1: Anote as informações.</strong><br>Bananas: 12<br>Maçãs: 8<br><br><strong>Passo 2: Entenda o que se pede.</strong><br>A palavra 'total' indica que devemos juntar as quantidades, ou seja, somar.<br><br><strong>Passo 3: Calcule.</strong><br>12 (bananas) + 8 (maçãs) = 20<br><br><strong>Resultado:</strong> Maria comprou 20 frutas."
            },
            {
                type: 'multipleChoice',
                question: "Pedro estava jogando videogame. Ele fez 150 pontos na primeira fase e 250 pontos na segunda fase. Qual foi a pontuação total de Pedro?",
                options: { a: "300", b: "350", c: "400", d: "450" },
                answer: "c",
                tip: "<strong>Passo 1: Anote as informações.</strong><br>Fase 1: 150 pontos<br>Fase 2: 250 pontos<br><br><strong>Passo 2: Entenda o que se pede.</strong><br>A 'pontuação total' pede para juntarmos os pontos das duas fases.<br><br><strong>Passo 3: Calcule.</strong><br>Você pode somar por partes para facilitar:<br>100 + 200 = 300<br>50 + 50 = 100<br>Agora junte os resultados: 300 + 100 = 400<br><br><strong>Resultado:</strong> A pontuação total de Pedro foi 400."
            },
            {
                type: 'multipleChoice',
                question: "Em uma estante há 35 livros de ficção e 45 livros de não-ficção. Quantos livros há na estante?",
                options: { a: "70", b: "75", c: "80", d: "85" },
                answer: "c",
                tip: "<strong>Passo 1: Anote as informações.</strong><br>Livros de ficção: 35<br>Livros de não-ficção: 45<br><br><strong>Passo 2: Entenda o que se pede.</strong><br>A pergunta 'Quantos livros há na estante?' quer saber o total de livros.<br><br><strong>Passo 3: Calcule.</strong><br>35 + 45<br>Uma forma rápida é pensar: 30 + 40 = 70. Depois, some as unidades: 5 + 5 = 10. Agora, junte tudo: 70 + 10 = 80.<br><br><strong>Resultado:</strong> Há 80 livros na estante."
            }
        ]
    },
    'subtracao': {
        id: 'subtracao',
        title: 'Simulado de Subtração',
        questions: [
            {
                type: 'multipleChoice',
                question: "Ana tinha R$50,00 e gastou R$15,00 em um lanche. Com quanto dinheiro ela ficou?",
                options: { a: "R$25,00", b: "R$30,00", c: "R$35,00", d: "R$45,00" },
                answer: "c",
                tip: "<strong>Passo 1: Anote as informações.</strong><br>Dinheiro inicial: R$50,00<br>Gasto: R$15,00<br><br><strong>Passo 2: Entenda o que se pede.</strong><br>A palavra 'gastou' e a pergunta 'com quanto ficou?' indicam que devemos retirar um valor do outro, ou seja, subtrair.<br><br><strong>Passo 3: Calcule.</strong><br>50 - 15<br>Um jeito fácil é tirar 10 de 50, que dá 40. Depois, tirar os 5 restantes de 40, que dá 35.<br><br><strong>Resultado:</strong> Ana ficou com R$35,00."
            },
            {
                type: 'multipleChoice',
                question: "Um pote continha 30 biscoitos. João comeu 6. Quantos biscoitos restaram no pote?",
                options: { a: "24", b: "25", c: "14", d: "36" },
                answer: "a",
                tip: "<strong>Passo 1: Anote as informações.</strong><br>Total de biscoitos: 30<br>Biscoitos comidos: 6<br><br><strong>Passo 2: Entenda o que se pede.</strong><br>A palavra 'restaram' significa o que sobrou após algo ser retirado. É uma conta de subtração.<br><br><strong>Passo 3: Calcule.</strong><br>30 - 6 = 24<br><br><strong>Resultado:</strong> Restaram 24 biscoitos no pote."
            },
            {
                type: 'multipleChoice',
                question: "Um ônibus partiu com 42 passageiros. Na primeira parada, desceram 12 passageiros. Quantos passageiros continuaram no ônibus?",
                options: { a: "20", b: "30", c: "40", d: "54" },
                answer: "b",
                tip: "<strong>Passo 1: Anote as informações.</strong><br>Passageiros no início: 42<br>Passageiros que desceram: 12<br><br><strong>Passo 2: Entenda o que se pede.</strong><br>A palavra 'desceram' indica uma retirada de pessoas do total.<br><br><strong>Passo 3: Calcule.</strong><br>42 - 12<br>Método rápido: 40 - 10 = 30. E 2 - 2 = 0. Então, o resultado é 30.<br><br><strong>Resultado:</strong> 30 passageiros continuaram no ônibus."
            }
        ]
    },
    'multiplicacao': {
        id: 'multiplicacao',
        title: 'Simulado de Multiplicação',
        questions: [
            {
                type: 'multipleChoice',
                question: "Uma caixa de lápis de cor tem 12 lápis. Se a professora comprar 5 caixas, quantos lápis ela terá no total?",
                options: { a: "50", b: "55", c: "60", d: "65" },
                answer: "c",
                tip: "<strong>Passo 1: Anote as informações.</strong><br>Lápis por caixa: 12<br>Número de caixas: 5<br><br><strong>Passo 2: Entenda o que se pede.</strong><br>Queremos saber o total de lápis, repetindo a quantidade '12' por '5' vezes. Isso é uma multiplicação.<br><br><strong>Passo 3: Calcule.</strong><br>12 x 5<br>Dica: 10 x 5 = 50. E 2 x 5 = 10. Agora some os dois: 50 + 10 = 60.<br><br><strong>Resultado:</strong> A professora terá 60 lápis."
            },
            {
                type: 'multipleChoice',
                question: "Em um auditório, as cadeiras estão organizadas em 8 fileiras, com 10 cadeiras em cada fileira. Quantas cadeiras há no auditório?",
                options: { a: "18", b: "80", c: "88", d: "108" },
                answer: "b",
                tip: "<strong>Passo 1: Anote as informações.</strong><br>Número de fileiras: 8<br>Cadeiras por fileira: 10<br><br><strong>Passo 2: Entenda o que se pede.</strong><br>A organização em fileiras iguais sugere uma multiplicação para achar o total.<br><br><strong>Passo 3: Calcule.</strong><br>8 x 10<br>Dica: Multiplicar por 10 é só adicionar um zero no final do outro número. Então, 8 vira 80.<br><br><strong>Resultado:</strong> Há 80 cadeiras no auditório."
            },
            {
                type: 'multipleChoice',
                question: "Se Carlos economizar R$25,00 por semana, quanto ele terá economizado após 4 semanas?",
                options: { a: "R$29,00", b: "R$50,00", c: "R$75,00", d: "R$100,00" },
                answer: "d",
                tip: "<strong>Passo 1: Anote as informações.</strong><br>Valor por semana: R$25,00<br>Total de semanas: 4<br><br><strong>Passo 2: Entenda o que se pede.</strong><br>A quantia se repete a cada semana. Para saber o total, multiplicamos.<br><br><strong>Passo 3: Calcule.</strong><br>25 x 4<br>Pense em moedas: 4 moedas de 25 centavos formam 1 real. Da mesma forma, 4 x 25 é igual a 100.<br><br><strong>Resultado:</strong> Carlos terá economizado R$100,00."
            }
        ]
    },
    'divisao': {
        id: 'divisao',
        title: 'Simulado de Divisão',
        questions: [
            {
                type: 'multipleChoice',
                question: "Mariana tem 40 balas para dividir igualmente entre seus 5 amigos. Quantas balas cada amigo receberá?",
                options: { a: "6", b: "7", c: "8", d: "9" },
                answer: "c",
                tip: "<strong>Passo 1: Anote as informações.</strong><br>Total de balas: 40<br>Número de amigos: 5<br><br><strong>Passo 2: Entenda o que se pede.</strong><br>A expressão 'dividir igualmente' indica uma conta de divisão.<br><br><strong>Passo 3: Calcule.</strong><br>40 ÷ 5<br>Você pode pensar na tabuada do 5: Qual número multiplicado por 5 dá 40? 5 x 8 = 40.<br><br><strong>Resultado:</strong> Cada amigo receberá 8 balas."
            },
            {
                type: 'multipleChoice',
                question: "Uma biblioteca recebeu uma doação de 90 livros e quer organizá-los em 10 prateleiras, com a mesma quantidade em cada uma. Quantos livros ficarão por prateleira?",
                options: { a: "9", b: "10", c: "80", d: "100" },
                answer: "a",
                tip: "<strong>Passo 1: Anote as informações.</strong><br>Total de livros: 90<br>Número de prateleiras: 10<br><br><strong>Passo 2: Entenda o que se pede.</strong><br>Organizar em quantidades iguais é uma divisão.<br><br><strong>Passo 3: Calcule.</strong><br>90 ÷ 10<br>Dica rápida: Dividir por 10 é só cortar o zero do final. Então, 90 vira 9.<br><br><strong>Resultado:</strong> Ficarão 9 livros por prateleira."
            },
            {
                type: 'multipleChoice',
                question: "Três amigos foram a uma pizzaria e a conta deu R$75,00. Se eles dividirem o valor igualmente, quanto cada um deverá pagar?",
                options: { a: "R$15,00", b: "R$20,00", c: "R$25,00", d: "R$30,00" },
                answer: "c",
                tip: "<strong>Passo 1: Anote as informações.</strong><br>Valor da conta: R$75,00<br>Número de amigos: 3<br><br><strong>Passo 2: Entenda o que se pede.</strong><br>A palavra 'dividirem' já nos diz qual operação usar.<br><br><strong>Passo 3: Calcule.</strong><br>75 ÷ 3<br>Você pode pensar: 60 dividido por 3 é 20. Sobra 15 (75 - 60). E 15 dividido por 3 é 5. Agora some os resultados: 20 + 5 = 25.<br><br><strong>Resultado:</strong> Cada amigo deverá pagar R$25,00."
            }
        ]
    },
    'porcentagem': {
        id: 'porcentagem',
        title: 'Simulado de Porcentagem',
        questions: [
            {
                type: 'multipleChoice',
                question: "Uma camiseta que custa R$80,00 está com 10% de desconto. Qual é o valor do desconto?",
                options: { a: "R$1,00", b: "R$8,00", c: "R$10,00", d: "R$70,00" },
                answer: "b",
                tip: "<strong>Passo 1: Anote as informações.</strong><br>Valor da camiseta: R$80,00<br>Desconto: 10%<br><br><strong>Passo 2: Entenda o que se pede.</strong><br>Calcular 10% de 80.<br><br><strong>Passo 3: Calcule.</strong><br>Método rápido para 10%: Apenas 'ande' com a vírgula uma casa para a esquerda. O número 80,00 vira 8,00.<br><code>80,00 → 8,00</code><br><br><strong>Resultado:</strong> O valor do desconto é de R$8,00."
            },
            {
                type: 'multipleChoice',
                question: "João tem uma poupança que rende 2% ao mês. No primeiro mês ele aportou R$100,00. Qual será o valor do juros recebido no próximo mês?",
                options: { a: "R$1,00", b: "R$2,00", c: "R$102,00", d: "R$20,00" },
                answer: "b",
                tip: "<strong>Passo 1: Anote as informações.</strong><br>Aporte: R$100,00<br>Juros: 2%<br><br><strong>Passo 2: Entenda o que se pede.</strong><br>Calcular 2% de 100.<br><br><strong>Passo 3: Calcule.</strong><br>Porcentagem é uma divisão por 100. Então, calculamos:<br><code>(100 x 2) / 100</code><br>Dica rápida: Como temos '100' multiplicando e dividindo, podemos cortá-los. Sobra apenas o 2.<br><code>(<strong>100</strong> x 2) / <strong>100</strong> = 2</code><br><br><strong>Resultado:</strong> O valor do juros é R$2,00."
            },
            {
                type: 'multipleChoice',
                question: "Em uma turma de 40 alunos, 50% foram aprovados. Quantos alunos foram aprovados?",
                options: { a: "10", b: "20", c: "30", d: "40" },
                answer: "b",
                tip: "<strong>Passo 1: Anote as informações.</strong><br>Total de alunos: 40<br>Aprovados: 50%<br><br><strong>Passo 2: Entenda o que se pede.</strong><br>Calcular 50% de 40.<br><br><strong>Passo 3: Calcule.</strong><br>Dica rápida: 50% é sempre a <strong>metade</strong> de um valor. Qual é a metade de 40?<br><code>40 / 2 = 20</code><br><br><strong>Resultado:</strong> 20 alunos foram aprovados."
            }
        ]
    },

    // --- SIMULADOS ANTERIORES ---
    'literatura': { id: 'literatura', title: 'Simulado de Literatura', questions: [ ] },
    'pa-pg': { id: 'pa-pg', title: 'Simulado de PA e PG', questions: [] },
    'quimica': { id: 'quimica', title: 'Simulado de Química', questions: [] },
    'fdl': { id: 'fdl', title: 'Simulado de Funções da Linguagem', questions: [] },
    'historia': { id: 'historia', title: 'Simulado de História - 2ª Guerra', questions: [] }
};
