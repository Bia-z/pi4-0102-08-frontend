import test from 'node:test';
import assert from 'node:assert/strict';
import { conectarAtualizacoesMesas } from '../assets/js/core/ws.js';

test('conecta ao STOMP autenticado e encaminha eventos de status da mesa', async () => {
    const storageOriginal = globalThis.localStorage;
    const windowOriginal = globalThis.window;
    globalThis.localStorage = {
        getItem: () => JSON.stringify({ token: 'token-caixa', perfil: 'caixa' }),
    };
    globalThis.window = { location: { protocol: 'https:', host: 'restmanager.local' } };

    let opcoes;
    let assinatura;
    let destino;
    let ativado = false;
    let conectado = false;
    let eventoRecebido;
    const cliente = {
        activate() { ativado = true; },
        subscribe(topico, callback) {
            destino = topico;
            assinatura = callback;
        },
    };

    try {
        const resultado = await conectarAtualizacoesMesas({
            criarCliente: (configuracao) => {
                opcoes = configuracao;
                return cliente;
            },
            aoConectar: () => { conectado = true; },
            aoAtualizar: (evento) => { eventoRecebido = evento; },
        });

        assert.equal(resultado, cliente);
        assert.equal(opcoes.brokerURL, 'wss://restmanager.local/ws');
        assert.deepEqual(opcoes.connectHeaders, { Authorization: 'Bearer token-caixa' });
        assert.equal(ativado, true);

        opcoes.onConnect();
        assert.equal(conectado, true);
        assert.equal(destino, '/topic/mesas');
        assinatura({
            body: JSON.stringify({ tipo: 'statusMesaAtualizado', mesaId: 12, status: 'disponivel' }),
        });
        await new Promise((resolve) => setImmediate(resolve));
        assert.deepEqual(eventoRecebido, {
            tipo: 'statusMesaAtualizado',
            mesaId: 12,
            status: 'disponivel',
        });
    } finally {
        globalThis.localStorage = storageOriginal;
        globalThis.window = windowOriginal;
    }
});

test('reporta erro quando uma mensagem recebida não contém JSON válido', async () => {
    const storageOriginal = globalThis.localStorage;
    const windowOriginal = globalThis.window;
    globalThis.localStorage = {
        getItem: () => JSON.stringify({ token: 'token-caixa', perfil: 'caixa' }),
    };
    globalThis.window = { location: { protocol: 'http:', host: 'localhost:3000' } };
    let erroRecebido;
    let opcoes;

    try {
        await conectarAtualizacoesMesas({
            criarCliente: (configuracao) => {
                opcoes = configuracao;
                return { activate() {}, subscribe: (_topico, callback) => { opcoes.callback = callback; } };
            },
            aoAtualizar: () => {},
            aoErro: (erro) => { erroRecebido = erro; },
        });
        opcoes.onConnect();
        opcoes.callback({ body: 'não é JSON' });
        assert.ok(erroRecebido instanceof SyntaxError);
    } finally {
        globalThis.localStorage = storageOriginal;
        globalThis.window = windowOriginal;
    }
});
