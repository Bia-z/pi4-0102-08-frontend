import test from 'node:test';
import assert from 'node:assert/strict';
import { infoStatusItem, ordenarPorChegada } from '../cozinha/js/painel.js';
import { conectarAtualizacoesCozinha } from '../assets/js/core/ws.js';

test('ordena os pedidos por ordem de chegada sem alterar a lista original', () => {
    const lista = [
        { id: 2, dataCriacao: '2026-11-09T12:10:00' },
        { id: 1, dataCriacao: '2026-11-09T12:00:00' },
    ];

    assert.deepEqual(ordenarPorChegada(lista).map((pedido) => pedido.id), [1, 2]);
    assert.equal(lista[0].id, 2);
});

test('cada status de item indica a próxima etapa da cozinha', () => {
    assert.equal(infoStatusItem('aguardando').proximo, 'em_preparo');
    assert.equal(infoStatusItem('aguardando').acao, 'Iniciar preparo');
    assert.equal(infoStatusItem('em_preparo').proximo, 'pronto');
    assert.equal(infoStatusItem('em_preparo').acao, 'Marcar como pronto');
    assert.equal(infoStatusItem('pronto').proximo, undefined);
});

test('cozinha conecta em /topic/cozinha e /topic/pedidos e repassa os eventos', async () => {
    const storageOriginal = globalThis.localStorage;
    const windowOriginal = globalThis.window;
    globalThis.localStorage = {
        getItem: () => JSON.stringify({ token: 'token-cozinha', perfil: 'cozinha' }),
    };
    globalThis.window = { location: { protocol: 'http:', host: 'localhost:3000' } };
    let opcoes;
    const assinaturas = {};
    const recebidos = [];
    try {
        await conectarAtualizacoesCozinha({
            criarCliente: (configuracao) => {
                opcoes = configuracao;
                return { activate() {}, subscribe(topico, receber) { assinaturas[topico] = receber; } };
            },
            aoAtualizar: (evento) => { recebidos.push(evento.tipo); },
        });
        opcoes.onConnect();
        assinaturas['/topic/cozinha']({ body: JSON.stringify({ tipo: 'pedidoCriado', pedidoId: 1 }) });
        assinaturas['/topic/pedidos']({ body: JSON.stringify({ tipo: 'statusPedidoAtualizado', pedidoId: 1 }) });
        assinaturas['/topic/pedidos']({ body: JSON.stringify({ tipo: 'outro' }) });
        await Promise.resolve();

        assert.equal(opcoes.connectHeaders.Authorization, 'Bearer token-cozinha');
        assert.deepEqual(Object.keys(assinaturas), ['/topic/cozinha', '/topic/pedidos']);
        assert.deepEqual(recebidos, ['pedidoCriado', 'statusPedidoAtualizado']);
    } finally {
        globalThis.localStorage = storageOriginal;
        globalThis.window = windowOriginal;
    }
});
