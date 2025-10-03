// --- BANCO DE QUESTÕES ---

const quizzes = {
    'literatura': { id: 'literatura', title: 'Simulado de Literatura', questions: [] },
    'pa-pg': { id: 'pa-pg', title: 'Simulado de PA e PG', questions: [] },
    'quimica': { id: 'quimica', title: 'Simulado de Química', questions: [] },
    'fdl': { id: 'fdl', title: 'Simulado de Funções da Linguagem', questions: [] },
    'historia': { id: 'historia', title: 'Simulado de História - 2ª Guerra', questions: [] }
};

quizzes['literatura'].questions = [
    {
        type: 'multipleChoice',
        text1: "Em Memórias Póstumas de Brás Cubas, Machado de Assis rompe com o padrão tradicional da literatura do século XIX. A escolha de um narrador já falecido, que decide contar sua vida após a morte, afasta qualquer expectativa de moralidade ou exemplaridade. Brás Cubas não busca justificar erros, nem ensinar lições, apenas diverte-se narrando com ironia seus fracassos e vaidades. O texto desmonta o ideal romântico do herói virtuoso e expõe as contradições da elite brasileira da época.",
        text2: "Críticos literários destacam que a força de Memórias Póstumas de Brás Cubas não está apenas na ironia ou na crítica social, mas na inovação formal. A narrativa fragmentada, repleta de digressões, cria um diálogo direto com o leitor, rompendo a linearidade e aproximando a obra da modernidade literária. Mais do que uma sátira da elite, a obra é um estudo sobre a condição humana, revelando o tédio, o egoísmo e a mediocridade como aspectos universais.",
        question: "Os textos apresentam diferentes enfoques da mesma obra. Qual alternativa melhor resume essa diferença?",
        options: {
            a: "O Texto I enfatiza a crítica social e o retrato da elite, enquanto o Texto II destaca a inovação formal e a reflexão sobre a condição humana.",
            b: "O Texto I vê a obra como fragmentada e moderna, enquanto o Texto II a considera uma narrativa linear e tradicional.",
            c: "O Texto I entende que o narrador busca ensinar lições de moral, enquanto o Texto II afirma que não há lição a ser ensinada.",
            d: "O Texto I critica o excesso de digressões, enquanto o Texto II valoriza a objetividade narrativa de Machado.",
            e: "Ambos os textos concordam que a obra é apenas uma sátira humorística sem maior relevância."
        },
        answer: "a",
        tip: "Habilidade H03: Leia o Texto I e identifique suas palavras-chave (ex: 'crítica social', 'elite'). Faça o mesmo com o Texto II (ex: 'inovação formal', 'condição humana'). A alternativa correta será aquela que contrastar exatamente esses pontos principais."
    },
    {
        type: 'multipleChoice',
        text1: "“Lucas saiu cedo de casa naquela manhã. Levava consigo uma mala pequena, na qual havia colocado apenas roupas e um caderno de anotações. Ao atravessar a cidade, parou diante da estação de trem. Ali, ficou observando as pessoas que chegavam e partiam, imaginando como seria sua vida em outro lugar.”",
        question: "O termo “Ali” retoma:",
        options: { a: "A casa de Lucas.", b: "A estação de trem.", c: "A cidade.", d: "O caderno de anotações.", e: "A mala pequena." },
        answer: "b",
        tip: "Habilidade H10: A palavra 'Ali' indica um lugar. Para descobrir a que lugar ela se refere, pergunte ao texto: 'Onde Lucas ficou observando as pessoas?'. A resposta estará na frase imediatamente anterior."
    },
    {
        type: 'multipleChoice',
        text1: "Reportagem (1970) – “O avanço da televisão preocupa especialistas. O tempo que antes era dedicado aos livros vem sendo substituído por longas horas diante da tela. Essa mudança ameaça a formação intelectual das novas gerações.”",
        text2: "Reportagem (2023) – “As redes sociais, quando usadas de forma crítica, têm aproximado jovens da literatura. Grupos de leitura online e resenhas em vídeo têm despertado o interesse por obras clássicas, democratizando o acesso ao livro.”",
        question: "As diferentes formas de tratar a leitura estão ligadas:",
        options: {
            a: "À diferença de época e ao modo como cada meio de comunicação é avaliado.",
            b: "Apenas ao fato de que um texto é jornalístico e o outro é digital.",
            c: "Ao uso de dados estatísticos em ambos os casos.",
            d: "À mesma visão negativa sobre a tecnologia.",
            e: "À crítica à leitura digital, comum a ambos."
        },
        answer: "a",
        tip: "Habilidade H11: Observe as datas (1970 vs. 2023) e as tecnologias (TV vs. Redes Sociais). A chave está em perceber como a mudança no tempo e na tecnologia altera a opinião sobre o impacto na leitura."
    },
    {
        type: 'multipleChoice',
        text1: "“Helena sempre sonhou em ser bailarina, mas sua família queria que estudasse medicina. Entre ensaios escondidos e provas difíceis, ela tentava equilibrar os dois mundos. Quando recebeu a chance de uma audição em uma companhia renomada, percebeu que teria de escolher entre o sonho e as expectativas familiares.”",
        question: "O conflito central é:",
        options: {
            a: "A falta de recursos financeiros de Helena.",
            b: "O dilema entre seguir a medicina ou a dança.",
            c: "A dificuldade em realizar as provas escolares.",
            d: "O encontro de Helena com uma companhia de dança.",
            e: "O apoio incondicional da família."
        },
        answer: "b",
        tip: "Habilidade H13: O conflito narrativo é o principal problema ou oposição que o protagonista enfrenta. Qual é a escolha fundamental que move a história de Helena? É uma luta interna entre dois caminhos."
    },
    {
        type: 'multipleChoice',
        text1: "“Em uma pequena vila, todos os dias os vizinhos se reuniam na praça para conversar. As casas eram simples, pintadas de cores claras, e havia sempre crianças brincando nas ruas. Um dia, porém, o cotidiano foi interrompido quando uma misteriosa carta apareceu na porta da prefeitura.”",
        question: "O elemento principal do enredo é:",
        options: {
            a: "As casas pintadas de cores claras.",
            b: "As crianças brincando nas ruas.",
            c: "A reunião dos vizinhos na praça.",
            d: "O surgimento de uma carta misteriosa.",
            e: "A rotina da pequena vila."
        },
        answer: "d",
        tip: "Habilidade H14: O texto primeiro descreve o cenário (informação secundária). O elemento principal é o fato novo que quebra essa rotina e dá início à ação. Procure pela palavra que indica uma mudança, como 'porém' ou 'mas'."
    },
    {
        type: 'multipleChoice',
        text1: "Crônica – “O celular roubou a atenção da leitura. Basta observar os jovens no metrô: poucos seguram livros, mas quase todos olham para uma tela.”",
        text2: "Reportagem – “Pesquisas recentes mostram que, apesar da popularidade dos celulares, a leitura digital tem crescido entre jovens brasileiros, que usam aplicativos e e-books para ampliar o acesso a obras.”",
        question: "Os textos divergem porque:",
        options: {
            a: "O primeiro critica o impacto negativo do celular, enquanto o segundo mostra que ele pode favorecer a leitura.",
            b: "Ambos afirmam que os jovens leem menos por causa do celular.",
            c: "O primeiro mostra dados estatísticos, enquanto o segundo traz apenas impressões pessoais.",
            d: "O segundo considera o celular prejudicial, ao contrário do primeiro.",
            e: "Os dois concordam que a leitura digital substitui a leitura em papel de forma definitiva."
        },
        answer: "a",
        tip: "Habilidade H03: Resuma a ideia central de cada texto em uma frase. Texto I: Celular atrapalha a leitura. Texto II: Celular pode ajudar na leitura. A alternativa correta vai refletir essa oposição de ideias."
    },
    {
        type: 'multipleChoice',
        text1: "“Ana estudava horas por dia. Porém, isso não garantia boas notas. Apesar do esforço, ela sentia que algo faltava.”",
        question: "O termo “isso” retoma:",
        options: {
            a: "As boas notas de Ana.",
            b: "A dedicação de Ana aos estudos.",
            c: "A sensação de algo faltar.",
            d: "A dedicação de outras pessoas.",
            e: "O resultado final das provas."
        },
        answer: "b",
        tip: "Habilidade H10: Para saber o que o pronome 'isso' retoma, substitua-o pela informação da frase anterior. 'Porém, [estudar horas por dia] não garantia boas notas'. A frase continua fazendo sentido? Se sim, você encontrou a resposta."
    },
    {
        type: 'multipleChoice',
        text1: "Editorial de jornal (1960) – “A televisão ameaça os jovens leitores. O tempo antes dedicado ao estudo é desperdiçado diante de telas brilhantes.”",
        text2: "Blog de professor (2022) – “As redes sociais podem aproximar jovens da literatura. Resenhas e clubes de leitura online são formas de estimular o hábito.”",
        question: "A principal diferença é:",
        options: {
            a: "A visão negativa da TV em 1960 versus a visão positiva das redes sociais em 2022.",
            b: "O gênero textual distinto: reportagem versus blog.",
            c: "O uso de poesia em um texto e de prosa no outro.",
            d: "A defesa comum da tecnologia.",
            e: "O mesmo ponto de vista, mas em linguagens diferentes."
        },
        answer: "a",
        tip: "Habilidade H11: Assim como em questões anteriores, foque na data e na tecnologia. Um texto de 1960 vê a TV como 'ameaça'. Um texto de 2022 vê as redes sociais como uma ferramenta que pode 'aproximar'. A diferença está na avaliação (positiva ou negativa) da tecnologia de cada época."
    },
    {
        type: 'multipleChoice',
        text1: "“Certo dia, Pedro encontrou uma carteira no chão. Dentro havia dinheiro suficiente para pagar suas dívidas e documentos de identificação. O rapaz hesitou: deveria devolver ao dono ou usar o dinheiro para resolver sua situação financeira?”",
        question: "O conflito está em:",
        options: {
            a: "A presença de documentos na carteira.",
            b: "O encontro de Pedro com dinheiro.",
            c: "O dilema moral entre devolver ou ficar com a carteira.",
            d: "A falta de testemunhas no momento do achado.",
            e: "A quantia exata encontrada."
        },
        answer: "c",
        tip: "Habilidade H13: O conflito é a tensão da história. Não é o ato de achar a carteira, mas a dúvida que isso gera em Pedro. Procure a alternativa que descreve a escolha difícil, a luta interna do personagem."
    },
    {
        type: 'multipleChoice',
        text1: "“Na cidade havia uma praça antiga, com árvores frondosas e um coreto no centro. Todos os sábados aconteciam encontros musicais. Mas em uma manhã chuvosa, os moradores se espantaram: uma estátua desconhecida havia sido colocada no meio da praça, sem que ninguém soubesse por quem.”",
        question: "O fato principal é:",
        options: {
            a: "As árvores frondosas.",
            b: "O coreto da praça.",
            c: "Os encontros musicais.",
            d: "O surgimento da estátua misteriosa.",
            e: "A chuva na manhã descrita."
        },
        answer: "d",
        tip: "Habilidade H14: As informações sobre a praça, as árvores e os encontros são o cenário, o pano de fundo (secundário). O fato principal é o evento inesperado que quebra a normalidade e que certamente dará início a uma nova história."
    }
];

quizzes['pa-pg'].questions = [
    { type: 'multipleChoice', question: "1. Um atleta corre 5 km no primeiro dia de treino...", options: { A: "21 km", B: "24 km", C: "26 km", D: "29 km" }, answer: "C", difficulty: 'easy' }, { type: 'multipleChoice', question: "2. Um teatro possui 15 cadeiras na primeira fileira...", options: { A: "285", B: "42", C: "150", D: "300" }, answer: "A", difficulty: 'easy' }, { type: 'multipleChoice', question: "3. O lucro de uma empresa em janeiro foi de R$ 80.000,00...", options: { A: "R$ 60.000,00", B: "R$ 56.000,00", C: "R$ 52.000,00", D: "R$ 48.000,00" }, answer: "B", difficulty: 'hard' }, { type: 'multipleChoice', question: "4. Uma cultura de bactérias começa com 100 indivíduos...", options: { A: "500", B: "800", C: "1.600", D: "3.200" }, answer: "C", difficulty: 'easy' }, { type: 'multipleChoice', question: "5. Um investidor aplicou R$ 50,00 no primeiro mês...", options: { A: "R$ 1.600,00", B: "R$ 3.150,00", C: "R$ 3.200,00", D: "R$ 1.550,00" }, answer: "B", difficulty: 'easy' }, { type: 'multipleChoice', question: "6. Sabendo que a sequência (x-2, x, x+3) é uma PG...", options: { A: "4", B: "5", C: "6", D: "2" }, answer: "C", difficulty: 'hard' }
];

quizzes['quimica'].questions = [
    { type: 'multipleChoice', question: "1. Qual é o nome oficial (IUPAC) para o hidrocarboneto de cadeia normal com 5 átomos de carbono e apenas ligações simples?", options: { A: "Pentano", B: "Penteno", C: "Propano", D: "Butano" }, answer: "A", difficulty: 'easy' }, { type: 'multipleChoice', question: "2. O composto But-2-eno é classificado como um:", options: { A: "Alcano", B: "Alcino", C: "Alceno", D: "Ciclano" }, answer: "C", difficulty: 'easy' }, { type: 'multipleChoice', question: "3. A estrutura CH₃-CH₂-CH=CH₂ representa qual composto?", options: { A: "But-2-eno", B: "Butano", C: "But-1-ino", D: "But-1-eno" }, answer: "D", difficulty: 'easy' }, { type: 'multipleChoice', question: "4. Qual dos compostos abaixo é um alcino, caracterizado por uma ligação tripla?", options: { A: "Eteno", B: "Propano", C: "Propeno", D: "Propino" }, answer: "D", difficulty: 'easy' }, { type: 'multipleChoice', question: "5. Qual é o nome IUPAC para o composto a seguir: CH₃-CH(CH₃)-CH₂-CH(CH₃)-CH₃?", options: { A: "2,4-dimetil-hexano", B: "2,4-dimetil-pentano", C: "2-metil-4-metil-pentano", D: "3,5-dimetil-pentano" }, answer: "B", difficulty: 'hard' }, { type: 'multipleChoice', question: "6. O composto conhecido como Tolueno, um importante solvente, é um hidrocarboneto aromático. Qual outro nome ele pode receber pela nomenclatura IUPAC?", options: { A: "Etil-benzeno", B: "Dimetil-benzeno", C: "Metil-benzeno", D: "Propil-benzeno" }, answer: "C", difficulty: 'hard' }
];

quizzes['fdl'].questions = [
    { type: 'multipleChoice', question: "1. No processo de comunicação, quem codifica a mensagem, ou seja, quem a elabora e envia?", options: { A: "Receptor", B: "Emissor", C: "Canal", D: "Mensagem" }, answer: "B", difficulty: 'easy' }, { type: 'multipleChoice', question: "2. Na frase 'O céu está azul e o dia ensolarado', a principal função da linguagem é a referencial, pois o objetivo é:", options: { A: "Expressar os sentimentos do autor sobre o dia.", B: "Verificar se o interlocutor está ouvindo.", C: "Informar sobre um fato de forma objetiva.", D: "Usar a linguagem para falar da própria linguagem." }, answer: "C", difficulty: 'easy' }, { type: 'multipleChoice', question: "3. Leia o slogan: 'Compre já o seu e garanta a diversão!'. Qual função da linguagem é predominante?", options: { A: "Função Poética", B: "Função Emotiva", C: "Função Fática", D: "Função Conativa (ou Apelativa)" }, answer: "D", difficulty: 'easy' }, { type: 'multipleChoice', question: "4. No trecho 'Ah, que saudade que eu sinto da minha terra natal!', o foco está no emissor e em seus sentimentos. Portanto, a função da linguagem que prevalece é a:", options: { A: "Emotiva (ou Expressiva)", B: "Referencial", C: "Metalinguística", D: "Poética" }, answer: "A", difficulty: 'easy' }, { type: 'multipleChoice', question: "5. Em uma conversa telefônica, a expressão 'Alô, está me ouvindo?' serve principalmente para testar o canal de comunicação. Esse é um exemplo clássico da função:", options: { A: "Metalinguística", B: "Referencial", C: "Fática", D: "Apelativa" }, answer: "C", difficulty: 'hard' }, { type: 'multipleChoice', question: "6. A definição de uma palavra em um dicionário é o exemplo mais claro de qual função da linguagem, onde o código é usado para explicar o próprio código?", options: { A: "Função Poética", B: "Função Metalinguística", C: "Função Referencial", D: "Função Emotiva" }, answer: "B", difficulty: 'hard' }
];

quizzes['historia'].questions = [
    { type: 'discursive', question: "1. (Discursiva) Após ler o poema 'Rosa de Hiroshima', qual é o assunto principal abordado?", keywords: ['bomba'], poem: true, difficulty: 'easy' },
    { type: 'discursive', question: "3. (Discursiva) O poema retrata qual acontecimento histórico específico?", keywords: ['bomba'], difficulty: 'easy' },
    { type: 'multipleChoice', question: "4. A Segunda Guerra Mundial foi travada por duas grandes alianças militares. O grupo formado por Alemanha, Itália e Japão era conhecido como:", options: { A: "Aliados", B: "Tríplice Entente", C: "Eixo", D: "Potências Centrais" }, answer: "C", difficulty: 'easy' },
    { type: 'multipleChoice', question: "5. Qual era o nome do projeto secreto dos EUA que desenvolveu a bomba atômica?", options: { A: "Projeto Apolo", B: "Projeto Overlord", C: "Projeto Manhattan", D: "Projeto Trinity" }, answer: "C", difficulty: 'easy' },
    { type: 'multipleChoice', question: "6. Quais os apelidos das bombas que atingiram Hiroshima e Nagasaki, respectivamente?", options: { A: "'Fat Man' e 'Little Boy'", B: "'Little Boy' e 'Fat Man'", C: "'Enola Gay' e 'Bockscar'", D: "'Firestorm' e 'Earthquake'" }, answer: "B", difficulty: 'easy' },
    { type: 'multipleChoice', question: "7. Qual foi a justificativa oficial dos EUA para usar as bombas?", options: { A: "Demonstrar superioridade para a URSS.", B: "Vingar o ataque a Pearl Harbor.", C: "Testar a eficácia da nova arma.", D: "Acelerar o fim da guerra e evitar mais mortes de soldados." }, answer: "D", difficulty: 'easy' },
    { type: 'multipleChoice', question: "8. No poema, os versos 'Pensem nas meninas / Cegas inexatas' referem-se principalmente:", options: { A: "Às dificuldades de locomoção na cidade destruída.", B: "Às sequelas físicas e psicológicas permanentes nos sobreviventes.", C: "À perda de documentos durante a explosão.", D: "A uma crítica à condição da mulher na sociedade japonesa." }, answer: "B", difficulty: 'easy' },
    { type: 'multipleChoice', question: "9. Qual cidade foi o alvo da segunda bomba nuclear?", options: { A: "Tóquio", B: "Quioto", C: "Nagasaki", D: "Osaka" }, answer: "C", difficulty: 'easy' },
    { type: 'multipleChoice', question: "10. O lançamento das bombas deu início a um período de tensão global entre EUA e URSS, conhecido como:", options: { A: "Belle Époque", B: "Guerra Fria", C: "Globalização", D: "Descolonização" }, answer: "B", difficulty: 'easy' },
    { type: 'multipleChoice', question: "11. A citação de Oppenheimer, 'Agora eu me tornei a Morte, o destruidor de mundos', revela:", options: { A: "O orgulho dos cientistas por sua criação invencível.", B: "A indiferença da equipe científica às consequências.", C: "Uma profunda consciência do poder terrível e da responsabilidade moral.", D: "A certeza de que a arma traria uma paz mundial definitiva." }, answer: "C", difficulty: 'hard' },
    { type: 'multipleChoice', question: "12. A metáfora 'A rosa hereditária' no poema aponta para qual consequência da radiação?", options: { A: "A destruição da agricultura local.", B: "A perda da memória histórica.", C: "A transmissão de problemas genéticos e doenças para os descendentes.", D: "A herança de uma dívida de guerra." }, answer: "C", difficulty: 'hard' },
    { type: 'multipleChoice', question: "13. (ENEM 2013) A decisão dos EUA de lançar as bombas atômicas foi construída com base em uma lógica que:", options: { A: "considerava o uso de armas um meio de democratizar o Japão.", B: "priorizava a sobrevida da população civil japonesa.", C: "visava gerar o maior número de vítimas civis para abalar psicologicamente o governo.", D: "partia do princípio de que a guerra só acabaria com a destruição total do inimigo.", E: "previa a necessidade de vingar a qualquer custo a derrota em Pearl Harbor." }, answer: "D", difficulty: 'hard' },
    { type: 'multipleChoice', question: "14. Historiadores críticos afirmam que o verdadeiro alvo do ataque nuclear não era Tóquio, mas Moscou. O que isso significa?", options: { A: "Que os EUA planejavam atacar a União Soviética em seguida.", B: "Que o objetivo era enviar uma mensagem de poderio militar à União Soviética.", C: "Que a URSS havia ajudado secretamente o Japão.", D: "Que os EUA temiam uma aliança entre Japão e URSS." }, answer: "B", difficulty: 'hard' },
    { type: 'multipleChoice', question: "15. Por que era estrategicamente importante para os EUA escolher uma cidade relativamente intacta como Hiroshima?", options: { A: "Para minimizar o número de vítimas civis.", B: "Para permitir uma melhor avaliação dos efeitos e do poder destrutivo da bomba.", C: "Para facilitar o trabalho de equipes de resgate.", D: "Porque o Japão havia solicitado que cidades culturais fossem poupadas." }, answer: "B", difficulty: 'hard' },
    { type: 'multipleChoice', question: "16. Quais são as consequências de longo prazo dos eventos de agosto de 1945? I. A corrida armamentista entre EUA e URSS. II. O surgimento de movimentos pacifistas. III. O Japão adotou uma constituição pacifista. Estão corretas:", options: { A: "I, apenas.", B: "I e II, apenas.", C: "II e III, apenas.", D: "I, II e III." }, answer: "D", difficulty: 'hard' }
];