import test from 'node:test';
import assert from 'node:assert/strict';
import { areaInicialAposLogin } from '../assets/js/core/auth.js';
import { iniciarPaginaCaixa } from '../assets/js/core/guard.js';
import {
    converterValorAbertura,
    dataDiaAnterior,
    inicializarAbertura,
    obterTurnoAtual,
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
        'resumo-dia-anterior',
        'continuar-caixa',
        'anterior-data',
        'anterior-total-recebido',
        'anterior-total-dinheiro',
        'anterior-total-credito',
        'anterior-total-debito',
        'anterior-total-pix',
        'anterior-total-vale',
        'anterior-quantidade-pagamentos',
    ];
    const elementos = Object.fromEntries(ids.map((id) => [id, new ElementoFalso()]));
    // No HTML real estes elementos começam escondidos.
    elementos['resumo-dia-anterior'].hidden = true;
    elementos['continuar-caixa'].hidden = true;
    return {
        elementos,
        getElementById: (id) => elementos[id],
    };
}

const RELATORIO_ONTEM = {
    data: '2026-11-07',
    totalRecebido: 350.5,
    totalDinheiro: 100,
    totalCredito: 150.5,
    totalDebito: 50,
    totalPix: 40,
    totalVale: 10,
    quantidadePagamentos: 7,
    movimentacoes: [],
};

function erroApi(codigo, status = 400) {
    return Object.assign(new Error(codigo), { codigo, status });
}

test('encaminha CAIXA à abertura pós-login e preserva as áreas dos demais perfis', () => {
    assert.equal(areaInicialAposLogin('CAIXA'), '/caixa/abertura.html?login=1');
    assert.equal(areaInicialAposLogin('caixa'), '/caixa/abertura.html?login=1');
    assert.equal(areaInicialAposLogin('admin'), '/admin/funcionarios.html');
    assert.equal(areaInicialAposLogin('garcom'), '/garcom/index.html');
});

test('CAIXA com turno aberto vê o resumo de ontem e segue ao clicar em continuar', async () => {
    const documento = criarDocumento();
    const navegacoes = [];
    const datasConsultadas = [];
    let consultas = 0;
    const resultado = await inicializarAbertura({
        documento,
        fluxoLogin: true,
        navegar: (url) => navegacoes.push(url),
        agora: () => new Date(2026, 10, 8, 9),
        api: {
            obterCaixaAberto: async () => {
                consultas += 1;
                return { caixa: { turno: 'MANHA', valorAbertura: 100 } };
            },
            abrirCaixa: async () => assert.fail('não deve abrir outro turno'),
            obterRelatorioCaixa: async (data) => {
                datasConsultadas.push(data);
                return RELATORIO_ONTEM;
            },
        },
    });

    assert.equal(resultado, true);
    assert.equal(consultas, 1);
    assert.deepEqual(datasConsultadas, ['2026-11-07']);
    assert.deepEqual(navegacoes, []);
    assert.equal(documento.elementos['form-abertura'].hidden, true);
    assert.match(documento.elementos['status-caixa'].textContent, /MANHA/);
    assert.equal(documento.elementos['resumo-dia-anterior'].hidden, false);
    assert.equal(documento.elementos['anterior-data'].textContent, '07/11/2026');
    assert.match(documento.elementos['anterior-total-recebido'].textContent, /350,50/);
    assert.equal(documento.elementos['anterior-quantidade-pagamentos'].textContent, '7');
    assert.equal(documento.elementos['continuar-caixa'].hidden, false);

    documento.elementos['continuar-caixa'].listeners.click();
    assert.deepEqual(navegacoes, ['/caixa/index.html']);
});

test('falha ao carregar o resumo de ontem não bloqueia o acesso ao caixa', async () => {
    const documento = criarDocumento();
    const navegacoes = [];
    await inicializarAbertura({
        documento,
        fluxoLogin: true,
        navegar: (url) => navegacoes.push(url),
        api: {
            obterCaixaAberto: async () => ({ turno: 'NOITE', valorAbertura: 0 }),
            abrirCaixa: async () => assert.fail('não deve abrir outro turno'),
            obterRelatorioCaixa: async () => { throw new TypeError('fetch failed'); },
        },
    });

    assert.equal(documento.elementos['resumo-dia-anterior'].hidden, true);
    assert.equal(documento.elementos['erro-caixa'].hidden, false);
    assert.match(documento.elementos['erro-caixa'].textContent, /resumo das vendas de ontem/);
    assert.equal(documento.elementos['continuar-caixa'].hidden, false);
    documento.elementos['continuar-caixa'].listeners.click();
    assert.deepEqual(navegacoes, ['/caixa/index.html']);
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
            obterRelatorioCaixa: async () => RELATORIO_ONTEM,
        },
    });
    assert.equal(documento.elementos['form-abertura'].hidden, true);
    assert.equal(documento.elementos['tentar-novamente'].hidden, false);
    assert.match(documento.elementos['erro-caixa'].textContent, /Não foi possível conectar/);
    assert.equal(documento.elementos['continuar-caixa'].hidden, true);

    await documento.elementos['tentar-novamente'].listeners.click();
    assert.equal(consultas, 2);
    assert.equal(documento.elementos['resumo-dia-anterior'].hidden, false);
    documento.elementos['continuar-caixa'].listeners.click();
    assert.deepEqual(navegacoes, ['/caixa/index.html']);
});

test('CAIXA sem turno aberto abre automaticamente com valor inicial zero', async () => {
    const documento = criarDocumento();
    const aberturas = [];
    const navegacoes = [];
    await inicializarAbertura({
        documento,
        fluxoLogin: true,
        navegar: (url) => navegacoes.push(url),
        agora: () => new Date(2026, 10, 8, 14),
        api: {
            obterCaixaAberto: async () => { throw erroApi('CAIXA_NAO_ABERTO', 404); },
            abrirCaixa: async (dados) => { aberturas.push(dados); },
            obterRelatorioCaixa: async () => RELATORIO_ONTEM,
        },
    });
    assert.deepEqual(aberturas, [{ valorAbertura: 0, turno: 'TARDE' }]);
    assert.deepEqual(navegacoes, []);
    assert.equal(documento.elementos['form-abertura'].hidden, true);
    assert.equal(documento.elementos['tentar-novamente'].hidden, true);
    assert.match(documento.elementos['sucesso-caixa'].textContent, /R\$ 0,00/);
    assert.equal(documento.elementos['resumo-dia-anterior'].hidden, false);
    assert.equal(documento.elementos['continuar-caixa'].hidden, false);

    documento.elementos['continuar-caixa'].listeners.click();
    assert.deepEqual(navegacoes, ['/caixa/index.html']);
});

test('abertura automática falha sem liberar o caixa e oferece nova tentativa', async () => {
    const documento = criarDocumento();
    const navegacoes = [];
    await inicializarAbertura({
        documento,
        fluxoLogin: true,
        navegar: (url) => navegacoes.push(url),
        api: {
            obterCaixaAberto: async () => { throw erroApi('CAIXA_NAO_ABERTO', 404); },
            abrirCaixa: async () => { throw erroApi('VALOR_INVALIDO', 400); },
        },
    });
    assert.deepEqual(navegacoes, []);
    assert.equal(documento.elementos['form-abertura'].hidden, true);
    assert.equal(documento.elementos['tentar-novamente'].hidden, false);
    assert.equal(documento.elementos['erro-caixa'].hidden, false);
});

test('abertura manual do CAIXA após fechamento libera a área operacional', async () => {
    const documento = criarDocumento();
    const navegacoes = [];
    documento.elementos['valor-abertura'].value = '50,00';
    documento.elementos.turno.value = 'TARDE';
    await inicializarAbertura({
        documento,
        redirecionarAposAbertura: true,
        navegar: (url) => navegacoes.push(url),
        api: {
            obterCaixaAberto: async () => { throw erroApi('CAIXA_NAO_ABERTO', 404); },
            abrirCaixa: async () => ({ turno: 'TARDE' }),
        },
    });

    await documento.elementos['form-abertura'].listeners.submit({ preventDefault() {} });
    assert.deepEqual(navegacoes, ['/caixa/index.html']);
    assert.equal(documento.elementos['form-abertura'].hidden, true);
});

test('conflito ao abrir automaticamente consulta o turno existente', async () => {
    const documento = criarDocumento();
    const navegacoes = [];
    let consultas = 0;
    const aberturas = [];
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
            abrirCaixa: async (dados) => {
                aberturas.push(dados);
                throw erroApi('CAIXA_JA_ABERTO', 409);
            },
            obterRelatorioCaixa: async () => RELATORIO_ONTEM,
        },
    });

    assert.deepEqual(aberturas, [{ valorAbertura: 0, turno: obterTurnoAtual() }]);
    assert.equal(consultas, 2);
    assert.deepEqual(navegacoes, []);
    assert.equal(documento.elementos['form-abertura'].hidden, true);
    assert.equal(documento.elementos['resumo-dia-anterior'].hidden, false);

    documento.elementos['continuar-caixa'].listeners.click();
    assert.deepEqual(navegacoes, ['/caixa/index.html']);
});

test('abertura manual fora do login redireciona direto, sem consultar o resumo de ontem', async () => {
    const documento = criarDocumento();
    const navegacoes = [];
    let consultas = 0;
    documento.elementos['valor-abertura'].value = '50,00';
    documento.elementos.turno.value = 'TARDE';
    await inicializarAbertura({
        documento,
        redirecionarAposAbertura: true,
        navegar: (url) => navegacoes.push(url),
        api: {
            obterCaixaAberto: async () => {
                consultas += 1;
                if (consultas === 1) throw erroApi('CAIXA_NAO_ABERTO', 404);
                return { turno: 'TARDE', valorAbertura: 0 };
            },
            abrirCaixa: async () => { throw erroApi('CAIXA_JA_ABERTO', 409); },
            obterRelatorioCaixa: async () => assert.fail('não deve consultar o resumo fora do login'),
        },
    });

    await documento.elementos['form-abertura'].listeners.submit({ preventDefault() {} });
    assert.deepEqual(navegacoes, ['/caixa/index.html']);
    assert.equal(documento.elementos['resumo-dia-anterior'].hidden, true);
});

test('calcula o dia anterior inclusive na virada de mês e de ano', () => {
    assert.equal(dataDiaAnterior(new Date(2026, 10, 8, 9)), '2026-11-07');
    assert.equal(dataDiaAnterior(new Date(2026, 2, 1, 0, 30)), '2026-02-28');
    assert.equal(dataDiaAnterior(new Date(2027, 0, 1, 23, 59)), '2026-12-31');
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

test('determina o turno conforme o horário local', () => {
    assert.equal(obterTurnoAtual(new Date(2026, 10, 8, 11)), 'MANHA');
    assert.equal(obterTurnoAtual(new Date(2026, 10, 8, 12)), 'TARDE');
    assert.equal(obterTurnoAtual(new Date(2026, 10, 8, 18)), 'NOITE');
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
    const conteudo = { hidden: false };
    const listenersJanela = {};
    globalThis.document = {
        getElementById: (id) => elementos[id],
        querySelector: (seletor) => seletor === 'main' ? conteudo : null,
    };
    globalThis.window = {
        location: { href: '' },
        addEventListener: (tipo, listener) => { listenersJanela[tipo] = listener; },
    };
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
        assert.equal(conteudo.hidden, true);

        globalThis.fetch = async () => ({
            ok: true,
            status: 200,
            json: async () => ({ turno: 'TARDE' }),
        });
        assert.equal((await iniciarPaginaCaixa()).perfil, 'CAIXA');
        assert.equal(conteudo.hidden, false);

        globalThis.fetch = async () => ({
            ok: false,
            status: 404,
            json: async () => ({ erro: 'CAIXA_NAO_ABERTO' }),
        });
        await listenersJanela.pageshow({ persisted: true });
        assert.equal(conteudo.hidden, true);
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
