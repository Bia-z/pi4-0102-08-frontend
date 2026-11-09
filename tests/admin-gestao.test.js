import test from 'node:test';
import assert from 'node:assert/strict';
import {
    atualizarIngrediente,
    atualizarProduto,
    atualizarUsuario,
    cadastrarIngrediente,
    desativarIngrediente,
    desativarProduto,
    desativarUsuario,
    listarIngredientesGerenciamento,
    listarProdutos,
    listarUsuarios,
} from '../assets/js/core/api.js';
import { formatarMoeda } from '../assets/js/core/format.js';
import { inicializarListaFuncionarios } from '../admin/js/funcionarios.js';
import { inicializarCadastroFuncionario } from '../admin/js/funcionario-form.js';
import { inicializarListaItens } from '../admin/js/itens.js';
import { inicializarEdicaoItem } from '../admin/js/item-editar.js';
import { inicializarListaIngredientes } from '../admin/js/ingredientes.js';
import { inicializarFormIngrediente } from '../admin/js/ingrediente-form.js';

class Elemento {
    constructor(tag = 'div', value = '') {
        this.tagName = tag;
        this.value = value;
        this.textContent = '';
        this.className = '';
        this.disabled = false;
        this.checked = false;
        this.attributes = {};
        this.children = [];
        this.handlers = {};
        this.classes = new Set();
        this.classList = {
            add: (...classes) => classes.forEach((classe) => this.classes.add(classe)),
            remove: (...classes) => classes.forEach((classe) => this.classes.delete(classe)),
            contains: (classe) => this.classes.has(classe),
        };
    }

    setAttribute(nome, valor) { this.attributes[nome] = valor; }
    removeAttribute(nome) { delete this.attributes[nome]; }
    append(...elementos) { this.children.push(...elementos); }
    replaceChildren(...elementos) { this.children = elementos; }
    add(opcao) { this.children.push(opcao); }
    get options() { return this.children; }
    get selectedOptions() { return this.children.filter((opcao) => opcao.selected); }
    addEventListener(evento, callback) { this.handlers[evento] = callback; }
    clicar() { return this.handlers.click({ preventDefault() {} }); }
    enviar() { return this.handlers.submit({ preventDefault() {} }); }
    reset() {}
}

class OpcaoFake {
    constructor(texto, valor = '', padrao = false, selecionada = false) {
        this.textContent = texto;
        this.value = valor;
        this.selected = selecionada;
    }
}

globalThis.Option = OpcaoFake;

function instalarDocumento(ids = new Map()) {
    globalThis.document = {
        getElementById: (id) => ids.get(id),
        createElement: (tag) => new Elemento(tag),
    };
    return ids;
}

function alertaFake() {
    const alerta = new Elemento();
    alerta.classList.add('d-none');
    return alerta;
}

function descendentes(elemento, filtro, achados = []) {
    (elemento.children || []).forEach((filho) => {
        if (filtro(filho)) achados.push(filho);
        descendentes(filho, filtro, achados);
    });
    return achados;
}

const botoes = (linha, texto) => descendentes(
    linha,
    (el) => el.tagName === 'button' && el.textContent === texto,
);
const links = (linha) => descendentes(linha, (el) => el.tagName === 'a');
const textosDaLinha = (linha) => linha.children.map((celula) => celula.textContent);

async function comFetch(resposta, corpo) {
    const fetchOriginal = globalThis.fetch;
    const storageOriginal = globalThis.localStorage;
    const chamadas = [];
    globalThis.localStorage = {
        getItem: () => JSON.stringify({ token: 'token-admin', perfil: 'admin' }),
    };
    globalThis.fetch = async (url, opcoes) => {
        chamadas.push({ url, opcoes });
        return resposta;
    };
    try {
        await corpo(chamadas);
    } finally {
        globalThis.fetch = fetchOriginal;
        globalThis.localStorage = storageOriginal;
    }
}

// ---------------------------------------------------------------- API

test('funções de funcionário usam GET, PUT e DELETE autenticados', async () => {
    await comFetch({ ok: true, status: 200, json: async () => ({ id: 5 }) }, async (chamadas) => {
        await listarUsuarios();
        await atualizarUsuario(5, { nome: 'Ana', ativo: true });
        await comFetch({ ok: true, status: 204, json: async () => { throw new Error('sem corpo'); } }, async (apagadas) => {
            await desativarUsuario(5);
            assert.equal(apagadas[0].url, '/api/usuarios/5');
            assert.equal(apagadas[0].opcoes.method, 'DELETE');
            assert.ok(apagadas[0].opcoes.headers.Authorization.endsWith('token-admin'));
        });

        assert.equal(chamadas[0].url, '/api/usuarios');
        assert.equal(chamadas[0].opcoes.method, 'GET');
        assert.equal(chamadas[1].url, '/api/usuarios/5');
        assert.equal(chamadas[1].opcoes.method, 'PUT');
        assert.equal(chamadas[1].opcoes.headers['Content-Type'], 'application/json');
        assert.deepEqual(JSON.parse(chamadas[1].opcoes.body), { nome: 'Ana', ativo: true });
    });
});

test('funções de item e ingrediente chamam os endpoints do backend', async () => {
    await comFetch({ ok: true, status: 200, json: async () => ({}) }, async (chamadas) => {
        await listarProdutos();
        await atualizarProduto(7, { nome: 'Pizza' });
        await desativarProduto(7);
        await listarIngredientesGerenciamento();
        await cadastrarIngrediente({ nome: 'Queijo' });
        await atualizarIngrediente(3, { nome: 'Queijo', ativo: false });
        await desativarIngrediente(3);

        assert.deepEqual(
            chamadas.map(({ url, opcoes }) => `${opcoes.method} ${url}`),
            [
                'GET /api/produtos',
                'PUT /api/produtos/7',
                'DELETE /api/produtos/7',
                'GET /api/ingredientes/gerenciamento',
                'POST /api/ingredientes',
                'PUT /api/ingredientes/3',
                'DELETE /api/ingredientes/3',
            ],
        );
        assert.deepEqual(JSON.parse(chamadas[5].opcoes.body), { nome: 'Queijo', ativo: false });
    });
});

test('formata valores em reais', () => {
    assert.equal(formatarMoeda(28).replace(/\s/g, ' '), 'R$ 28,00');
    assert.equal(formatarMoeda('abc'), '—');
});

// ---------------------------------------------------------------- lista de funcionários

const FUNCIONARIOS = [
    { id: 1, codigo: 'ADMIN001', nome: 'Admin', email: null, cpf: '52998224725', telefone: '11999999999', perfil: 'admin', ativo: true },
    { id: 2, codigo: 'FUNC002', nome: 'Joana', email: 'j@x.com', cpf: '11144477735', telefone: '11988887777', perfil: 'garcom', ativo: true },
    { id: 3, codigo: 'FUNC003', nome: 'Caio', email: null, cpf: '39053344705', telefone: '11977776666', perfil: 'cozinha', ativo: false },
];

function telaFuncionarios(extra = {}) {
    instalarDocumento();
    const tabela = new Elemento('tbody');
    const alerta = alertaFake();
    let usuarios = FUNCIONARIOS.map((usuario) => ({ ...usuario }));
    const chamadas = { desativar: [], atualizar: [], listar: 0 };
    const promessa = inicializarListaFuncionarios({
        tabela,
        alerta,
        codigoLogado: 'ADMIN001',
        listar: async () => { chamadas.listar += 1; return usuarios; },
        desativar: async (id) => { chamadas.desativar.push(id); },
        atualizar: async (id, dados) => { chamadas.atualizar.push([id, dados]); },
        confirmar: () => true,
        ...extra,
    });
    return { tabela, alerta, chamadas, promessa, definirUsuarios: (novos) => { usuarios = novos; } };
}

test('lista funcionários com status e bloqueia desativar a própria conta', async () => {
    const tela = telaFuncionarios();
    await tela.promessa;

    assert.equal(tela.tabela.children.length, 3);
    assert.deepEqual(textosDaLinha(tela.tabela.children[1]).slice(0, 4),
        ['FUNC002', 'Joana', 'Garçom', '11988887777']);
    assert.equal(tela.tabela.children[0].children[4].children[0].textContent, 'Ativo');
    assert.equal(tela.tabela.children[2].children[4].children[0].textContent, 'Inativo');
    assert.equal(botoes(tela.tabela.children[0], 'Desativar')[0].disabled, true);
    assert.equal(botoes(tela.tabela.children[1], 'Desativar')[0].disabled, false);
    assert.equal(links(tela.tabela.children[1])[0].attributes.href, '/admin/funcionario-form.html?id=2');
    assert.equal(botoes(tela.tabela.children[2], 'Reativar').length, 1);
});

test('desativa funcionário depois de confirmar e recarrega a lista', async () => {
    const tela = telaFuncionarios();
    await tela.promessa;

    await botoes(tela.tabela.children[1], 'Desativar')[0].clicar();

    assert.deepEqual(tela.chamadas.desativar, [2]);
    assert.equal(tela.chamadas.listar, 2);
});

test('não desativa funcionário quando a confirmação é recusada', async () => {
    const tela = telaFuncionarios({ confirmar: () => false });
    await tela.promessa;

    await botoes(tela.tabela.children[1], 'Desativar')[0].clicar();

    assert.deepEqual(tela.chamadas.desativar, []);
    assert.equal(tela.chamadas.listar, 1);
});

test('reativa funcionário reenviando os dados com ativo verdadeiro e sem senha', async () => {
    const tela = telaFuncionarios();
    await tela.promessa;

    await botoes(tela.tabela.children[2], 'Reativar')[0].clicar();

    assert.deepEqual(tela.chamadas.atualizar, [[3, {
        codigo: 'FUNC003',
        nome: 'Caio',
        email: null,
        cpf: '39053344705',
        telefone: '11977776666',
        perfil: 'cozinha',
        ativo: true,
    }]]);
});

test('mostra a mensagem do último administrador ao falhar a desativação', async () => {
    const tela = telaFuncionarios({
        desativar: async () => { throw Object.assign(new Error('x'), { codigo: 'ULTIMO_ADMINISTRADOR_ATIVO' }); },
    });
    await tela.promessa;

    await botoes(tela.tabela.children[1], 'Desativar')[0].clicar();

    assert.match(tela.alerta.textContent, /último administrador/);
    assert.equal(tela.alerta.classes.has('d-none'), false);
});

// ---------------------------------------------------------------- edição de funcionário

function formularioEdicao({ listar, atualizar }) {
    const nomes = ['nome', 'email', 'cpf', 'telefone', 'codigo', 'perfil', 'senha', 'confirmar-senha', 'ativo'];
    const campos = Object.fromEntries(nomes.map((nome) => [nome, new Elemento('input')]));
    campos.email.type = 'email';
    campos.email.checkValidity = () => true;
    const form = new Elemento('form');
    form.elements = { namedItem: (nome) => campos[nome] };
    form.reset = () => { throw new Error('a edição não deve limpar o formulário'); };
    const ids = instalarDocumento(new Map([
        ['cadastro-resumo', new Elemento('dl')],
        ...Object.entries(campos),
        ...nomes.map((nome) => [`${nome}-erro`, new Elemento()]),
    ]));
    const alerta = alertaFake();
    const sucesso = alertaFake();
    const botao = new Elemento('button');
    const carregamento = inicializarCadastroFuncionario({
        form, alerta, sucesso, botao, usuarioId: 2, listar, atualizar,
    });
    return { campos, form, alerta, sucesso, botao, ids, carregamento };
}

test('edição carrega o funcionário e salva sem exigir nova senha', async () => {
    let enviado;
    const tela = formularioEdicao({
        listar: async () => FUNCIONARIOS,
        atualizar: async (id, dados) => {
            enviado = { id, dados: { ...dados } };
            return { ...FUNCIONARIOS[1], nome: 'Joana Souza' };
        },
    });
    await tela.carregamento;

    assert.equal(tela.campos.nome.value, 'Joana');
    assert.equal(tela.campos.codigo.value, 'FUNC002');
    assert.equal(tela.campos.perfil.value, 'garcom');
    assert.equal(tela.campos.ativo.checked, true);
    assert.equal(tela.botao.disabled, false);

    tela.campos.nome.value = 'Joana Souza';
    await tela.form.enviar();

    assert.equal(enviado.id, 2);
    assert.deepEqual(enviado.dados, {
        nome: 'Joana Souza',
        cpf: '11144477735',
        telefone: '11988887777',
        perfil: 'garcom',
        codigo: 'FUNC002',
        ativo: true,
        email: 'j@x.com',
    });
    assert.equal(tela.sucesso.classes.has('d-none'), false);
    assert.equal(tela.campos.nome.value, 'Joana Souza');
});

test('edição envia a senha apenas quando uma nova é digitada e confirmada', async () => {
    let enviado;
    const tela = formularioEdicao({
        listar: async () => FUNCIONARIOS,
        atualizar: async (id, dados) => { enviado = { ...dados }; return FUNCIONARIOS[1]; },
    });
    await tela.carregamento;

    tela.campos.senha.value = 'nova-senha';
    tela.campos['confirmar-senha'].value = 'outra-coisa';
    await tela.form.enviar();
    assert.equal(enviado, undefined);
    assert.equal(tela.ids.get('confirmar-senha-erro').textContent, 'As senhas não coincidem.');

    tela.campos.senha.value = 'nova-senha';
    tela.campos['confirmar-senha'].value = 'nova-senha';
    await tela.form.enviar();
    assert.equal(enviado.senha, 'nova-senha');
});

test('edição mostra o erro ao tentar desativar a própria conta', async () => {
    const tela = formularioEdicao({
        listar: async () => FUNCIONARIOS,
        atualizar: async () => { throw Object.assign(new Error('x'), { codigo: 'ADMINISTRADOR_NAO_PODE_SE_DESATIVAR' }); },
    });
    await tela.carregamento;

    tela.campos.ativo.checked = false;
    await tela.form.enviar();

    assert.match(tela.alerta.textContent, /própria conta/);
    assert.equal(tela.botao.disabled, false);
});

test('edição avisa quando o funcionário não existe mais', async () => {
    const tela = formularioEdicao({ listar: async () => [], atualizar: async () => ({}) });
    await tela.carregamento;

    assert.match(tela.alerta.textContent, /não encontrado/);
    assert.equal(tela.botao.disabled, true);
});

// ---------------------------------------------------------------- itens

const PRODUTOS = [
    { id: 10, nome: 'Bruschetta', descricao: 'Pão e tomate', preco: 28, categoriaId: 1, imagemUrl: 'b.jpg', ativo: true, ingredientes: [1, 2] },
    { id: 11, nome: 'Suco', descricao: null, preco: 9.5, categoriaId: 2, imagemUrl: null, ativo: false, ingredientes: [3] },
];

test('lista itens com categoria, preço e ações de editar e desativar', async () => {
    instalarDocumento();
    const tabela = new Elemento('tbody');
    const chamadas = { desativar: [], atualizar: [] };
    await inicializarListaItens({
        tabela,
        alerta: alertaFake(),
        listar: async () => PRODUTOS,
        obterCategorias: async () => [{ categoriaId: 1, nome: 'Entradas', produtos: [] }],
        desativar: async (id) => { chamadas.desativar.push(id); },
        atualizar: async (id, dados) => { chamadas.atualizar.push([id, dados]); },
        confirmar: () => true,
    });

    assert.equal(tabela.children.length, 2);
    const [nome, categoria, preco] = textosDaLinha(tabela.children[0]);
    assert.equal(nome, 'Bruschetta');
    assert.equal(categoria, 'Entradas');
    assert.equal(preco.replace(/\s/g, ' '), 'R$ 28,00');
    assert.equal(textosDaLinha(tabela.children[1])[1], '—');
    assert.equal(links(tabela.children[0])[0].attributes.href, '/admin/item-editar.html?id=10');

    await botoes(tabela.children[0], 'Desativar')[0].clicar();
    await botoes(tabela.children[1], 'Reativar')[0].clicar();

    assert.deepEqual(chamadas.desativar, [10]);
    assert.deepEqual(chamadas.atualizar, [[11, {
        nome: 'Suco',
        descricao: null,
        preco: 9.5,
        categoriaId: 2,
        imagemUrl: null,
        ingredientes: [3],
        ativo: true,
    }]]);
});

test('a lista de itens aparece mesmo se o cardápio falhar', async () => {
    instalarDocumento();
    const tabela = new Elemento('tbody');
    await inicializarListaItens({
        tabela,
        alerta: alertaFake(),
        listar: async () => PRODUTOS,
        obterCategorias: async () => { throw new Error('cardapio fora'); },
    });

    assert.equal(tabela.children.length, 2);
    assert.equal(textosDaLinha(tabela.children[0])[1], '—');
});

// ---------------------------------------------------------------- edição de item

const CATEGORIAS = [
    { categoriaId: 1, nome: 'Entradas', produtos: [] },
    { categoriaId: 2, nome: 'Bebidas', produtos: [] },
];
const INGREDIENTES = [
    { id: 1, nome: 'Tomate', ativo: false },
    { id: 2, nome: 'Manjericão', ativo: true },
    { id: 3, nome: 'Queijo', ativo: true },
    { id: 4, nome: 'Anchova', ativo: false },
];

function telaEdicaoItem({ atualizar = async () => ({ nome: 'Bruschetta' }), produtos = PRODUTOS } = {}) {
    const campos = {
        nome: new Elemento('input'),
        descricao: new Elemento('textarea'),
        preco: new Elemento('input'),
        categoriaId: new Elemento('select'),
        imagemUrl: new Elemento('input'),
        ingredientes: new Elemento('select'),
        ativo: new Elemento('input'),
    };
    const form = new Elemento('form');
    form.classList.add('d-none');
    form.elements = { namedItem: (nome) => campos[nome] };
    instalarDocumento(new Map([
        ...Object.entries(campos),
        ...['nome', 'preco', 'categoriaId', 'ingredientes'].map((nome) => [`${nome}-erro`, new Elemento()]),
    ]));
    const alerta = alertaFake();
    const sucesso = alertaFake();
    const botao = new Elemento('button');
    botao.disabled = true;
    const carregamento = inicializarEdicaoItem({
        form,
        alerta,
        sucesso,
        botao,
        produtoId: 10,
        listarItens: async () => produtos,
        obterCategorias: async () => CATEGORIAS,
        listarTodosIngredientes: async () => INGREDIENTES,
        atualizar,
    });
    return { campos, form, alerta, sucesso, botao, carregamento };
}

test('edição de item mostra ingrediente inativo já usado e esconde os demais inativos', async () => {
    const tela = telaEdicaoItem();
    await tela.carregamento;

    assert.equal(tela.campos.nome.value, 'Bruschetta');
    assert.equal(tela.campos.preco.value, '28');
    assert.equal(tela.campos.categoriaId.value, '1');
    assert.equal(tela.form.classes.has('d-none'), false);
    assert.equal(tela.botao.disabled, false);

    const opcoes = tela.campos.ingredientes.options;
    assert.deepEqual(opcoes.map((opcao) => opcao.textContent),
        ['Tomate (inativo)', 'Manjericão', 'Queijo']);
    assert.deepEqual(tela.campos.ingredientes.selectedOptions.map((opcao) => opcao.value), ['1', '2']);
});

test('edição de item salva mantendo o ingrediente inativo marcado', async () => {
    let enviado;
    const tela = telaEdicaoItem({
        atualizar: async (id, dados) => { enviado = { id, dados: { ...dados } }; return { nome: 'Bruschetta Nova' }; },
    });
    await tela.carregamento;

    tela.campos.nome.value = ' Bruschetta Nova ';
    tela.campos.preco.value = '30.5';
    await tela.form.enviar();

    assert.deepEqual(enviado, {
        id: 10,
        dados: {
            nome: 'Bruschetta Nova',
            preco: 30.5,
            categoriaId: 1,
            ingredientes: [1, 2],
            ativo: true,
            descricao: 'Pão e tomate',
            imagemUrl: 'b.jpg',
        },
    });
    assert.match(tela.sucesso.textContent, /Bruschetta Nova.*atualizado/);
});

test('edição de item exige ingrediente e preço válidos antes de enviar', async () => {
    let chamou = false;
    const tela = telaEdicaoItem({ atualizar: async () => { chamou = true; return {}; } });
    await tela.carregamento;

    tela.campos.ingredientes.options.forEach((opcao) => { opcao.selected = false; });
    tela.campos.preco.value = '0';
    await tela.form.enviar();

    assert.equal(chamou, false);
});

test('edição de item mostra o erro de ingrediente no campo certo', async () => {
    const tela = telaEdicaoItem({
        atualizar: async () => { throw Object.assign(new Error('x'), { codigo: 'INGREDIENTE_NAO_ENCONTRADO' }); },
    });
    await tela.carregamento;

    await tela.form.enviar();

    assert.equal(tela.campos.ingredientes.classes.has('is-invalid'), true);
    assert.equal(tela.botao.disabled, false);
});

test('edição de item avisa quando o item não existe', async () => {
    const tela = telaEdicaoItem({ produtos: [] });
    await tela.carregamento;

    assert.match(tela.alerta.textContent, /não encontrado/);
    assert.equal(tela.form.classes.has('d-none'), true);
});

// ---------------------------------------------------------------- ingredientes

const LISTA_INGREDIENTES = [
    { id: 1, nome: 'Tomate', ativo: true },
    { id: 4, nome: 'Anchova', ativo: false },
];

test('lista ingredientes com desativar e reativar', async () => {
    instalarDocumento();
    const tabela = new Elemento('tbody');
    const chamadas = { desativar: [], atualizar: [] };
    await inicializarListaIngredientes({
        tabela,
        alerta: alertaFake(),
        listar: async () => LISTA_INGREDIENTES,
        desativar: async (id) => { chamadas.desativar.push(id); },
        atualizar: async (id, dados) => { chamadas.atualizar.push([id, dados]); },
        confirmar: () => true,
    });

    assert.equal(tabela.children.length, 2);
    assert.equal(links(tabela.children[0])[0].attributes.href, '/admin/ingrediente-form.html?id=1');

    await botoes(tabela.children[0], 'Desativar')[0].clicar();
    await botoes(tabela.children[1], 'Reativar')[0].clicar();

    assert.deepEqual(chamadas.desativar, [1]);
    assert.deepEqual(chamadas.atualizar, [[4, { nome: 'Anchova', ativo: true }]]);
});

function formularioIngrediente(opcoes = {}) {
    const campos = { nome: new Elemento('input'), ativo: new Elemento('input') };
    const form = new Elemento('form');
    form.elements = { namedItem: (nome) => campos[nome] };
    form.reset = () => { campos.nome.value = ''; };
    instalarDocumento(new Map([['nome-erro', new Elemento()]]));
    const alerta = alertaFake();
    const sucesso = alertaFake();
    const botao = new Elemento('button');
    const carregamento = inicializarFormIngrediente({ form, alerta, sucesso, botao, ...opcoes });
    return { campos, form, alerta, sucesso, botao, carregamento };
}

test('cadastra ingrediente e limpa o formulário', async () => {
    let enviado;
    const tela = formularioIngrediente({
        cadastrar: async (dados) => { enviado = { ...dados }; return { id: 9, nome: dados.nome, ativo: true }; },
    });
    tela.campos.nome.value = '  Rúcula ';
    await tela.form.enviar();

    assert.deepEqual(enviado, { nome: 'Rúcula' });
    assert.equal(tela.campos.nome.value, '');
    assert.match(tela.sucesso.textContent, /Rúcula.*cadastrado/);
});

test('edita ingrediente carregando os dados e enviando o status', async () => {
    let enviado;
    const tela = formularioIngrediente({
        ingredienteId: 4,
        listar: async () => LISTA_INGREDIENTES,
        atualizar: async (id, dados) => { enviado = { id, dados: { ...dados } }; return { nome: dados.nome }; },
    });
    await tela.carregamento;

    assert.equal(tela.campos.nome.value, 'Anchova');
    assert.equal(tela.campos.ativo.checked, false);

    tela.campos.ativo.checked = true;
    await tela.form.enviar();

    assert.deepEqual(enviado, { id: 4, dados: { nome: 'Anchova', ativo: true } });
    assert.match(tela.sucesso.textContent, /atualizado/);
    assert.equal(tela.campos.nome.value, 'Anchova');
});

test('ingrediente com nome repetido marca o campo nome', async () => {
    const tela = formularioIngrediente({
        cadastrar: async () => { throw Object.assign(new Error('x'), { codigo: 'INGREDIENTE_DUPLICADO' }); },
    });
    tela.campos.nome.value = 'Tomate';
    await tela.form.enviar();

    assert.equal(tela.campos.nome.classes.has('is-invalid'), true);
});
