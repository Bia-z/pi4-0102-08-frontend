import test from 'node:test';
import assert from 'node:assert/strict';
import { obterMapaMesas, transferirPedidoParaMesa } from '../assets/js/core/api.js';
import { carregarMapaMesas } from '../assets/js/core/mapa-mesas.js';

class ElementoFake {
    constructor() {
        this.children = [];
        this.textContent = '';
    }

    append(...elementos) {
        this.children.push(...elementos);
    }

    appendChild(elemento) {
        this.children.push(elemento);
    }

    hasChildNodes() {
        return this.children.length > 0;
    }

    replaceChildren(...elementos) {
        this.children = [...elementos];
        this.textContent = '';
    }
}

function instalarDocumento() {
    const documentoOriginal = globalThis.document;
    globalThis.document = { createElement: () => new ElementoFake() };
    return () => { globalThis.document = documentoOriginal; };
}

test('consulta o mapa de mesas por GET autenticado', async () => {
    const fetchOriginal = globalThis.fetch;
    const storageOriginal = globalThis.localStorage;
    let requisicao;
    globalThis.localStorage = {
        getItem: () => JSON.stringify({ token: 'token-caixa', perfil: 'caixa' }),
    };
    globalThis.fetch = async (url, opcoes) => {
        requisicao = { url, opcoes };
        return { ok: true, status: 200, json: async () => ({ mesas: [] }) };
    };

    try {
        await obterMapaMesas();
        assert.equal(requisicao.url, '/api/mesas/mapa');
        assert.equal(requisicao.opcoes.method, 'GET');
        assert.ok(requisicao.opcoes.headers.Authorization.startsWith('Bearer '));
        assert.ok(requisicao.opcoes.headers.Authorization.endsWith('token-caixa'));
    } finally {
        globalThis.fetch = fetchOriginal;
        globalThis.localStorage = storageOriginal;
    }
});

test('transfere pedido para mesa com POST autenticado e destino informado', async () => {
    const fetchOriginal = globalThis.fetch;
    const storageOriginal = globalThis.localStorage;
    let requisicao;
    globalThis.localStorage = {
        getItem: () => JSON.stringify({ token: 'token-caixa', perfil: 'caixa' }),
    };
    globalThis.fetch = async (url, opcoes) => {
        requisicao = { url, opcoes };
        return {
            ok: true,
            status: 200,
            json: async () => ({
                pedidoId: 31,
                mesaOrigemId: 7,
                mesaDestinoId: 8,
                transferidoEm: '2026-11-06T15:00:00Z',
            }),
        };
    };

    try {
        const resultado = await transferirPedidoParaMesa(31, 8);
        assert.equal(requisicao.url, '/api/pedidos/31/transferir-mesa');
        assert.equal(requisicao.opcoes.method, 'POST');
        assert.equal(requisicao.opcoes.headers['Content-Type'], 'application/json');
        assert.ok(requisicao.opcoes.headers.Authorization.endsWith('token-caixa'));
        assert.deepEqual(JSON.parse(requisicao.opcoes.body), { mesaDestinoId: 8 });
        assert.equal(resultado.pedidoId, 31);
        assert.equal(resultado.mesaOrigemId, 7);
        assert.equal(resultado.mesaDestinoId, 8);
        assert.ok(resultado.transferidoEm);
    } finally {
        globalThis.fetch = fetchOriginal;
        globalThis.localStorage = storageOriginal;
    }
});

test('preserva os códigos de erro do endpoint de transferência', async (context) => {
    const fetchOriginal = globalThis.fetch;
    const storageOriginal = globalThis.localStorage;
    const erros = [
        ['MESA_DESTINO_OCUPADA', 'A mesa de destino não está disponível. Escolha outra mesa.'],
        ['MESA_EM_PAGAMENTO', 'Não é possível transferir o pedido porque a mesa está em pagamento.'],
        ['PEDIDO_NAO_EM_ABERTO', 'Somente pedidos em aberto podem ser transferidos.'],
        ['MESA_NAO_ENCONTRADA', 'A mesa de destino não foi encontrada. Atualize a lista e tente novamente.'],
    ];
    globalThis.localStorage = {
        getItem: () => JSON.stringify({ token: 'token-caixa', perfil: 'caixa' }),
    };

    try {
        for (const [codigo, mensagem] of erros) {
            await context.test(codigo, async () => {
                globalThis.fetch = async () => ({
                    ok: false,
                    status: 409,
                    json: async () => ({ erro: codigo }),
                });
                await assert.rejects(transferirPedidoParaMesa(31, 8), (erro) => {
                    assert.equal(erro.codigo, codigo);
                    assert.equal(erro.message, mensagem);
                    return true;
                });
            });
        }
    } finally {
        globalThis.fetch = fetchOriginal;
        globalThis.localStorage = storageOriginal;
    }
});

test('renderiza número, status e valor consumido para cada mesa', async () => {
    const restaurarDocumento = instalarDocumento();
    const mapa = new ElementoFake();
    try {
        await carregarMapaMesas({
            mapa,
            obterMapa: async () => ({
                mesas: [{ numero: 7, status: 'em_pagamento', valorConsumido: 42.5 }],
            }),
        });

        assert.equal(mapa.children.length, 1);
        const [card] = mapa.children;
        assert.equal(card.children[0].children[0].textContent, 'Mesa 7');
        assert.equal(card.children[0].children[1].textContent, 'Status: Em pagamento');
        assert.equal(card.children[0].children[2].textContent, 'Consumido: R$ 42,50');
    } finally {
        restaurarDocumento();
    }
});

test('exibe opção para fechar somente mesas ocupadas com identificação', async () => {
    const restaurarDocumento = instalarDocumento();
    const mapa = new ElementoFake();
    try {
        await carregarMapaMesas({
            mapa,
            permitirFechamento: true,
            obterMapa: async () => ({
                mesas: [
                    { mesaId: 7, numero: 7, status: 'ocupada', valorConsumido: 42.5 },
                    { mesaId: 8, numero: 8, status: 'em_pagamento', valorConsumido: 10 },
                ],
            }),
        });

        const [ocupada, emPagamento] = mapa.children;
        const acaoFechar = ocupada.children[0].children[3];
        assert.equal(acaoFechar.textContent, 'Fechar conta');
        assert.equal(acaoFechar.href, '/caixa/pagamento.html?mesaId=7');
        assert.equal(emPagamento.children[0].children.length, 3);
    } finally {
        restaurarDocumento();
    }
});

test('mostra mensagem quando o mapa está vazio ou a API falha', async () => {
    const restaurarDocumento = instalarDocumento();
    const mapa = new ElementoFake();
    try {
        await carregarMapaMesas({ mapa, obterMapa: async () => ({ mesas: [] }) });
        assert.equal(mapa.textContent, 'Nenhuma mesa disponível para exibição.');

        await carregarMapaMesas({
            mapa,
            obterMapa: async () => { throw new Error('Falha de rede'); },
        });
        assert.equal(mapa.textContent, 'Não foi possível carregar as mesas: Falha de rede');
    } finally {
        restaurarDocumento();
    }
});
