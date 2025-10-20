var express = require('express');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var fs = require('fs');
var path = require('path');
var app = express();

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(methodOverride('_method')); 
app.use(express.static(path.join(__dirname, 'public')));

// ----------------------------------------------------------------
// CONFIGURAÇÃO DE PERSISTÊNCIA E DADOS GLOBAIS
// ----------------------------------------------------------------

// Mapeamento dos arquivos JSON e suas variáveis globais correspondentes
const DATA_CONFIG = {
    dadosBasicos: { file: 'dadosBasicos.json', data: {} }, // Singleton (Objeto Único)
    cursos: { file: 'cursos.json', data: [] }, // Lista
    projetos: { file: 'projetos.json', data: [] }, // Lista
    competencias: { file: 'competencias.json', data: [] }, // Lista
    redesSociais: { file: 'redesSociais.json', data: {} } // Singleton
};

// Objeto para armazenar todos os dados carregados
let dataStore = {};

// Função Genérica para carregar dados
function carregarDados(key) {
    const config = DATA_CONFIG[key];
    const filePath = path.join(__dirname, 'data', config.file);
    const isList = Array.isArray(config.data);
    const initialData = isList ? '[]' : '{}';

    try {
        const data = fs.readFileSync(filePath, 'utf8');
        dataStore[key] = JSON.parse(data); // Armazena na nova estrutura dataStore
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

// Função Genérica para salvar dados
function salvarDados(key) {
    const config = DATA_CONFIG[key];
    const filePath = path.join(__dirname, 'data', config.file);
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
// ROTAS DO SERVIDOR
// ----------------------------------------------------------------

// Rota principal que exibe a página única com todos os dados
app.get('/', function(req, res) {
    // Passamos a estrutura completa de dados
    res.render('index', { 
        // Desestruturamos para o EJS acessar facilmente (ex: dadosBasicos.nome)
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

// GET: Formulário de Edição (Dados Básicos)
app.get('/basicos/editar', function(req, res) {
    res.render('edit_basicos', { item: dataStore.dadosBasicos });
});

// PUT: Atualiza Dados Básicos
app.put('/basicos', function(req, res) {
    // Sobrescreve o objeto completo.
    dataStore.dadosBasicos = req.body.item; 
    salvarDados('dadosBasicos'); 
    res.redirect('/');
});


// ----------------------------------------------------------------
// Rota de Escuta
// ----------------------------------------------------------------

app.listen(3000, function() {
    console.log("Servidor rodando na porta 3000");
});