import test from 'node:test';
import assert from 'node:assert/strict';
import {
    baixarComprovantePedido,
    cancelarPagamento,
    iniciarPagamento,
    listarPedidos,
    processarPagamento,
} from '../assets/js/core/api.js';
import {
    calcularResumoPagamento,
    calcularSaldoPagamento,
    configurarBotaoComprovante,
    inicializarPagamento,
    mensagemErroPagamento,
} from '../caixa/js/pagamento.js';

class ElementoFalso {
    constructor() {
        this.listeners = {};
        this.children = [];
        this.hidden = false;
        this.disabled = false;
        this.value = '';
        this.textContent = '';
    }

    addEventListener(tipo, callback) {
        this.listeners[tipo] = callback;
    }

    appendChild(elemento) {
        this.children.push(elemento);
        return elemento;
    }

    append(...elementos) {
        this.children.push(...elementos);
    }

    replaceChildren(...elementos) {
        this.children = [...elementos];
        this.textContent = '';
    }

    setAttribute() {}

    remove() {
        this.removed = true;
    }
}

test('calcula subtotal sem itens cancelados, taxa, desconto e saldo', () => {
    const resumo = calcularResumoPagamento([
        {
            itens: [
                { quantidade: 2, precoUnitario: 10, status: 'pronto' },
                { quantidade: 1, precoUnitario: 50, status: 'cancelado' },
            ],
        },
        { itens: [{ quantidade: 1, precoUnitario: 5.25, status: 'aguardando' }] },
    ], 1.25);

    assert.deepEqual(resumo, {
        subtotalCentavos: 2525,
        taxaCentavos: 253,
        descontoCentavos: 125,
        totalCentavos: 2653,
    });
    assert.deepEqual(calcularSaldoPagamento(resumo.totalCentavos, [
        { formaPagamento: 'pix', centavos: 1000 },
        { formaPagamento: 'dinheiro', centavos: 1000 },
    ]), {
        recebidoCentavos: 2000,
        faltaCentavos: 653,
        trocoCentavos: 0,
    });
    assert.deepEqual(calcularSaldoPagamento(resumo.totalCentavos, [
        { formaPagamento: 'pix', centavos: 2000 },
        { formaPagamento: 'dinheiro', centavos: 1000 },
    ]), {
        recebidoCentavos: 3000,
        faltaCentavos: 0,
        trocoCentavos: 347,
    });
    assert.equal(calcularSaldoPagamento(10000, [
        { formaPagamento: 'credito', centavos: 11000 },
    ]).trocoCentavos, 0);
});

test('exibe mensagem amigável quando o pagamento é insuficiente', () => {
    assert.equal(
        mensagemErroPagamento({ codigo: 'VALOR_PAGAMENTO_INSUFICIENTE' }),
        'A soma dos pagamentos é menor que o total da conta.',
    );
});

test('mantem sessao WebSocket durante o fechamento da mesa e encerra ao sair da tela', async () => {
    const ids = [
        'mesa-numero', 'itens-pedido', 'status-pedidos', 'iniciar-pagamento',
        'detalhes-pagamento', 'pagamentos', 'form-pagamento', 'desconto',
        'adicionar-pagamento', 'cancelar-pagamento', 'erro-pagamento', 'sucesso-pagamento',
        'voltar-mapa', 'baixar-comprovante', 'erro-comprovante', 'subtotal',
        'taxa-servico-label', 'taxa-servico', 'desconto-resumo', 'total', 'total-recebido',
        'valor-falta', 'valor-troco', 'confirmar-pagamento',
    ];
    const elementos = Object.fromEntries(ids.map((id) => [id, new ElementoFalso()]));
    elementos['detalhes-pagamento'].hidden = true;
    const documento = {
        getElementById: (id) => elementos[id],
        createElement: () => new ElementoFalso(),
    };
    let opcoesConexao;
    let inicioPagamento = 0;
    const callbacksPagehide = [];
    let desativada = false;
    let callbackAtualizacao;
    let intervaloLimpo;
    let opcoesPedidos;
    let consultasPedidos = 0;
    let statusMesa = 'ocupada';
    await inicializarPagamento({
        mesaId: 12,
        documento,
        registrarIntervalo: (callback, intervalo) => {
            callbackAtualizacao = callback;
            assert.equal(intervalo, 5000);
            return 'intervalo-pedidos';
        },
        limparIntervalo: (intervalo) => { intervaloLimpo = intervalo; },
        conectarSessao: async (opcoes) => {
            opcoesConexao = opcoes;
            return { deactivate: async () => { desativada = true; } };
        },
        conectarPedidos: async (opcoes) => {
            opcoesPedidos = opcoes;
            return { deactivate: async () => { desativada = true; } };
        },
        registrarPagehide: (callback) => { callbacksPagehide.push(callback); },
        api: {
            obterMapaMesas: async () => ({ mesas: [{ mesaId: 12, status: statusMesa }] }),
            iniciarPagamento: async () => {
                inicioPagamento += 1;
                statusMesa = 'em_pagamento';
            },
            listarPedidos: async () => {
                consultasPedidos += 1;
                return [{
                    mesaId: 12,
                    status: 'aguardando',
                    taxaServicoPercentual: 10,
                    itens: [],
                }];
            },
            cancelarPagamento: async () => {
                throw Object.assign(new Error('MESA_NAO_EM_PAGAMENTO'), {
                    codigo: 'MESA_NAO_EM_PAGAMENTO',
                });
            },
        },
    });

    assert.equal(inicioPagamento, 0, 'consultar a mesa não deve iniciar o pagamento');
    assert.equal(elementos['detalhes-pagamento'].hidden, true);
    assert.equal(typeof callbackAtualizacao, 'function');
    assert.equal(typeof opcoesPedidos.aoAtualizar, 'function');
    await opcoesPedidos.aoAtualizar({ tipo: 'statusPedidoAtualizado', numeroMesa: 12 });
    assert.equal(consultasPedidos, 2, 'evento WebSocket atualiza os pedidos imediatamente');
    await elementos['iniciar-pagamento'].listeners.click();
    assert.equal(inicioPagamento, 1);
    assert.equal(elementos['detalhes-pagamento'].hidden, false);
    assert.equal(typeof opcoesConexao.aoAtualizar, 'function');
    await elementos['cancelar-pagamento'].listeners.click();
    assert.equal(elementos['voltar-mapa'].hidden, false);
    assert.match(elementos['erro-pagamento'].textContent, /status atualizado da mesa/);
    assert.equal(elementos['cancelar-pagamento'].disabled, true);
    await Promise.all(callbacksPagehide.map((callback) => callback()));
    assert.equal(intervaloLimpo, 'intervalo-pedidos');
    assert.equal(desativada, true);
});

test('transfere pedido na tela de pagamento sem iniciar o fechamento da mesa', async () => {
    const ids = [
        'mesa-numero', 'itens-pedido', 'status-pedidos', 'iniciar-pagamento',
        'detalhes-pagamento', 'pagamentos', 'form-pagamento', 'desconto',
        'adicionar-pagamento', 'cancelar-pagamento', 'erro-pagamento', 'sucesso-pagamento',
        'voltar-mapa', 'baixar-comprovante', 'erro-comprovante', 'subtotal',
        'taxa-servico-label', 'taxa-servico', 'desconto-resumo', 'total', 'total-recebido',
        'valor-falta', 'valor-troco', 'confirmar-pagamento',
    ];
    const elementos = Object.fromEntries(ids.map((id) => [id, new ElementoFalso()]));
    elementos['detalhes-pagamento'].hidden = true;
    const documento = {
        getElementById: (id) => elementos[id],
        createElement: () => new ElementoFalso(),
    };
    const transferencias = [];
    let iniciados = 0;
    await inicializarPagamento({
        mesaId: 7,
        documento,
        registrarIntervalo: () => 1,
        limparIntervalo: () => {},
        registrarPagehide: () => {},
        conectarPedidos: async () => ({ deactivate: async () => {} }),
        conectarSessao: async () => ({ deactivate: async () => {} }),
        api: {
            listarPedidos: async () => [{
                pedidoId: 31,
                status: 'AGUARDANDO',
                itens: [{ quantidade: 1, produtoNome: 'Prato', precoUnitario: 25, status: 'em_preparo' }],
            }],
            obterMapaMesas: async () => ({
                mesas: [
                    { mesaId: 7, numero: 7, status: 'OCUPADA' },
                    { mesaId: 8, numero: 8, status: 'DISPONIVEL' },
                ],
            }),
            transferirPedido: async (...argumentos) => { transferencias.push(argumentos); },
            iniciarPagamento: async () => { iniciados += 1; },
        },
    });

    const [pedido] = elementos['itens-pedido'].children;
    assert.match(pedido.children[1].children[0].textContent, /Status: Em preparo/);
    const [seletor] = pedido.children[2].children[0].children[0].children;
    const [transferir] = pedido.children[2].children[1].children;
    seletor.value = '8';
    await seletor.listeners.change();
    await transferir.listeners.click();
    assert.deepEqual(transferencias, [[31, 8]]);
    assert.equal(iniciados, 0);
    assert.equal(elementos['iniciar-pagamento'].disabled, false);
});

test('mantem pedido da consulta filtrada mesmo com mesaId divergente no DTO', async () => {
    const ids = [
        'mesa-numero', 'itens-pedido', 'status-pedidos', 'iniciar-pagamento',
        'detalhes-pagamento', 'pagamentos', 'form-pagamento', 'desconto',
        'adicionar-pagamento', 'cancelar-pagamento', 'erro-pagamento', 'sucesso-pagamento',
        'voltar-mapa', 'baixar-comprovante', 'erro-comprovante', 'subtotal',
        'taxa-servico-label', 'taxa-servico', 'desconto-resumo', 'total', 'total-recebido',
        'valor-falta', 'valor-troco', 'confirmar-pagamento',
    ];
    const elementos = Object.fromEntries(ids.map((id) => [id, new ElementoFalso()]));
    const documento = {
        getElementById: (id) => elementos[id],
        createElement: () => new ElementoFalso(),
    };
    let iniciados = 0;
    await inicializarPagamento({
        mesaId: 3,
        documento,
        registrarIntervalo: () => 1,
        limparIntervalo: () => {},
        registrarPagehide: () => {},
        conectarPedidos: async () => ({ deactivate: async () => {} }),
        conectarSessao: async () => ({ deactivate: async () => {} }),
        api: {
            listarPedidos: async () => [{
                pedidoId: 44,
                mesaId: 999,
                status: 'ABERTO',
                taxaServicoPercentual: 10,
                itens: [{ quantidade: 1, produtoNome: 'Prato', precoUnitario: 25, status: 'pronto' }],
            }],
            obterMapaMesas: async () => ({
                mesas: [{ mesaId: 3, numero: 3, status: 'OCUPADA' }],
            }),
            iniciarPagamento: async () => { iniciados += 1; },
        },
    });

    assert.equal(elementos['iniciar-pagamento'].disabled, false);
    await elementos['iniciar-pagamento'].listeners.click();
    assert.equal(iniciados, 1);
    assert.equal(elementos['detalhes-pagamento'].hidden, false);
});

test('tenta iniciar mesmo com status divergente e preserva erro da API se WebSocket falhar', async () => {
    const ids = [
        'mesa-numero', 'itens-pedido', 'status-pedidos', 'iniciar-pagamento',
        'detalhes-pagamento', 'pagamentos', 'form-pagamento', 'desconto',
        'adicionar-pagamento', 'cancelar-pagamento', 'erro-pagamento', 'sucesso-pagamento',
        'voltar-mapa', 'baixar-comprovante', 'erro-comprovante', 'subtotal',
        'taxa-servico-label', 'taxa-servico', 'desconto-resumo', 'total', 'total-recebido',
        'valor-falta', 'valor-troco', 'confirmar-pagamento',
    ];
    const elementos = Object.fromEntries(ids.map((id) => [id, new ElementoFalso()]));
    const documento = {
        getElementById: (id) => elementos[id],
        createElement: () => new ElementoFalso(),
    };
    await inicializarPagamento({
        mesaId: 3,
        documento,
        registrarIntervalo: () => 1,
        limparIntervalo: () => {},
        registrarPagehide: () => {},
        conectarPedidos: async () => ({ deactivate: async () => {} }),
        conectarSessao: async () => { throw new Error('WebSocket indisponível'); },
        api: {
            listarPedidos: async () => [{
                pedidoId: 44,
                status: 'ABERTO',
                itens: [{ quantidade: 1, precoUnitario: 25, status: 'pronto' }],
            }],
            obterMapaMesas: async () => ({
                mesas: [{ mesaId: 3, numero: 3, status: 'EM_PAGAMENTO' }],
            }),
            iniciarPagamento: async () => {
                assert.equal(elementos['status-pedidos'].textContent.includes('WebSocket'), false);
                throw Object.assign(new Error('MESA_JA_EM_PAGAMENTO'), {
                    codigo: 'MESA_JA_EM_PAGAMENTO',
                });
            },
        },
    });

    assert.equal(elementos['iniciar-pagamento'].disabled, false);
    await elementos['iniciar-pagamento'].listeners.click();
    assert.match(elementos['erro-pagamento'].textContent, /fechada em outro caixa/);
    assert.equal(elementos['erro-pagamento'].hidden, false);
    assert.match(elementos['status-pedidos'].textContent, /Mesa Em pagamento/);
});

test('lista pedidos filtrados por mesa e inicia ou cancela o fechamento', async () => {
    const fetchOriginal = globalThis.fetch;
    const storageOriginal = globalThis.localStorage;
    const requisicoes = [];
    globalThis.localStorage = {
        getItem: () => JSON.stringify({ token: 'token-caixa', perfil: 'caixa' }),
    };
    globalThis.fetch = async (url, opcoes) => {
        requisicoes.push({ url, opcoes });
        return { ok: true, status: 200, json: async () => [] };
    };

    try {
        await listarPedidos({ mesaId: 12 });
        await iniciarPagamento(12);
        await cancelarPagamento(12);
        assert.deepEqual(requisicoes.map(({ url, opcoes }) => [url, opcoes.method]), [
            ['/api/pedidos?mesaId=12', 'GET'],
            ['/api/mesas/12/pagamento/iniciar', 'POST'],
            ['/api/mesas/12/pagamento/cancelar', 'POST'],
        ]);
        assert.ok(requisicoes.every(({ opcoes }) => opcoes.headers.Authorization.endsWith('token-caixa')));
    } finally {
        globalThis.fetch = fetchOriginal;
        globalThis.localStorage = storageOriginal;
    }
});

test('processa pagamento da mesa com pagamentos fracionados e desconto', async () => {
    const fetchOriginal = globalThis.fetch;
    const storageOriginal = globalThis.localStorage;
    let requisicao;
    globalThis.localStorage = {
        getItem: () => JSON.stringify({ token: 'token-caixa', perfil: 'caixa' }),
    };
    globalThis.fetch = async (url, opcoes) => {
        requisicao = { url, opcoes };
        return { ok: true, status: 200, json: async () => ({ sucesso: true }) };
    };

    try {
        await processarPagamento(12, {
            pagamentos: [
                { formaPagamento: 'pix', valor: 100 },
                { formaPagamento: 'dinheiro', valor: 43 },
            ],
            desconto: 0,
        });

        assert.equal(requisicao.url, '/api/mesas/12/pagamento/processar');
        assert.equal(requisicao.opcoes.method, 'POST');
        assert.equal(requisicao.opcoes.headers['Content-Type'], 'application/json');
        assert.equal(requisicao.opcoes.headers.Authorization, 'Bearer token-caixa');
        assert.deepEqual(JSON.parse(requisicao.opcoes.body), {
            pagamentos: [
                { formaPagamento: 'pix', valor: 100 },
                { formaPagamento: 'dinheiro', valor: 43 },
            ],
            desconto: 0,
        });
    } finally {
        globalThis.fetch = fetchOriginal;
        globalThis.localStorage = storageOriginal;
    }
});

test('omite desconto quando não informado', async () => {
    const fetchOriginal = globalThis.fetch;
    const storageOriginal = globalThis.localStorage;
    let corpo;
    globalThis.localStorage = {
        getItem: () => JSON.stringify({ token: 'token-caixa', perfil: 'caixa' }),
    };
    globalThis.fetch = async (_url, opcoes) => {
        corpo = JSON.parse(opcoes.body);
        return { ok: true, status: 200, json: async () => ({ sucesso: true }) };
    };

    try {
        await processarPagamento(12, { pagamentos: [{ formaPagamento: 'pix', valor: 143 }] });
        assert.deepEqual(corpo, { pagamentos: [{ formaPagamento: 'pix', valor: 143 }] });
    } finally {
        globalThis.fetch = fetchOriginal;
        globalThis.localStorage = storageOriginal;
    }
});

test('baixa comprovante PDF com token JWT e nome baseado no pedido', async () => {
    const fetchOriginal = globalThis.fetch;
    const storageOriginal = globalThis.localStorage;
    const documentOriginal = globalThis.document;
    const createObjectURLOriginal = URL.createObjectURL;
    const revokeObjectURLOriginal = URL.revokeObjectURL;
    let requisicao;
    let arquivoBaixado;
    globalThis.localStorage = {
        getItem: () => JSON.stringify({ token: 'token-caixa', perfil: 'caixa' }),
    };
    globalThis.fetch = async (url, opcoes) => {
        requisicao = { url, opcoes };
        return { ok: true, blob: async () => new Blob(['pdf'], { type: 'application/pdf' }) };
    };
    URL.createObjectURL = (arquivo) => {
        arquivoBaixado = { arquivo };
        return 'blob:comprovante';
    };
    URL.revokeObjectURL = (url) => { arquivoBaixado.urlRevogada = url; };
    globalThis.document = {
        createElement: () => ({
            click() {
                arquivoBaixado.href = this.href;
                arquivoBaixado.nome = this.download;
            },
        }),
    };

    try {
        await baixarComprovantePedido(321);
        assert.equal(requisicao.url, '/api/pedidos/321/comprovante-pdf');
        assert.equal(requisicao.opcoes.method, 'GET');
        assert.ok(requisicao.opcoes.headers.Authorization.endsWith('token-caixa'));
        assert.equal(arquivoBaixado.href, 'blob:comprovante');
        assert.equal(arquivoBaixado.nome, 'comprovante-321.pdf');
        assert.equal(arquivoBaixado.arquivo.type, 'application/pdf');
        assert.equal(arquivoBaixado.urlRevogada, 'blob:comprovante');
    } finally {
        globalThis.fetch = fetchOriginal;
        globalThis.localStorage = storageOriginal;
        globalThis.document = documentOriginal;
        URL.createObjectURL = createObjectURLOriginal;
        URL.revokeObjectURL = revokeObjectURLOriginal;
    }
});

test('retorna o código de erro da API ao baixar comprovante', async () => {
    const fetchOriginal = globalThis.fetch;
    const storageOriginal = globalThis.localStorage;
    globalThis.localStorage = {
        getItem: () => JSON.stringify({ token: 'token-caixa', perfil: 'caixa' }),
    };
    globalThis.fetch = async () => ({
        ok: false,
        status: 409,
        json: async () => ({ erro: 'CONTA_NAO_PAGA' }),
    });

    try {
        await assert.rejects(baixarComprovantePedido(321), (erro) => {
            assert.equal(erro.message, 'CONTA_NAO_PAGA');
            assert.equal(erro.codigo, 'CONTA_NAO_PAGA');
            assert.equal(erro.status, 409);
            return true;
        });
    } finally {
        globalThis.fetch = fetchOriginal;
        globalThis.localStorage = storageOriginal;
    }
});

test('habilita comprovante com um pedido pago e mostra falhas do download', async () => {
    const botao = {
        disabled: false,
        callbacks: [],
        addEventListener(_evento, callback) { this.callbacks.push(callback); },
    };
    const mensagem = { textContent: '' };
    let pedidoSolicitado;
    const habilitar = configurarBotaoComprovante({
        botao,
        mensagem,
    });

    assert.equal(botao.disabled, true);
    habilitar({ pedidosPagos: [321, 322] });
    assert.equal(botao.disabled, false);

    const callback = botao.callbacks[0];
    const apiOriginal = globalThis.fetch;
    const storageOriginal = globalThis.localStorage;
    globalThis.localStorage = {
        getItem: () => JSON.stringify({ token: 'token-caixa', perfil: 'caixa' }),
    };
    globalThis.fetch = async (url) => {
        pedidoSolicitado = url;
        return { ok: false, status: 409, json: async () => ({ erro: 'CONTA_NAO_PAGA' }) };
    };

    try {
        await callback();
        assert.equal(pedidoSolicitado, '/api/pedidos/321/comprovante-pdf');
        assert.equal(mensagem.textContent, 'CONTA_NAO_PAGA');
        assert.equal(botao.disabled, false);
    } finally {
        globalThis.fetch = apiOriginal;
        globalThis.localStorage = storageOriginal;
    }

    habilitar({ pedidosPagos: [] });
    assert.equal(botao.disabled, true);
});
