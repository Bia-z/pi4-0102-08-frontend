import test from 'node:test';
import assert from 'node:assert/strict';
import { processarPagamento } from '../assets/js/core/api.js';

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
