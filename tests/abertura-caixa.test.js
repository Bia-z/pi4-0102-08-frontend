import test from 'node:test';
import assert from 'node:assert/strict';
import { areaInicialAposLogin } from '../assets/js/core/auth.js';
import { iniciarPaginaCaixa } from '../assets/js/core/guard.js';
import {
    converterValorAbertura,
    inicializarAbertura,
} from '../caixa/js/abertura.js';

class ElementoFalso {
    constructor() {
        this.listeners = {};
        this.hidden = false;
        this.disabled = false;
        this.textContent = '';
        this.value = '';
    }

    addEventListener(tipo, callback) {
        this.listeners[tipo] = callback;
    }

    reset() {
        this.resetChamado = true;
    }
}

function criarDocumento() {
    const ids = [
        'form-abertura',
        'status-caixa',
        'erro-caixa',
        'sucesso-caixa',
        'valor-abertura',
        'turno',
        'abrir-turno',
        'tentar-novamente',
    ];
    const elementos = Object.fromEntries(ids.map((id) => [id, new ElementoFalso()]));
    return {
        elementos,
        getElementById: (id) => elementos[id],
    };
}

function erroApi(codigo, status = 400) {
    return Object.assign(new Error(codigo), { codigo, status });
}

test('encaminha CAIXA à abertura pós-login e preserva as áreas dos demais perfis', () => {
    assert.equal(areaInicialAposLogin('CAIXA'), '/caixa/abertura.html');
    assert.equal(areaInicialAposLogin('caixa'), '/caixa/abertura.html');
    assert.equal(areaInicialAposLogin('admin'), '/admin/funcionarios.html');
    assert.equal(areaInicialAposLogin('garcom'), '/garcom/index.html');
});

test('CAIXA com turno aberto segue para a tela principal sem exibir o formulário', async () => {
    const documento = criarDocumento();
    const navegacoes = [];
    let consultas = 0;
    const resultado = await inicializarAbertura({
        documento,
        fluxoLogin: true,
        navegar: (url) => navegacoes.push(url),
        api: {
            obterCaixaAberto: async () => {
                consultas += 1;
                return { caixa: { turno: 'MANHA', valorAbertura: 100 } };
            },
            abrirCaixa: async () => assert.fail('não deve abrir outro turno'),
        },
    });

    assert.equal(resultado, true);
    assert.equal(consultas, 1);
    assert.deepEqual(navegacoes, ['/caixa/index.html']);
    assert.equal(documento.elementos['form-abertura'].hidden, true);
    assert.match(documento.elementos['status-caixa'].textContent, /MANHA/);
});

test('erro de rede não libera o caixa e permite repetir a consulta', async () => {
    const documento = criarDocumento();
    const navegacoes = [];
    let consultas = 0;
    await inicializarAbertura({
        documento,
        fluxoLogin: true,
        navegar: (url) => navegacoes.push(url),
        api: {
            obterCaixaAberto: async () => {
                consultas += 1;
                if (consultas === 1) throw new TypeError('fetch failed');
                return { turno: 'TARDE', valorAbertura: 10 };
            },
            abrirCaixa: async () => assert.fail('não deve abrir um turno existente'),
        },
    });
    assert.equal(documento.elementos['form-abertura'].hidden, true);
    assert.equal(documento.elementos['tentar-novamente'].hidden, false);
    assert.match(documento.elementos['erro-caixa'].textContent, /Não foi possível conectar/);

    await documento.elementos['tentar-novamente'].listeners.click();
    assert.equal(consultas, 2);
    assert.deepEqual(navegacoes, ['/caixa/index.html']);
});

test('CAIXA sem turno aberto recebe o formulário obrigatório e valor padrão inválido não é enviado', async () => {
    const documento = criarDocumento();
    let aberturas = 0;
    await inicializarAbertura({
        documento,
        fluxoLogin: true,
        navegar: () => assert.fail('não deve navegar antes da abertura'),
        api: {
            obterCaixaAberto: async () => { throw erroApi('CAIXA_NAO_ABERTO', 404); },
            abrirCaixa: async () => { aberturas += 1; },
        },
    });
    assert.equal(documento.elementos['form-abertura'].hidden, false);
    assert.equal(documento.elementos['tentar-novamente'].hidden, true);

    documento.elementos['valor-abertura'].value = '10.123';
    documento.elementos.turno.value = 'TARDE';
    await documento.elementos['form-abertura'].listeners.submit({ preventDefault() {} });
    assert.equal(aberturas, 0);
    assert.equal(documento.elementos['erro-caixa'].hidden, false);
    assert.match(documento.elementos['erro-caixa'].textContent, /válido/);
});

test('abertura confirmada envia valores e só então libera a tela principal', async () => {
    const documento = criarDocumento();
    const chamadas = [];
    const navegacoes = [];
    documento.elementos['valor-abertura'].value = '100,50';
    documento.elementos.turno.value = 'NOITE';
    await inicializarAbertura({
        documento,
        fluxoLogin: true,
        navegar: (url) => navegacoes.push(url),
        api: {
            obterCaixaAberto: async () => { throw erroApi('CAIXA_NAO_ABERTO', 404); },
            abrirCaixa: async (corpo) => { chamadas.push(corpo); return { turno: 'NOITE' }; },
        },
    });

    await documento.elementos['form-abertura'].listeners.submit({ preventDefault() {} });
    assert.deepEqual(chamadas, [{ valorAbertura: 100.5, turno: 'NOITE' }]);
    assert.deepEqual(navegacoes, ['/caixa/index.html']);
    assert.equal(documento.elementos['form-abertura'].hidden, true);
    assert.equal(documento.elementos['sucesso-caixa'].hidden, false);
});

test('falha na abertura mantém o formulário e permite consultar de novo após conflito', async () => {
    const documento = criarDocumento();
    const navegacoes = [];
    let consultas = 0;
    let aberturas = 0;
    documento.elementos['valor-abertura'].value = '20.00';
    documento.elementos.turno.value = 'MANHA';
    await inicializarAbertura({
        documento,
        fluxoLogin: true,
        navegar: (url) => navegacoes.push(url),
        api: {
            obterCaixaAberto: async () => {
                consultas += 1;
                if (consultas === 1) throw erroApi('CAIXA_NAO_ABERTO', 404);
                return { turno: 'MANHA', valorAbertura: 20 };
            },
            abrirCaixa: async () => {
                aberturas += 1;
                throw erroApi('CAIXA_JA_ABERTO', 409);
            },
        },
    });

    await documento.elementos['form-abertura'].listeners.submit({ preventDefault() {} });
    assert.equal(aberturas, 1);
    assert.equal(consultas, 2);
    assert.deepEqual(navegacoes, ['/caixa/index.html']);
    assert.equal(documento.elementos['form-abertura'].hidden, true);

    const falhaDocumento = criarDocumento();
    falhaDocumento.elementos['valor-abertura'].value = '20.00';
    falhaDocumento.elementos.turno.value = 'MANHA';
    await inicializarAbertura({
        documento: falhaDocumento,
        fluxoLogin: true,
        navegar: () => assert.fail('falha não pode liberar acesso'),
        api: {
            obterCaixaAberto: async () => { throw erroApi('CAIXA_NAO_ABERTO', 404); },
            abrirCaixa: async () => { throw erroApi('VALOR_INVALIDO', 400); },
        },
    });
    await falhaDocumento.elementos['form-abertura'].listeners.submit({ preventDefault() {} });
    assert.equal(falhaDocumento.elementos['form-abertura'].hidden, false);
    assert.equal(falhaDocumento.elementos['abrir-turno'].disabled, false);
    assert.match(falhaDocumento.elementos['erro-caixa'].textContent, /válido/);
});

test('valida valores monetários com até duas casas decimais', () => {
    assert.equal(converterValorAbertura('0'), 0);
    assert.equal(converterValorAbertura('100.00'), 100);
    assert.equal(converterValorAbertura('100,5'), 100.5);
    assert.equal(converterValorAbertura('100,50'), 100.5);
    assert.equal(converterValorAbertura('-1'), null);
    assert.equal(converterValorAbertura('1,999'), null);
    assert.equal(converterValorAbertura('1,2.3'), null);
});

test('bloqueia páginas do caixa sem turno e mantém o administrador fora dessa exigência', async () => {
    const fetchOriginal = globalThis.fetch;
    const storageOriginal = globalThis.localStorage;
    const documentOriginal = globalThis.document;
    const windowOriginal = globalThis.window;
    const elementos = {
        usuario: { textContent: '' },
        'btn-sair': { addEventListener() {} },
    };
    globalThis.document = { getElementById: (id) => elementos[id] };
    globalThis.window = { location: { href: '' } };
    globalThis.localStorage = {
        getItem: () => JSON.stringify({ perfil: 'CAIXA', codigo: 'cx1', token: 'token' }),
    };
    globalThis.fetch = async () => ({
        ok: false,
        status: 404,
        json: async () => ({ erro: 'CAIXA_NAO_ABERTO' }),
    });
    try {
        assert.equal(await iniciarPaginaCaixa(), null);
        assert.equal(globalThis.window.location.href, '/caixa/abertura.html');

        globalThis.localStorage = {
            getItem: () => JSON.stringify({ perfil: 'ADMIN', codigo: 'admin', token: 'token' }),
        };
        assert.equal((await iniciarPaginaCaixa()).perfil, 'ADMIN');
    } finally {
        globalThis.fetch = fetchOriginal;
        globalThis.localStorage = storageOriginal;
        globalThis.document = documentOriginal;
        globalThis.window = windowOriginal;
    }
});
