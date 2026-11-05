import test from 'node:test';
import assert from 'node:assert/strict';
import { cadastrarProduto, obterCardapio } from '../assets/js/core/api.js';
import { inicializarCadastroProduto } from '../admin/js/prato-form.js';

class ElementoFake {
    constructor(value = '') {
        this.value = value;
        this.textContent = '';
        this.disabled = false;
        this.checked = true;
        this.attributes = {};
        this.children = [];
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

    addEventListener(evento, callback) {
        assert.equal(evento, 'submit');
        this.enviar = () => callback({ preventDefault() {} });
    }

    reset() {}
}

globalThis.document = { getElementById: () => new ElementoFake() };

function criarFormularioProduto() {
    const campos = {
        nome: new ElementoFake('Bruschetta Italiana'),
        descricao: new ElementoFake('Pão com tomate e manjericão'),
        preco: new ElementoFake('28'),
        categoriaId: new ElementoFake('1'),
        imagemUrl: new ElementoFake('bruschetta.jpg'),
        ingredientes: new ElementoFake('1, 2, 5'),
        ativo: new ElementoFake(),
    };
    const form = new ElementoFake();
    form.elements = { namedItem: (nome) => campos[nome] };
    const alerta = new ElementoFake();
    alerta.classList.add('d-none');
    const sucesso = new ElementoFake();
    sucesso.classList.add('d-none');
    const botao = new ElementoFake();

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

test('usa categorias do cardápio e envia os campos opcionais quando preenchidos', async () => {
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

test('omite campos opcionais vazios ao cadastrar produto', async () => {
    const tela = criarFormularioProduto();
    tela.campos.descricao.value = '';
    tela.campos.imagemUrl.value = '';
    tela.campos.ingredientes.value = '';
    let payload;
    inicializarCadastroProduto({
        ...tela,
        obterCategorias: async () => [{ categoriaId: 1, nome: 'Entradas', produtos: [] }],
        cadastrar: async (produto) => { payload = produto; return {}; },
    });

    await new Promise((resolve) => setImmediate(resolve));
    await tela.form.enviar();

    assert.deepEqual(payload, {
        nome: 'Bruschetta Italiana',
        preco: 28,
        categoriaId: 1,
        ativo: true,
    });
});
