import test from 'node:test';
import assert from 'node:assert/strict';
import { atualizarStatusItemPedido } from '../assets/js/core/api.js';
import { conectarAtualizacoesPedidos } from '../assets/js/core/ws.js';

test('atualiza status do item do pedido com PATCH autenticado', async () => {
    const fetchOriginal = globalThis.fetch;
    const storageOriginal = globalThis.localStorage;
    let requisicao;
    globalThis.localStorage = {
        getItem: () => JSON.stringify({ token: 'token-cozinha', perfil: 'cozinha' }),
    };
    globalThis.fetch = async (url, opcoes) => {
        requisicao = { url, opcoes };
        return {
            ok: true,
            status: 200,
            json: async () => ({
                pedidoId: 101,
                itemId: 201,
                status: 'em_preparo',
                atualizadoEm: '2026-11-06T15:00:00Z',
            }),
        };
    };

    try {
        const resultado = await atualizarStatusItemPedido(101, 201, 'em_preparo');
        assert.equal(requisicao.url, '/api/pedidos/101/itens/201/status');
        assert.equal(requisicao.opcoes.method, 'PATCH');
        assert.equal(requisicao.opcoes.headers['Content-Type'], 'application/json');
        assert.ok(requisicao.opcoes.headers.Authorization.endsWith('token-cozinha'));
        assert.deepEqual(JSON.parse(requisicao.opcoes.body), { novoStatus: 'em_preparo' });
        assert.equal(resultado.status, 'em_preparo');
        assert.ok(resultado.atualizadoEm);
    } finally {
        globalThis.fetch = fetchOriginal;
        globalThis.localStorage = storageOriginal;
    }
});

test('conecta ao tópico de pedidos e encaminha apenas eventos de status de item', async () => {
    const storageOriginal = globalThis.localStorage;
    const windowOriginal = globalThis.window;
    globalThis.localStorage = {
        getItem: () => JSON.stringify({ token: 'token-cozinha', perfil: 'cozinha' }),
    };
    globalThis.window = { location: { protocol: 'https:', host: 'restmanager.local' } };

    let opcoes;
    let assinatura;
    let destino;
    let eventoRecebido;
    const cliente = {
        activate() {},
        subscribe(topico, callback) {
            destino = topico;
            assinatura = callback;
        },
    };

    try {
        await conectarAtualizacoesPedidos({
            criarCliente: (configuracao) => {
                opcoes = configuracao;
                return cliente;
            },
            aoAtualizar: (evento) => { eventoRecebido = evento; },
        });

        assert.equal(opcoes.brokerURL, 'wss://restmanager.local/ws');
        assert.ok(opcoes.connectHeaders.Authorization.endsWith('token-cozinha'));
        opcoes.onConnect();
        assert.equal(destino, '/topic/pedidos');

        assinatura({
            body: JSON.stringify({
                tipo: 'statusPedidoAtualizado',
                pedidoId: 101,
                itemId: 201,
                numeroMesa: 8,
                status: 'em_preparo',
                atualizadoEm: '2026-11-06T15:00:00Z',
            }),
        });
        await new Promise((resolve) => setImmediate(resolve));
        assert.equal(eventoRecebido.pedidoId, 101);
        assert.equal(eventoRecebido.itemId, 201);
        assert.equal(eventoRecebido.status, 'em_preparo');

        eventoRecebido = undefined;
        assinatura({ body: JSON.stringify({ tipo: 'pedidoCriado' }) });
        assert.equal(eventoRecebido, undefined);
    } finally {
        globalThis.localStorage = storageOriginal;
        globalThis.window = windowOriginal;
    }
});
