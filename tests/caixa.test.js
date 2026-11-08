import test from 'node:test';
import assert from 'node:assert/strict';
import {
    abrirCaixa,
    atualizarConfiguracaoCaixa,
    baixarComandaPdf,
    baixarRelatorioCaixaPdf,
    criarMovimentacaoCaixa,
    fecharCaixa,
    obterCaixaAberto,
    obterComanda,
    obterConfiguracaoCaixa,
    obterHistoricoCaixa,
    obterRelatorioCaixa,
    listarMovimentacoesCaixa,
} from '../assets/js/core/api.js';
import { iniciarPaginaPerfis } from '../assets/js/core/guard.js';
import { conectarAtualizacoesComandas } from '../assets/js/core/ws.js';
import { inicializarAbertura } from '../caixa/js/abertura.js';
import { validarTaxaServico, inicializarConfiguracoes } from '../caixa/js/configuracoes.js';
import { carregarHistorico } from '../caixa/js/historico.js';
import { inicializarRelatorio } from '../caixa/js/relatorio.js';

class ElementoFalso {
    constructor() {
        this.listeners = {};
        this.hidden = false;
        this.disabled = false;
        this.value = '';
        this.checked = false;
        this.textContent = '';
        this.children = [];
    }

    addEventListener(tipo, callback) {
        this.listeners[tipo] = callback;
    }

    querySelectorAll() {
        return [this.nome, this.taxa, this.imprimir, this.botao].filter(Boolean);
    }

    reset() {}

    append(...elementos) {
        this.children.push(...elementos);
    }

    appendChild(elemento) {
        this.children.push(elemento);
        return elemento;
    }

    replaceChildren(...elementos) {
        this.children = elementos;
    }
}

function documentoFalso(ids) {
    const elementos = Object.fromEntries(ids.map((id) => [id, new ElementoFalso()]));
    return {
        elementos,
        getElementById: (id) => elementos[id],
        createElement: () => new ElementoFalso(),
    };
}

test('exibe carregamento e renderiza os fechamentos retornados pela API', async () => {
    const documento = documentoFalso([
        'historico-caixa', 'erro-caixa', 'data-fechamento', 'limpar-filtro-data',
    ]);
    let concluirConsulta;
    const consulta = carregarHistorico({
        documento,
        api: () => new Promise((resolve) => { concluirConsulta = resolve; }),
    });

    assert.equal(documento.elementos['historico-caixa'].children[0].children[0].textContent, 'Carregando histórico...');
    concluirConsulta({
        fechamentos: [{
            id: 12,
            operadorId: 3,
            turno: 'NOITE',
            status: 'FECHADO',
            valorAbertura: 100,
            abertoEm: '2026-11-08T18:00:00',
            valorFechamento: 250,
            valorEsperado: 245,
            fechadoEm: '2026-11-08T23:00:00',
        }],
    });
    await consulta;

    const celulas = documento.elementos['historico-caixa'].children[0].children;
    assert.deepEqual(celulas.map((celula) => celula.textContent), [
        'NOITE',
        '2026-11-08T18:00:00',
        '2026-11-08T23:00:00',
        '100',
        '250',
    ]);
    assert.equal(documento.elementos['erro-caixa'].hidden, true);
});

test('exibe mensagem específica quando não há turnos fechados', async () => {
    const documento = documentoFalso([
        'historico-caixa', 'erro-caixa', 'data-fechamento', 'limpar-filtro-data',
    ]);
    await carregarHistorico({ documento, api: async () => ({ fechamentos: [] }) });

    const linha = documento.elementos['historico-caixa'].children[0];
    assert.equal(linha.children[0].textContent, 'Nenhum turno fechado.');
    assert.equal(linha.children[0].colSpan, 5);
    assert.equal(documento.elementos['erro-caixa'].hidden, true);
});

test('exibe falha HTTP do histórico em vez de tratar como lista vazia', async () => {
    const documento = documentoFalso([
        'historico-caixa', 'erro-caixa', 'data-fechamento', 'limpar-filtro-data',
    ]);
    documento.elementos['erro-caixa'].hidden = true;
    await carregarHistorico({
        documento,
        api: async () => {
            throw Object.assign(new Error('Acesso negado'), {
                codigo: 'ACESSO_NEGADO',
                status: 403,
            });
        },
    });

    assert.equal(documento.elementos['historico-caixa'].children.length, 0);
    assert.equal(documento.elementos['erro-caixa'].hidden, false);
    assert.equal(documento.elementos['erro-caixa'].textContent, 'Acesso negado');

    await carregarHistorico({ documento, api: async () => ({ historico: [] }) });
    assert.equal(documento.elementos['historico-caixa'].children.length, 0);
    assert.equal(documento.elementos['erro-caixa'].hidden, false);
    assert.match(documento.elementos['erro-caixa'].textContent, /resposta inesperada/);
});

test('filtra turnos pela data de fechamento e permite limpar o filtro', async () => {
    const documento = documentoFalso([
        'historico-caixa', 'erro-caixa', 'data-fechamento', 'limpar-filtro-data',
    ]);
    let chamadasApi = 0;
    await carregarHistorico({
        documento,
        api: async () => {
            chamadasApi += 1;
            return {
                fechamentos: [
                    { turno: 'MANHÃ', fechadoEm: '2026-11-08T14:00:00', valorAbertura: 10, valorFechamento: 20 },
                    { turno: 'NOITE', fechadoEm: '2026-11-09T23:00:00', valorAbertura: 30, valorFechamento: 40 },
                ],
            };
        },
    });

    documento.elementos['data-fechamento'].value = '2026-11-09';
    documento.elementos['data-fechamento'].listeners.change();
    assert.equal(documento.elementos['historico-caixa'].children.length, 1);
    assert.equal(documento.elementos['historico-caixa'].children[0].children[0].textContent, 'NOITE');

    documento.elementos['data-fechamento'].value = '2026-11-10';
    documento.elementos['data-fechamento'].listeners.change();
    assert.equal(
        documento.elementos['historico-caixa'].children[0].children[0].textContent,
        'Nenhum turno fechado nesta data.',
    );

    documento.elementos['limpar-filtro-data'].listeners.click();
    assert.equal(documento.elementos['data-fechamento'].value, '');
    assert.deepEqual(
        documento.elementos['historico-caixa'].children.map((linha) => linha.children[0].textContent),
        ['MANHÃ', 'NOITE'],
    );
    assert.equal(chamadasApi, 1);
});

test('usa endpoints autenticados e corpos exatos para os novos recursos de caixa e comandas', async () => {
    const fetchOriginal = globalThis.fetch;
    const storageOriginal = globalThis.localStorage;
    const requisicoes = [];
    globalThis.localStorage = { getItem: () => JSON.stringify({ token: 'token-caixa' }) };
    globalThis.fetch = async (url, opcoes) => {
        requisicoes.push({ url, opcoes });
        return { ok: true, status: 200, json: async () => ({}) };
    };

    try {
        await obterCaixaAberto();
        await abrirCaixa({ valorAbertura: 25, turno: 'MANHA' });
        await fecharCaixa({ valorFechamento: 30 });
        await obterHistoricoCaixa();
        await criarMovimentacaoCaixa({ tipo: 'SANGRIA', valor: 5, motivo: 'Troco' });
        await listarMovimentacoesCaixa();
        await obterRelatorioCaixa('2026-11-08');
        await obterConfiguracaoCaixa();
        await atualizarConfiguracaoCaixa({
            nomeRestaurante: 'Restaurante',
            taxaServicoPercentual: 10,
            imprimirComandaAoAceitar: true,
        });
        await obterComanda(42);

        assert.deepEqual(requisicoes.map(({ url, opcoes }) => [url, opcoes.method]), [
            ['/api/caixa/aberto', 'GET'],
            ['/api/caixa/abrir', 'POST'],
            ['/api/caixa/fechar', 'POST'],
            ['/api/caixa/historico', 'GET'],
            ['/api/caixa/movimentacoes', 'POST'],
            ['/api/caixa/movimentacoes', 'GET'],
            ['/api/caixa/relatorios/2026-11-08', 'GET'],
            ['/api/caixa/configuracao', 'GET'],
            ['/api/caixa/configuracao', 'PUT'],
            ['/api/pedidos/42/comanda', 'GET'],
        ]);
        assert.deepEqual(JSON.parse(requisicoes[1].opcoes.body), { valorAbertura: 25, turno: 'MANHA' });
        assert.deepEqual(JSON.parse(requisicoes[2].opcoes.body), { valorFechamento: 30 });
        assert.deepEqual(JSON.parse(requisicoes[4].opcoes.body), {
            tipo: 'SANGRIA', valor: 5, motivo: 'Troco',
        });
        assert.deepEqual(JSON.parse(requisicoes[8].opcoes.body), {
            nomeRestaurante: 'Restaurante',
            taxaServicoPercentual: 10,
            imprimirComandaAoAceitar: true,
        });
        assert.ok(requisicoes.every(({ opcoes }) => opcoes.headers.Authorization.endsWith('token-caixa')));
    } finally {
        globalThis.fetch = fetchOriginal;
        globalThis.localStorage = storageOriginal;
    }
});

test('envia valor e credenciais de autorização no fechamento autenticado', async () => {
    const fetchOriginal = globalThis.fetch;
    const storageOriginal = globalThis.localStorage;
    let requisicao;
    globalThis.localStorage = { getItem: () => JSON.stringify({ token: 'token-caixa' }) };
    globalThis.fetch = async (url, opcoes) => {
        requisicao = { url, opcoes };
        return { ok: true, status: 200, json: async () => ({ valorEsperado: 50, diferenca: 0 }) };
    };
    try {
        await fecharCaixa({
            valorFechamento: 51.25,
            codigoUsuario: 'admin01',
            senha: 'senha-temporaria',
        });
        assert.equal(requisicao.url, '/api/caixa/fechar');
        assert.equal(requisicao.opcoes.method, 'POST');
        assert.equal(requisicao.opcoes.headers['Content-Type'], 'application/json');
        assert.ok(requisicao.opcoes.headers.Authorization.endsWith('token-caixa'));
        assert.deepEqual(JSON.parse(requisicao.opcoes.body), {
            valorFechamento: 51.25,
            codigoUsuario: 'admin01',
            senha: 'senha-temporaria',
        });
    } finally {
        globalThis.fetch = fetchOriginal;
        globalThis.localStorage = storageOriginal;
    }
});

test('mantém o código e o status de erros de autorização retornados pela API', async () => {
    const fetchOriginal = globalThis.fetch;
    const storageOriginal = globalThis.localStorage;
    globalThis.localStorage = { getItem: () => JSON.stringify({ token: 'token-caixa' }) };
    globalThis.fetch = async () => ({
        ok: false,
        status: 403,
        json: async () => ({ erro: 'MOVIMENTACAO_INVALIDA' }),
    });
    try {
        await assert.rejects(criarMovimentacaoCaixa({
            tipo: 'SANGRIA', valor: -1, motivo: '',
        }), (erro) => erro.codigo === 'MOVIMENTACAO_INVALIDA' && erro.status === 403);
    } finally {
        globalThis.fetch = fetchOriginal;
        globalThis.localStorage = storageOriginal;
    }
});

test('rejeita respostas inesperadas nos endpoints de abertura e consulta de caixa', async () => {
    const fetchOriginal = globalThis.fetch;
    const storageOriginal = globalThis.localStorage;
    globalThis.localStorage = { getItem: () => JSON.stringify({ token: 'token-caixa' }) };
    globalThis.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => [],
    });
    try {
        await assert.rejects(obterCaixaAberto(), (erro) => erro.codigo === 'RESPOSTA_CAIXA_INVALIDA');
        await assert.rejects(abrirCaixa({ valorAbertura: 10, turno: 'NOITE' }), (erro) => (
            erro.codigo === 'RESPOSTA_CAIXA_INVALIDA'
        ));
    } finally {
        globalThis.fetch = fetchOriginal;
        globalThis.localStorage = storageOriginal;
    }
});

test('baixa PDFs de relatório e comanda com token de sessão', async () => {
    const fetchOriginal = globalThis.fetch;
    const storageOriginal = globalThis.localStorage;
    const documentOriginal = globalThis.document;
    const urlOriginal = globalThis.URL;
    const urls = [];
    const links = [];
    globalThis.localStorage = { getItem: () => JSON.stringify({ token: 'token-caixa' }) };
    globalThis.fetch = async (url, opcoes) => {
        urls.push({ url, opcoes });
        return { ok: true, status: 200, blob: async () => new Blob(['pdf']) };
    };
    globalThis.document = {
        createElement: () => {
            const link = { click() { links.push(this); } };
            return link;
        },
    };
    globalThis.URL = { createObjectURL: () => 'blob:pdf', revokeObjectURL() {} };
    try {
        await baixarRelatorioCaixaPdf('2026-11-08');
        await baixarComandaPdf(42);
        assert.deepEqual(urls.map(({ url }) => url), [
            '/api/caixa/relatorios/2026-11-08/pdf',
            '/api/pedidos/42/comanda/pdf',
        ]);
        assert.ok(urls.every(({ opcoes }) => opcoes.headers.Authorization.endsWith('token-caixa')));
        assert.deepEqual(links.map(({ download }) => download), [
            'relatorio-caixa-2026-11-08.pdf', 'comanda-42.pdf',
        ]);
    } finally {
        globalThis.fetch = fetchOriginal;
        globalThis.localStorage = storageOriginal;
        globalThis.document = documentOriginal;
        globalThis.URL = urlOriginal;
    }
});

test('exibe carregamento ao consultar caixa e valida a abertura antes de enviar', async () => {
    const documento = documentoFalso([
        'form-abertura', 'status-caixa', 'erro-caixa', 'sucesso-caixa',
        'valor-abertura', 'turno', 'abrir-turno',
    ]);
    documento.elementos['valor-abertura'].value = '20.50';
    documento.elementos.turno.value = 'TARDE';
    let liberar;
    let corpo;
    const inicializacao = inicializarAbertura({
        documento,
        api: {
            obterCaixaAberto: () => new Promise((resolve) => { liberar = resolve; }),
            abrirCaixa: async (dados) => { corpo = dados; },
        },
    });
    assert.equal(documento.elementos['status-caixa'].textContent, 'Consultando turno aberto...');
    liberar({ turno: 'MANHA', valorAbertura: 15 });
    await inicializacao;
    assert.equal(documento.elementos['form-abertura'].hidden, true);

    const semTurno = documentoFalso([
        'form-abertura', 'status-caixa', 'erro-caixa', 'sucesso-caixa',
        'valor-abertura', 'turno', 'abrir-turno',
    ]);
    semTurno.elementos['valor-abertura'].value = '20.50';
    semTurno.elementos.turno.value = 'TARDE';
    await inicializarAbertura({
        documento: semTurno,
        api: {
            obterCaixaAberto: async () => {
                throw Object.assign(new Error('CAIXA_NAO_ABERTO'), { codigo: 'CAIXA_NAO_ABERTO' });
            },
            abrirCaixa: async (dados) => { corpo = dados; },
        },
    });
    assert.equal(semTurno.elementos['form-abertura'].hidden, false);
    await semTurno.elementos['form-abertura'].listeners.submit({ preventDefault() {} });
    assert.deepEqual(corpo, { valorAbertura: 20.5, turno: 'TARDE' });
});

test('exibe erros ao consultar a abertura e não oferece ação falsa em falhas da API', async () => {
    const documento = documentoFalso([
        'form-abertura', 'status-caixa', 'erro-caixa', 'sucesso-caixa',
        'valor-abertura', 'turno', 'abrir-turno',
    ]);
    await inicializarAbertura({
        documento,
        api: {
            obterCaixaAberto: async () => {
                throw Object.assign(new Error('Falha no servidor'), {
                    codigo: 'SERVIDOR_INDISPONIVEL',
                    status: 503,
                });
            },
            abrirCaixa: async () => {},
        },
    });
    assert.equal(documento.elementos['form-abertura'].hidden, true);
    assert.match(documento.elementos['erro-caixa'].textContent, /Falha no servidor/);
});

test('consulta totais diários, exibe carregamento e mostra erro em falha de relatório', async () => {
    const ids = [
        'data-relatorio', 'form-relatorio', 'erro-relatorio', 'resultado-relatorio',
        'carregando-relatorio', 'total-dinheiro', 'total-credito', 'total-debito',
        'total-pix', 'total-vale', 'quantidade-pagamentos', 'movimentacoes-relatorio',
        'baixar-relatorio',
    ];
    const documento = documentoFalso(ids);
    let dataConsultada;
    inicializarRelatorio({
        documento,
        api: {
            consultar: async (data) => {
                dataConsultada = data;
                return {
                    totalDinheiro: 10,
                    totalCredito: 20,
                    totalDebito: 30,
                    totalPix: 40,
                    totalValeAlimentacao: 50,
                    quantidadePagamentos: 5,
                    movimentacoes: [],
                };
            },
            baixarPdf: async () => {},
        },
    });
    documento.elementos['data-relatorio'].value = '2026-11-08';
    const consulta = documento.elementos['form-relatorio'].listeners.submit({
        preventDefault() {},
    });
    assert.equal(documento.elementos['carregando-relatorio'].hidden, false);
    await consulta;
    assert.equal(dataConsultada, '2026-11-08');
    assert.match(documento.elementos['total-dinheiro'].textContent, /10,00/);
    assert.equal(documento.elementos['quantidade-pagamentos'].textContent, '5');
    assert.equal(documento.elementos['resultado-relatorio'].hidden, false);
    assert.equal(documento.elementos['carregando-relatorio'].hidden, true);

    const erro = documentoFalso(ids);
    inicializarRelatorio({
        documento: erro,
        api: {
            consultar: async () => { throw Object.assign(new Error('Acesso negado'), { status: 403 }); },
            baixarPdf: async () => {},
        },
    });
    erro.elementos['data-relatorio'].value = '2026-11-08';
    await erro.elementos['form-relatorio'].listeners.submit({ preventDefault() {} });
    assert.equal(erro.elementos['resultado-relatorio'].hidden, true);
    assert.match(erro.elementos['erro-relatorio'].textContent, /Acesso negado/);
});

test('permite consulta à CAIXA, restringe alteração e valida taxa de serviço para ADMIN', async () => {
    assert.equal(validarTaxaServico('0'), true);
    assert.equal(validarTaxaServico('100'), true);
    assert.equal(validarTaxaServico('-0.1'), false);
    assert.equal(validarTaxaServico('100.1'), false);
    assert.equal(validarTaxaServico('abc'), false);

    const caixa = documentoFalso([
        'form-configuracoes', 'erro-configuracoes', 'sucesso-configuracoes',
        'salvar-configuracoes', 'somente-consulta', 'nome-restaurante',
        'taxa-servico', 'imprimir-comanda',
    ]);
    caixa.elementos['nome-restaurante'].value = '';
    caixa.elementos['taxa-servico'].value = '';
    caixa.elementos['form-configuracoes'].nome = caixa.elementos['nome-restaurante'];
    caixa.elementos['form-configuracoes'].taxa = caixa.elementos['taxa-servico'];
    caixa.elementos['form-configuracoes'].imprimir = caixa.elementos['imprimir-comanda'];
    caixa.elementos['form-configuracoes'].botao = caixa.elementos['salvar-configuracoes'];
    let alteracoes = 0;
    await inicializarConfiguracoes({
        perfil: 'CAIXA',
        documento: caixa,
        api: {
            obter: async () => ({
                nomeRestaurante: 'Casa',
                taxaServicoPercentual: 12,
                imprimirComandaAoAceitar: false,
            }),
            atualizar: async () => { alteracoes += 1; },
        },
    });
    assert.equal(caixa.elementos['nome-restaurante'].value, 'Casa');
    assert.equal(caixa.elementos['nome-restaurante'].disabled, true);
    assert.equal(caixa.elementos['somente-consulta'].hidden, false);

    const admin = documentoFalso([
        'form-configuracoes', 'erro-configuracoes', 'sucesso-configuracoes',
        'salvar-configuracoes', 'somente-consulta', 'nome-restaurante',
        'taxa-servico', 'imprimir-comanda',
    ]);
    Object.assign(admin.elementos['form-configuracoes'], {
        nome: admin.elementos['nome-restaurante'],
        taxa: admin.elementos['taxa-servico'],
        imprimir: admin.elementos['imprimir-comanda'],
        botao: admin.elementos['salvar-configuracoes'],
    });
    admin.elementos['nome-restaurante'].value = 'Casa';
    admin.elementos['taxa-servico'].value = '101';
    let configuracaoEnviada;
    await inicializarConfiguracoes({
        perfil: 'ADMIN',
        documento: admin,
        api: {
            obter: async () => ({ nomeRestaurante: 'Casa', taxaServicoPercentual: 10 }),
            atualizar: async (valor) => { configuracaoEnviada = valor; return valor; },
        },
    });
    admin.elementos['taxa-servico'].value = '101';
    await admin.elementos['form-configuracoes'].listeners.submit({ preventDefault() {} });
    assert.equal(configuracaoEnviada, undefined);
    assert.match(admin.elementos['erro-configuracoes'].textContent, /entre 0 e 100/);
    admin.elementos['taxa-servico'].value = '15';
    admin.elementos['imprimir-comanda'].checked = true;
    await admin.elementos['form-configuracoes'].listeners.submit({ preventDefault() {} });
    assert.deepEqual(configuracaoEnviada, {
        nomeRestaurante: 'Casa',
        taxaServicoPercentual: 15,
        imprimirComandaAoAceitar: true,
    });
    assert.equal(alteracoes, 0);
});

test('aceita perfis ADMIN e CAIXA nas páginas restritas', () => {
    const storageOriginal = globalThis.localStorage;
    const windowOriginal = globalThis.window;
    const documentoOriginal = globalThis.document;
    const elementos = {
        usuario: { textContent: '' },
        'btn-sair': { addEventListener() {} },
    };
    globalThis.document = { getElementById: (id) => elementos[id] };
    globalThis.localStorage = { getItem: () => JSON.stringify({ token: 'token', perfil: 'ADMIN', codigo: 'a1' }) };
    globalThis.window = { location: { href: '' } };
    try {
        globalThis.localStorage = { getItem: () => JSON.stringify({ token: 'token', perfil: 'CAIXA', codigo: 'cx1' }) };
        assert.equal(iniciarPaginaPerfis(['ADMIN', 'CAIXA']).codigo, 'cx1');
        globalThis.localStorage = { getItem: () => JSON.stringify({ token: 'token', perfil: 'ADMIN', codigo: 'a1' }) };
        assert.equal(iniciarPaginaPerfis(['ADMIN', 'CAIXA']).codigo, 'a1');
        assert.equal(elementos.usuario.textContent, 'a1');
        globalThis.localStorage = { getItem: () => JSON.stringify({ token: 'token', perfil: 'GARCOM' }) };
        assert.equal(iniciarPaginaPerfis(['ADMIN', 'CAIXA']), null);
        assert.equal(globalThis.window.location.href, '/garcom/index.html');
    } finally {
        globalThis.localStorage = storageOriginal;
        globalThis.window = windowOriginal;
        globalThis.document = documentoOriginal;
    }
});

test('assina /topic/comandas com autenticação e encaminha eventos e desconexões', async () => {
    const storageOriginal = globalThis.localStorage;
    const windowOriginal = globalThis.window;
    globalThis.localStorage = { getItem: () => JSON.stringify({ token: 'token-caixa' }) };
    globalThis.window = { location: { protocol: 'https:', host: 'restmanager.local' } };
    const erros = [];
    let opcoes;
    let callback;
    let destino;
    let recebido;
    const cliente = {
        activate() {},
        subscribe(topico, handler) {
            destino = topico;
            callback = handler;
        },
    };
    try {
        await conectarAtualizacoesComandas({
            criarCliente: (config) => {
                opcoes = config;
                return cliente;
            },
            aoAtualizar: (evento) => { recebido = evento; },
            aoErro: (erro) => erros.push(erro.message),
        });
        opcoes.onConnect();
        callback({ body: JSON.stringify({ pedidoId: 42 }) });
        await new Promise((resolve) => setImmediate(resolve));
        opcoes.onWebSocketClose();
        assert.equal(destino, '/topic/comandas');
        assert.ok(opcoes.connectHeaders.Authorization.endsWith('token-caixa'));
        assert.deepEqual(recebido, { pedidoId: 42 });
        assert.match(erros[0], /Tentando reconectar/);
    } finally {
        globalThis.localStorage = storageOriginal;
        globalThis.window = windowOriginal;
    }
});
