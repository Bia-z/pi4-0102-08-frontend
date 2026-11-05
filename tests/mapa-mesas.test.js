import test from 'node:test';
import assert from 'node:assert/strict';
import { obterMapaMesas } from '../assets/js/core/api.js';
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
