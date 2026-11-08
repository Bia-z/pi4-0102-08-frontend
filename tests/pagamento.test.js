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
    mensagemErroPagamento,
} from '../caixa/js/pagamento.js';

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
