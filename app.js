var express = require('express');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var fs = require('fs');
var path = require('path');
var app = express();

// ----------------------------------------------------------------
// MIDDLEWARE E CONFIGURAÇÕES
// ----------------------------------------------------------------
app.set('view engine', 'ejs');
// Necessário para processar dados de formulário (x-www-form-urlencoded)
app.use(bodyParser.urlencoded({ extended: true }));
// Necessário para processar JSON (útil para POST/PUT via Postman)
app.use(express.json()); 
// Permite usar _method=PUT/DELETE em formulários HTML
app.use(methodOverride('_method')); 
// Serve arquivos estáticos da pasta public (CSS, JS, Imagens)
app.use(express.static(path.join(__dirname, 'public')));


// ----------------------------------------------------------------
// CONFIGURAÇÃO DE PERSISTÊNCIA E DADOS GLOBAIS
// ----------------------------------------------------------------

const DATA_CONFIG = {
    dadosBasicos: { file: 'dadosBasicos.json', data: {} }, 
    cursos: { file: 'cursos.json', data: [] }, 
    projetos: { file: 'projetos.json', data: [] }, 
    competencias: { file: 'competencias.json', data: [] },
    redesSociais: { file: 'redesSociais.json', data: {} } 
};

let dataStore = {};

// Função Genérica para carregar dados (Mantida)
function carregarDados(key) {
    const config = DATA_CONFIG[key];
    const filePath = path.join(__dirname, 'data', config.file);
    const isList = Array.isArray(config.data);
    const initialData = isList ? '[]' : '{}';

    try {
        const data = fs.readFileSync(filePath, 'utf8');
        dataStore[key] = JSON.parse(data);
        console.log(`Dados carregados: ${key}`);
    } catch (err) {
        if (err.code === 'ENOENT') {
            fs.writeFileSync(filePath, initialData, 'utf8');
            dataStore[key] = JSON.parse(initialData);
            console.log(`Arquivo criado: ${key}`);
        } else {
            dataStore[key] = JSON.parse(initialData);
            console.error(`Erro ao carregar ${key}. Iniciando com valor padrão.`, err);
        }
    }
}

// Função Genérica para salvar dados (Mantida)
function salvarDados(key) {
    const filePath = path.join(__dirname, 'data', DATA_CONFIG[key].file);
    try {
        const data = JSON.stringify(dataStore[key], null, 2);
        fs.writeFileSync(filePath, data, 'utf8');
        console.log(`Dados salvos: ${key}`);
    } catch (err) {
        console.error(`Erro ao salvar ${key}:`, err);
    }
}

// Carrega todos os dados ao iniciar o servidor
Object.keys(DATA_CONFIG).forEach(carregarDados);


// ----------------------------------------------------------------
// FUNÇÕES AUXILIARES DE CRUD PARA LISTAS (Arrays)
// ----------------------------------------------------------------

// Gera o próximo ID para uma lista
function getNextId(array) {
    if (array.length === 0) return 1;
    // Encontra o maior ID e adiciona 1
    const maxId = Math.max(...array.map(item => item.id));
    return maxId + 1;
}

// Encontra um item pelo ID
function findItem(key, id) {
    return dataStore[key].find(item => item.id === parseInt(id));
}

// ----------------------------------------------------------------
// ROTAS DO SERVIDOR
// ----------------------------------------------------------------

// Rota principal (READ ALL)
app.get('/', function(req, res) {
    res.render('index', { 
        dadosBasicos: dataStore.dadosBasicos, 
        redesSociais: dataStore.redesSociais,
        projetos: dataStore.projetos,
        cursos: dataStore.cursos,
        competencias: dataStore.competencias
    });
});

// ----------------------------------------------------------------
// ROTAS DE UPDATE ÚNICO (Singleton: dadosBasicos e redesSociais)
// ----------------------------------------------------------------

// PUT: Atualiza Dados Básicos (Mantida)
app.put('/basicos', function(req, res) {
    dataStore.dadosBasicos = req.body.item; 
    salvarDados('dadosBasicos'); 
    res.redirect('/');
});

// PUT: Atualiza Redes Sociais (Nova)
app.put('/redes', function(req, res) {
    dataStore.redesSociais = req.body.item; 
    salvarDados('redesSociais'); 
    res.redirect('/');
});


// ----------------------------------------------------------------
// ROTAS GENÉRICAS DE CRUD PARA LISTAS (cursos, projetos, competencias)
// ----------------------------------------------------------------

['cursos', 'projetos', 'competencias'].forEach(key => {
    
    // Rota GET /KEY (Ex: /projetos) - Retorna todos os dados em JSON (Útil para API)
    app.get(`/${key}`, (req, res) => {
        res.json(dataStore[key]);
    });

    // Rota GET /KEY/:id (Ex: /projetos/1) - Retorna item específico (READ by ID)
    app.get(`/${key}/:id`, (req, res) => {
        const item = findItem(key, req.params.id);
        if (item) {
            res.json(item);
        } else {
            res.status(404).json({ message: 'Item não encontrado' });
        }
    });
    
    // Rota POST /KEY (Ex: /projetos) - Cria um novo item
    app.post(`/${key}`, (req, res) => {
        // Assume que o corpo da requisição tem um objeto 'item' com os novos dados
        const newItem = req.body.item || req.body; 
        
        // Verifica se é uma lista válida
        if (!Array.isArray(dataStore[key])) {
             return res.status(500).json({ message: `Erro: ${key} não é uma lista.` });
        }

        // Adiciona um ID e empurra para a lista
        newItem.id = getNextId(dataStore[key]);
        dataStore[key].push(newItem);
        salvarDados(key);

        // Retorna o item criado com status 201 (Created)
        res.status(201).json(newItem);
    });

    // Rota PUT /KEY/:id (Ex: /projetos/1) - Atualiza um item
    app.put(`/${key}/:id`, (req, res) => {
        const id = parseInt(req.params.id);
        const index = dataStore[key].findIndex(item => item.id === id);
        
        if (index !== -1) {
            const updatedData = req.body.item || req.body;
            // Mantém o ID original
            updatedData.id = id; 
            dataStore[key][index] = updatedData;
            salvarDados(key);
            res.json({ message: 'Item atualizado com sucesso', item: updatedData });
        } else {
            res.status(404).json({ message: 'Item não encontrado' });
        }
    });

    // Rota DELETE /KEY/:id (Ex: /projetos/1) - Deleta um item
    app.delete(`/${key}/:id`, (req, res) => {
        const id = parseInt(req.params.id);
        const initialLength = dataStore[key].length;
        
        // Filtra a lista, removendo o item com o ID
        dataStore[key] = dataStore[key].filter(item => item.id !== id);
        
        if (dataStore[key].length < initialLength) {
            salvarDados(key);
            res.json({ message: 'Item deletado com sucesso' });
        } else {
            res.status(404).json({ message: 'Item não encontrado' });
        }
    });
});


// ----------------------------------------------------------------
// Rota de Escuta
// ----------------------------------------------------------------

app.listen(3000, function() {
    console.log("Servidor rodando na porta 3000");
});