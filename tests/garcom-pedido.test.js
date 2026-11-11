import test from 'node:test';
import assert from 'node:assert/strict';
import { criarPedido, listarPedidos } from '../assets/js/core/api.js';
import { salvarSessao } from '../assets/js/core/auth.js';
import {
    adicionarItem,
    alterarQuantidade,
    calcularSubtotal,
    definirObservacao,
    enviarPedido,
    mesaBloqueada,
    montarPedido,
    removerItem,
} from '../garcom/js/pedido.js';

const bruschetta = { id: 10, nome: 'Bruschetta Italiana', preco: 28 };
const suco = { id: 11, nome: 'Suco de laranja', preco: '9.50' };

function instalarStorage(sessao = { token: 'token-garcom', perfil: 'garcom', usuarioId: 2 }) {
    const original = globalThis.localStorage;
    globalThis.localStorage = {
        getItem: () => JSON.stringify(sessao),
        setItem: (chave, valor) => { globalThis.localStorage.ultimo = [chave, valor]; },
    };
    return () => { globalThis.localStorage = original; };
}

test('mesmo produto sem observação soma a quantidade na mesma linha', () => {
    let carrinho = adicionarItem([], bruschetta);
    carrinho = adicionarItem(carrinho, bruschetta);

    assert.equal(carrinho.length, 1);
    assert.equal(carrinho[0].quantidade, 2);
});

test('produto com observação vira uma linha separada', () => {
    let carrinho = adicionarItem([], bruschetta);
    carrinho = definirObservacao(carrinho, carrinho[0].linhaId, 'Sem cebola');
    carrinho = adicionarItem(carrinho, bruschetta);

    assert.equal(carrinho.length, 2);
    assert.notEqual(carrinho[0].linhaId, carrinho[1].linhaId);
    assert.equal(carrinho[1].observacao, '');
});

test('diminuir até zero remove a linha e remover apaga a linha escolhida', () => {
    let carrinho = adicionarItem(adicionarItem([], bruschetta), suco);
    carrinho = alterarQuantidade(carrinho, carrinho[0].linhaId, -1);
    assert.deepEqual(carrinho.map((linha) => linha.produtoId), [11]);

    carrinho = removerItem(carrinho, carrinho[0].linhaId);
    assert.deepEqual(carrinho, []);
});

test('calcula o subtotal com preços numéricos ou em texto', () => {
    let carrinho = adicionarItem(adicionarItem([], bruschetta), suco);
    carrinho = alterarQuantidade(carrinho, carrinho[0].linhaId, 1);

    assert.equal(calcularSubtotal(carrinho), 28 * 2 + 9.5);
});

test('monta o corpo do CT7 sem observação vazia', () => {
    let carrinho = adicionarItem(adicionarItem([], bruschetta), suco);
    carrinho = definirObservacao(carrinho, carrinho[0].linhaId, '  Sem cebola  ');
    carrinho = definirObservacao(carrinho, carrinho[1].linhaId, '   ');

    assert.deepEqual(montarPedido({ mesaId: '5', garcomId: 2, carrinho }), {
        mesaId: 5,
        garcomId: 2,
        itens: [
            { produtoId: 10, quantidade: 1, observacao: 'Sem cebola' },
            { produtoId: 11, quantidade: 1 },
        ],
    });
});

test('mesa em pagamento é considerada bloqueada', () => {
    assert.equal(mesaBloqueada({ status: 'em_pagamento' }), true);
    assert.equal(mesaBloqueada({ status: 'ocupada' }), false);
    assert.equal(mesaBloqueada(undefined), false);
});

test('enviarPedido valida mesa, itens e identificação do garçom antes de chamar a API', async () => {
    let chamadas = 0;
    const criar = async () => { chamadas += 1; return {}; };
    const carrinho = adicionarItem([], bruschetta);

    assert.equal((await enviarPedido({ mesaId: '', carrinho, sessao: { usuarioId: 2 }, criar })).ok, false);
    assert.equal((await enviarPedido({ mesaId: '5', carrinho: [], sessao: { usuarioId: 2 }, criar })).ok, false);
    const semGarcom = await enviarPedido({ mesaId: '5', carrinho, sessao: {}, criar });
    assert.equal(semGarcom.ok, false);
    assert.match(semGarcom.mensagem, /entre novamente/);
    assert.equal(chamadas, 0);
});

test('enviarPedido devolve o pedido criado', async () => {
    let corpo;
    const resultado = await enviarPedido({
        mesaId: '5',
        carrinho: adicionarItem([], bruschetta),
        sessao: { usuarioId: 2 },
        criar: async (dados) => { corpo = dados; return { id: 101, status: 'aguardando' }; },
    });

    assert.equal(resultado.ok, true);
    assert.equal(resultado.pedido.id, 101);
    assert.equal(corpo.garcomId, 2);
});

test('enviarPedido traduz MESA_EM_PAGAMENTO para uma mensagem ao garçom', async () => {
    const resultado = await enviarPedido({
        mesaId: '5',
        carrinho: adicionarItem([], bruschetta),
        sessao: { usuarioId: 2 },
        criar: async () => {
            const erro = new Error('MESA_EM_PAGAMENTO');
            erro.codigo = 'MESA_EM_PAGAMENTO';
            throw erro;
        },
    });

    assert.equal(resultado.ok, false);
    assert.equal(resultado.codigo, 'MESA_EM_PAGAMENTO');
    assert.match(resultado.mensagem, /em pagamento no caixa/);
});

test('criarPedido faz POST autenticado em /api/pedidos', async () => {
    const fetchOriginal = globalThis.fetch;
    const restaurar = instalarStorage();
    let requisicao;
    globalThis.fetch = async (url, opcoes) => {
        requisicao = { url, opcoes };
        return { ok: true, status: 201, json: async () => ({ id: 101, status: 'aguardando' }) };
    };
    try {
        const corpo = { mesaId: 5, garcomId: 2, itens: [{ produtoId: 10, quantidade: 2 }] };
        const resposta = await criarPedido(corpo);

        assert.equal(requisicao.url, '/api/pedidos');
        assert.equal(requisicao.opcoes.method, 'POST');
        assert.equal(requisicao.opcoes.headers.Authorization, 'Bearer token-garcom');
        assert.deepEqual(JSON.parse(requisicao.opcoes.body), corpo);
        assert.equal(resposta.id, 101);
    } finally {
        globalThis.fetch = fetchOriginal;
        restaurar();
    }
});

test('listarPedidos filtra pelo garçom logado', async () => {
    const fetchOriginal = globalThis.fetch;
    const restaurar = instalarStorage();
    let url;
    globalThis.fetch = async (endereco) => {
        url = endereco;
        return { ok: true, status: 200, json: async () => [] };
    };
    try {
        await listarPedidos({ garcomId: 2 });
        assert.equal(url, '/api/pedidos?garcomId=2');
        await listarPedidos({ mesaId: 5, garcomId: 2 });
        assert.equal(url, '/api/pedidos?mesaId=5&garcomId=2');
        await listarPedidos();
        assert.equal(url, '/api/pedidos');
    } finally {
        globalThis.fetch = fetchOriginal;
        restaurar();
    }
});

test('a sessão guarda o usuarioId devolvido no login', () => {
    const original = globalThis.localStorage;
    let salvo;
    globalThis.localStorage = { setItem: (_chave, valor) => { salvo = JSON.parse(valor); } };
    try {
        salvarSessao({ token: 'abc', tipoToken: 'Bearer', perfil: 'garcom', usuarioId: 7 }, 'G001');
        assert.equal(salvo.usuarioId, 7);
        assert.equal(salvo.codigo, 'G001');
    } finally {
        globalThis.localStorage = original;
    }
});
