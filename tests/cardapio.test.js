import test from 'node:test';
import assert from 'node:assert/strict';
import { cadastrarProduto, obterCardapio, obterIngredientes } from '../assets/js/core/api.js';
import { inicializarCadastroProduto } from '../admin/js/prato-form.js';

class ElementoFake {
    constructor(value = '') {
        this.value = value;
        this.textContent = '';
        this.disabled = false;
        this.checked = true;
        this.attributes = {};
        this.children = [];
        this.selectedOptions = [];
        this.classes = new Set();
        this.classList = {
            add: (...classes) => classes.forEach((classe) => this.classes.add(classe)),
            remove: (...classes) => classes.forEach((classe) => this.classes.delete(classe)),
            contains: (classe) => this.classes.has(classe),
        };
    }

    setAttribute(nome, valor) {
        this.attributes[nome] = valor;
    }

    removeAttribute(nome) {
        delete this.attributes[nome];
    }

    replaceChildren(...children) {
        this.children = children;
    }

    add(option) {
        this.children.push(option);
    }

    get options() {
        return this.children;
    }

    addEventListener(evento, callback) {
        assert.equal(evento, 'submit');
        this.enviar = () => callback({ preventDefault() {} });
    }

    reset() {}
}

const elementosPorId = new Map();
globalThis.document = { getElementById: (id) => elementosPorId.get(id) || new ElementoFake() };

function criarFormularioProduto() {
    const campos = {
        nome: new ElementoFake('Bruschetta Italiana'),
        descricao: new ElementoFake('Pão com tomate e manjericão'),
        preco: new ElementoFake('28'),
        categoriaId: new ElementoFake('1'),
        imagemUrl: new ElementoFake('bruschetta.jpg'),
        ingredientes: new ElementoFake(),
        ativo: new ElementoFake(),
    };
    campos.ingredientes.selectedOptions = [{ value: '1' }, { value: '2' }, { value: '5' }];
    const form = new ElementoFake();
    form.elements = { namedItem: (nome) => campos[nome] };
    const alerta = new ElementoFake();
    alerta.classList.add('d-none');
    const sucesso = new ElementoFake();
    sucesso.classList.add('d-none');
    const botao = new ElementoFake();
    elementosPorId.set('ingredientes', campos.ingredientes);
    elementosPorId.set('ingredientes-erro', new ElementoFake());
    elementosPorId.set('preco', campos.preco);
    elementosPorId.set('preco-erro', new ElementoFake());
    elementosPorId.set('categoriaId', campos.categoriaId);
    elementosPorId.set('categoriaId-erro', new ElementoFake());
    elementosPorId.set('nome', campos.nome);
    elementosPorId.set('nome-erro', new ElementoFake());

    return { campos, form, alerta, sucesso, botao };
}

test('cadastra produto enviando JSON e token do administrador', async () => {
    const fetchOriginal = globalThis.fetch;
    const storageOriginal = globalThis.localStorage;
    let requisicao;
    globalThis.localStorage = {
        getItem: () => JSON.stringify({ token: 'token-admin', perfil: 'admin' }),
    };
    globalThis.fetch = async (url, opcoes) => {
        requisicao = { url, opcoes };
        return { ok: true, status: 201, json: async () => ({ id: 10 }) };
    };

    try {
        const produto = {
            nome: 'Bruschetta Italiana',
            descricao: 'Pão com tomate e manjericão',
            preco: 28,
            categoriaId: 1,
            imagemUrl: 'bruschetta.jpg',
            ingredientes: [1, 2, 5],
            ativo: true,
        };
        await cadastrarProduto(produto);
        assert.equal(requisicao.url, '/api/produtos');
        assert.equal(requisicao.opcoes.method, 'POST');
        assert.equal(requisicao.opcoes.headers['Content-Type'], 'application/json');
        assert.equal(requisicao.opcoes.headers.Authorization, 'Bearer token-admin');
        assert.deepEqual(JSON.parse(requisicao.opcoes.body), produto);
    } finally {
        globalThis.fetch = fetchOriginal;
        globalThis.localStorage = storageOriginal;
    }
});

test('obtém cardápio com autenticação', async () => {
    const fetchOriginal = globalThis.fetch;
    const storageOriginal = globalThis.localStorage;
    let requisicao;
    globalThis.localStorage = {
        getItem: () => JSON.stringify({ token: 'token-garcom', perfil: 'garcom' }),
    };
    globalThis.fetch = async (url, opcoes) => {
        requisicao = { url, opcoes };
        return { ok: true, status: 200, json: async () => [] };
    };

    try {
        assert.deepEqual(await obterCardapio(), []);
        assert.equal(requisicao.url, '/api/cardapio');
        assert.equal(requisicao.opcoes.method, 'GET');
        assert.equal(requisicao.opcoes.headers.Authorization, 'Bearer token-garcom');
    } finally {
        globalThis.fetch = fetchOriginal;
        globalThis.localStorage = storageOriginal;
    }
});

test('obtém ingredientes ativos com autenticação', async () => {
    const fetchOriginal = globalThis.fetch;
    const storageOriginal = globalThis.localStorage;
    let requisicao;
    globalThis.localStorage = {
        getItem: () => JSON.stringify({ token: 'token-admin', perfil: 'admin' }),
    };
    globalThis.fetch = async (url, opcoes) => {
        requisicao = { url, opcoes };
        return { ok: true, status: 200, json: async () => [{ id: 1, nome: 'Alho' }] };
    };

    try {
        assert.deepEqual(await obterIngredientes(), [{ id: 1, nome: 'Alho' }]);
        assert.equal(requisicao.url, '/api/ingredientes');
        assert.equal(requisicao.opcoes.method, 'GET');
        assert.equal(requisicao.opcoes.headers.Authorization, 'Bearer token-admin');
    } finally {
        globalThis.fetch = fetchOriginal;
        globalThis.localStorage = storageOriginal;
    }
});

test('carrega categorias e ingredientes e envia os IDs selecionados', async () => {
    const tela = criarFormularioProduto();
    let payload;
    globalThis.Option = class {
        constructor(text, value) {
            this.text = text;
            this.value = value;
        }
    };
    inicializarCadastroProduto({
        ...tela,
        obterCategorias: async () => [{ categoriaId: 1, nome: 'Entradas', produtos: [] }],
        obterListaIngredientes: async () => [{ id: 1, nome: 'Alho' }, { id: 2, nome: 'Tomate' }, { id: 5, nome: 'Manjericão' }],
        cadastrar: async (produto) => { payload = produto; return { id: 10 }; },
    });

    await new Promise((resolve) => setImmediate(resolve));
    await tela.form.enviar();

    assert.deepEqual(payload, {
        nome: 'Bruschetta Italiana',
        descricao: 'Pão com tomate e manjericão',
        preco: 28,
        categoriaId: 1,
        imagemUrl: 'bruschetta.jpg',
        ingredientes: [1, 2, 5],
        ativo: true,
    });
    assert.equal(tela.sucesso.classList.contains('d-none'), false);
});

test('permite descrição e imagem opcionais vazias com ingredientes selecionados', async () => {
    const tela = criarFormularioProduto();
    tela.campos.descricao.value = '';
    tela.campos.imagemUrl.value = '';
    let payload;
    inicializarCadastroProduto({
        ...tela,
        obterCategorias: async () => [{ categoriaId: 1, nome: 'Entradas', produtos: [] }],
        obterListaIngredientes: async () => [{ id: 1, nome: 'Alho' }, { id: 2, nome: 'Tomate' }, { id: 5, nome: 'Manjericão' }],
        cadastrar: async (produto) => { payload = produto; return {}; },
    });

    await new Promise((resolve) => setImmediate(resolve));
    await tela.form.enviar();

    assert.deepEqual(payload, {
        nome: 'Bruschetta Italiana',
        preco: 28,
        categoriaId: 1,
        ingredientes: [1, 2, 5],
        ativo: true,
    });
});

test('exige ao menos um ingrediente antes do envio', async () => {
    const tela = criarFormularioProduto();
    tela.campos.ingredientes.selectedOptions = [];
    let chamadas = 0;
    inicializarCadastroProduto({
        ...tela,
        obterCategorias: async () => [{ categoriaId: 1, nome: 'Entradas', produtos: [] }],
        obterListaIngredientes: async () => [{ id: 1, nome: 'Alho' }],
        cadastrar: async () => { chamadas += 1; },
    });

    await new Promise((resolve) => setImmediate(resolve));
    await tela.form.enviar();

    assert.equal(chamadas, 0);
    assert.equal(elementosPorId.get('ingredientes-erro').textContent, 'Selecione pelo menos um ingrediente.');
});

test('impede IDs de ingrediente repetidos antes do envio', async () => {
    const tela = criarFormularioProduto();
    tela.campos.ingredientes.selectedOptions = [{ value: '1' }, { value: '1' }];
    let chamadas = 0;
    inicializarCadastroProduto({
        ...tela,
        obterCategorias: async () => [{ categoriaId: 1, nome: 'Entradas', produtos: [] }],
        obterListaIngredientes: async () => [{ id: 1, nome: 'Alho' }],
        cadastrar: async () => { chamadas += 1; },
    });

    await new Promise((resolve) => setImmediate(resolve));
    await tela.form.enviar();

    assert.equal(chamadas, 0);
    assert.equal(elementosPorId.get('ingredientes-erro').textContent, 'Não selecione o mesmo ingrediente mais de uma vez.');
});

test('mostra mensagens específicas para erros de ingredientes e produto duplicado', async (context) => {
    const casos = [
        ['INGREDIENTES_OBRIGATORIOS', 'ingredientes-erro', 'Selecione pelo menos um ingrediente.'],
        ['INGREDIENTE_DUPLICADO', 'ingredientes-erro', 'Não selecione o mesmo ingrediente mais de uma vez.'],
        ['INGREDIENTE_NAO_ENCONTRADO', 'ingredientes-erro', 'Um ou mais ingredientes não foram encontrados. Confira os IDs informados.'],
        ['PRODUTO_DUPLICADO', 'produto-alerta', 'Já existe um produto com esse nome.'],
    ];

    for (const [codigo, elemento, mensagem] of casos) {
        await context.test(codigo, async () => {
            const tela = criarFormularioProduto();
            inicializarCadastroProduto({
                ...tela,
                obterCategorias: async () => [{ categoriaId: 1, nome: 'Entradas', produtos: [] }],
                obterListaIngredientes: async () => [{ id: 1, nome: 'Alho' }],
                cadastrar: async () => {
                    throw Object.assign(new Error(codigo), { codigo, status: 400 });
                },
            });

            await new Promise((resolve) => setImmediate(resolve));
            await tela.form.enviar();

            if (elemento === 'produto-alerta') {
                assert.equal(tela.alerta.textContent, mensagem);
            } else {
                assert.equal(elementosPorId.get(elemento).textContent, mensagem);
            }
        });
    }
});
