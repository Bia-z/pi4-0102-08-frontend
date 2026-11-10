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
        ativo: new ElementoFake(),
    };
    const form = new ElementoFake();
    form.elements = { namedItem: (nome) => campos[nome] };
    const alerta = new ElementoFake();
    alerta.classList.add('d-none');
    const sucesso = new ElementoFake();
    sucesso.classList.add('d-none');
    const botao = new ElementoFake();
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

test('carrega as categorias e envia o produto com a categoria escolhida', async () => {
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
        ativo: true,
    });
    assert.equal(tela.sucesso.classList.contains('d-none'), false);
});

test('permite descrição e imagem opcionais vazias', async () => {
    const tela = criarFormularioProduto();
    tela.campos.descricao.value = '';
    tela.campos.imagemUrl.value = '';
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

test('a categoria Adicionais aparece no seletor e pode ser escolhida no cadastro', async () => {
    const tela = criarFormularioProduto();
    tela.campos.nome.value = 'Queijo Extra';
    tela.campos.preco.value = '6';
    tela.campos.categoriaId.value = '4';
    tela.campos.descricao.value = '';
    tela.campos.imagemUrl.value = '';
    let payload;
    globalThis.Option = class {
        constructor(text, value) {
            this.text = text;
            this.value = value;
        }
    };
    inicializarCadastroProduto({
        ...tela,
        obterCategorias: async () => [
            { categoriaId: 2, nome: 'Pratos principais', produtos: [] },
            { categoriaId: 3, nome: 'Sobremesas', produtos: [] },
            { categoriaId: 4, nome: 'Adicionais', produtos: [] },
        ],
        cadastrar: async (produto) => { payload = produto; return { id: 11, nome: produto.nome }; },
    });

    await new Promise((resolve) => setImmediate(resolve));

    assert.deepEqual(
        tela.campos.categoriaId.options.map((opcao) => opcao.text),
        ['Selecione uma categoria', 'Pratos principais', 'Sobremesas', 'Adicionais'],
    );

    await tela.form.enviar();

    assert.deepEqual(payload, {
        nome: 'Queijo Extra',
        preco: 6,
        categoriaId: 4,
        ativo: true,
    });
});

test('mostra mensagens específicas para produto duplicado e categoria inexistente', async (context) => {
    const casos = [
        ['PRODUTO_DUPLICADO', 'produto-alerta', 'Já existe um produto com esse nome.'],
        ['CATEGORIA_NAO_ENCONTRADA', 'categoriaId-erro',
            'A categoria selecionada não foi encontrada. Atualize as categorias e tente novamente.'],
    ];

    for (const [codigo, elemento, mensagem] of casos) {
        await context.test(codigo, async () => {
            const tela = criarFormularioProduto();
            inicializarCadastroProduto({
                ...tela,
                obterCategorias: async () => [{ categoriaId: 1, nome: 'Entradas', produtos: [] }],
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
