import test from 'node:test';
import assert from 'node:assert/strict';
import { cadastrarMesa } from '../assets/js/core/api.js';
import { inicializarCadastroMesa } from '../admin/js/mesa-form.js';

class ElementoFake {
    constructor(value = '') {
        this.value = value;
        this.textContent = '';
        this.disabled = false;
        this.attributes = {};
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

    addEventListener(evento, callback) {
        assert.equal(evento, 'submit');
        this.enviar = () => callback({ preventDefault() {} });
    }

    reset() {}
}

const camposDeErro = new Map();
globalThis.document = { getElementById: (id) => camposDeErro.get(id) };

function criarTela({ numero = '11', capacidade = '4', cadastrar = async () => ({ numero: 11, capacidade: 4 }) } = {}) {
    const campos = {
        numero: new ElementoFake(numero),
        capacidade: new ElementoFake(capacidade),
    };
    const form = new ElementoFake();
    form.elements = { namedItem: (nome) => campos[nome] };
    const alerta = new ElementoFake();
    alerta.classList.add('d-none');
    const sucesso = new ElementoFake();
    sucesso.classList.add('d-none');
    const botao = new ElementoFake();
    camposDeErro.set('numero', campos.numero);
    camposDeErro.set('numero-erro', new ElementoFake());
    camposDeErro.set('capacidade', campos.capacidade);
    camposDeErro.set('capacidade-erro', new ElementoFake());
    inicializarCadastroMesa({ form, alerta, sucesso, botao, cadastrar });
    return { campos, form, alerta, sucesso, botao };
}

test('cadastra mesa por POST autenticado com corpo numérico', async () => {
    const fetchOriginal = globalThis.fetch;
    const storageOriginal = globalThis.localStorage;
    let requisicao;
    globalThis.localStorage = {
        getItem: () => JSON.stringify({ token: 'token-admin', perfil: 'admin' }),
    };
    globalThis.fetch = async (url, opcoes) => {
        requisicao = { url, opcoes };
        return {
            ok: true,
            status: 201,
            json: async () => ({ id: 11, numero: 11, capacidade: 4, status: 'disponivel' }),
        };
    };

    try {
        await cadastrarMesa({ numero: 11, capacidade: 4 });
        assert.equal(requisicao.url, '/api/mesas');
        assert.equal(requisicao.opcoes.method, 'POST');
        assert.equal(requisicao.opcoes.headers['Content-Type'], 'application/json');
        assert.equal(requisicao.opcoes.headers.Authorization, 'Bearer token-admin');
        assert.deepEqual(JSON.parse(requisicao.opcoes.body), { numero: 11, capacidade: 4 });
    } finally {
        globalThis.fetch = fetchOriginal;
        globalThis.localStorage = storageOriginal;
    }
});

test('valida número e capacidade como inteiros positivos antes do envio', async () => {
    for (const [field, value] of [['numero', '0'], ['numero', '1.5'], ['capacidade', '0'], ['capacidade', '2.5']]) {
        let chamadas = 0;
        const tela = criarTela({
            numero: field === 'numero' ? value : '11',
            capacidade: field === 'capacidade' ? value : '4',
            cadastrar: async () => { chamadas += 1; },
        });

        await tela.form.enviar();
        assert.equal(chamadas, 0);
        assert.equal(tela.campos[field].attributes['aria-invalid'], 'true');
        assert.notEqual(camposDeErro.get(`${field}-erro`).textContent, '');
    }
});

test('exibe confirmação com os dados retornados pela API', async () => {
    const tela = criarTela({
        cadastrar: async () => ({ id: 11, numero: 11, capacidade: 4, status: 'disponivel' }),
    });

    await tela.form.enviar();
    assert.equal(tela.sucesso.classList.contains('d-none'), false);
    assert.match(tela.sucesso.textContent, /Mesa 11 cadastrada/);
    assert.match(tela.sucesso.textContent, /4 pessoa/);
});

test('apresenta erros de duplicidade e capacidade nos respectivos campos', async () => {
    const casos = [
        ['MESA_DUPLICADA', 'numero'],
        ['CAPACIDADE_INVALIDA', 'capacidade'],
    ];

    for (const [codigo, campo] of casos) {
        const tela = criarTela({
            cadastrar: async () => {
                throw Object.assign(new Error(codigo), { codigo, status: 400 });
            },
        });

        await tela.form.enviar();
        assert.equal(tela.campos[campo].attributes['aria-invalid'], 'true');
        assert.notEqual(camposDeErro.get(`${campo}-erro`).textContent, '');
        assert.equal(tela.alerta.classList.contains('d-none'), true);
    }
});

test('mostra mensagem do servidor para acesso negado', async () => {
    const tela = criarTela({
        cadastrar: async () => {
            throw Object.assign(new Error('ACESSO_NEGADO'), { codigo: 'ACESSO_NEGADO', status: 403 });
        },
    });

    await tela.form.enviar();
    assert.equal(tela.alerta.classList.contains('d-none'), false);
    assert.match(tela.alerta.textContent, /administrador/);
});
