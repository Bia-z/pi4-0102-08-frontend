import test from 'node:test';
import assert from 'node:assert/strict';
import {
    aplicarStatusItem,
    contarProntos,
    descreverItemPronto,
    infoStatusItem,
} from '../garcom/js/acompanhamento.js';
import { conectarAtualizacoesPedidos } from '../assets/js/core/ws.js';
import { carregarMapaMesas } from '../assets/js/core/mapa-mesas.js';

function pedidos() {
    return [{
        id: 101,
        numeroMesa: 8,
        itens: [
            { id: 201, produtoNome: 'Bruschetta Italiana', quantidade: 2, status: 'em_preparo' },
            { id: 202, produtoNome: 'Suco de laranja', quantidade: 1, status: 'aguardando' },
        ],
    }];
}

test('aplica o evento de status no item certo sem mexer nos outros', () => {
    const lista = pedidos();
    const resultado = aplicarStatusItem(lista, {
        pedidoId: 101, itemId: 201, numeroMesa: 8, status: 'pronto',
    });

    assert.equal(resultado.encontrado, true);
    assert.equal(resultado.mudou, true);
    assert.equal(resultado.pedidos[0].itens[0].status, 'pronto');
    assert.equal(resultado.pedidos[0].itens[1].status, 'aguardando');
    assert.equal(lista[0].itens[0].status, 'em_preparo', 'não altera a lista original');
    assert.equal(contarProntos(resultado.pedidos[0]), 1);
});

test('evento repetido não conta como mudança', () => {
    const resultado = aplicarStatusItem(pedidos(), {
        pedidoId: 101, itemId: 201, numeroMesa: 8, status: 'em_preparo',
    });

    assert.equal(resultado.encontrado, true);
    assert.equal(resultado.mudou, false);
});

test('item de pedido desconhecido pede nova busca na API', () => {
    const resultado = aplicarStatusItem(pedidos(), {
        pedidoId: 999, itemId: 1, numeroMesa: 3, status: 'pronto',
    });

    assert.equal(resultado.encontrado, false);
});

test('descreve o item pronto com mesa, quantidade e nome', () => {
    const resultado = aplicarStatusItem(pedidos(), {
        pedidoId: 101, itemId: 201, numeroMesa: 8, status: 'pronto',
    });

    assert.equal(descreverItemPronto(resultado), 'Mesa 8: 2× Bruschetta Italiana pronto para servir.');
});

test('status de item têm texto em português', () => {
    assert.equal(infoStatusItem('pronto').texto, 'Pronto para servir');
    assert.equal(infoStatusItem('em_preparo').texto, 'Em preparo');
    assert.equal(infoStatusItem('aguardando').texto, 'Aguardando');
});

test('garçom conecta em /topic/pedidos com o próprio token', async () => {
    const storageOriginal = globalThis.localStorage;
    const windowOriginal = globalThis.window;
    globalThis.localStorage = {
        getItem: () => JSON.stringify({ token: 'token-garcom', perfil: 'garcom', usuarioId: 2 }),
    };
    globalThis.window = { location: { protocol: 'http:', host: 'localhost:3000' } };
    let opcoes;
    let destino;
    try {
        await conectarAtualizacoesPedidos({
            criarCliente: (configuracao) => {
                opcoes = configuracao;
                return { activate() {}, subscribe(topico) { destino = topico; } };
            },
            aoAtualizar: () => {},
        });
        opcoes.onConnect();

        assert.equal(opcoes.brokerURL, 'ws://localhost:3000/ws');
        assert.equal(opcoes.connectHeaders.Authorization, 'Bearer token-garcom');
        assert.equal(destino, '/topic/pedidos');
    } finally {
        globalThis.localStorage = storageOriginal;
        globalThis.window = windowOriginal;
    }
});

class ElementoFake {
    constructor() {
        this.children = [];
        this.textContent = '';
    }
    append(...elementos) { this.children.push(...elementos); }
    appendChild(elemento) { this.children.push(elemento); }
    hasChildNodes() { return this.children.length > 0; }
    replaceChildren(...elementos) { this.children = [...elementos]; this.textContent = ''; }
    addEventListener() {}
    setAttribute() {}
}

test('mapa do garçom oferece lançar pedido e bloqueia mesa em pagamento', async () => {
    const original = globalThis.document;
    globalThis.document = { createElement: () => new ElementoFake() };
    const mapa = new ElementoFake();
    try {
        await carregarMapaMesas({
            mapa,
            perfil: 'garcom',
            permitirLancamento: true,
            obterMapa: async () => ({
                mesas: [
                    { mesaId: 5, numero: 5, status: 'disponivel', valorConsumido: 0 },
                    { mesaId: 8, numero: 8, status: 'em_pagamento', valorConsumido: 10 },
                ],
            }),
        });

        const [livre, emPagamento] = mapa.children;
        const lancar = livre.children[0].children[3];
        assert.equal(lancar.textContent, 'Lançar pedido');
        assert.equal(lancar.href, '/garcom/pedido.html?mesaId=5');

        const bloqueado = emPagamento.children[0].children.at(-1);
        assert.equal(bloqueado.textContent, 'Mesa em pagamento');
        assert.equal(bloqueado.disabled, true);
        assert.equal(bloqueado.href, undefined);
    } finally {
        globalThis.document = original;
    }
});

test('mapa sem permitirLancamento (caixa) não mostra o botão de lançar pedido', async () => {
    const original = globalThis.document;
    globalThis.document = { createElement: () => new ElementoFake() };
    const mapa = new ElementoFake();
    try {
        await carregarMapaMesas({
            mapa,
            perfil: 'caixa',
            obterMapa: async () => ({
                mesas: [{ mesaId: 5, numero: 5, status: 'disponivel', valorConsumido: 0 }],
            }),
        });

        assert.equal(mapa.children[0].children[0].children.length, 3);
    } finally {
        globalThis.document = original;
    }
});
