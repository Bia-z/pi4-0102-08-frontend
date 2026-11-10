import test from 'node:test';
import assert from 'node:assert/strict';
import { obterMapaMesas, transferirPedidoParaMesa } from '../assets/js/core/api.js';
import {
    carregarMapaMesas,
    inicializarMapaMesas,
    podeTransferirPedidos,
} from '../assets/js/core/mapa-mesas.js';

class ElementoFake {
    constructor() {
        this.children = [];
        this.textContent = '';
        this.listeners = {};
        this.value = '';
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

    addEventListener(tipo, callback) {
        this.listeners[tipo] = callback;
    }

    setAttribute() {}
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
        ['MESA_EM_PAGAMENTO', 'Não é possível transferir o pedido porque a mesa de origem ou de destino está em pagamento.'],
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
        assert.equal(card.children[0].children[1].textContent, 'Em pagamento');
        assert.equal(card.children[0].children[2].textContent, 'Consumido: R$ 42,50');
    } finally {
        restaurarDocumento();
    }
});

test('encaminha mesas ocupadas e em pagamento para a tela de pagamento e transferência', async () => {
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
        const abrirDetalhes = ocupada.children[0].children[3];
        assert.equal(abrirDetalhes.textContent, 'Ver itens');
        assert.equal(abrirDetalhes.href, '/caixa/pagamento.html?mesaId=7');
        assert.equal(emPagamento.children[0].children[3].href, '/caixa/pagamento.html?mesaId=8');
    } finally {
        restaurarDocumento();
    }
});

test('exibe ação de transferência para CAIXA, GARÇOM e ADMIN, mas não para outros perfis', async () => {
    const restaurarDocumento = instalarDocumento();
    try {
        for (const perfil of ['CAIXA', 'GARCOM', 'GARÇOM', 'ADMIN']) {
            const mapa = new ElementoFake();
            await carregarMapaMesas({
                mapa,
                perfil,
                obterMapa: async () => ({
                    mesas: [
                        { mesaId: 701, numero: 7, status: 'ocupada', valorConsumido: 20 },
                        { mesaId: 802, numero: 8, status: 'disponivel', valorConsumido: 0 },
                    ],
                }),
            });
            const acaoTransferencia = mapa.children[0].children[0].children[3];
            assert.equal(acaoTransferencia.children[0].textContent, 'Transferir pedido', perfil);
        }

        for (const perfil of ['COZINHA', 'CLIENTE', '']) {
            const mapa = new ElementoFake();
            await carregarMapaMesas({
                mapa,
                perfil,
                obterMapa: async () => ({
                    mesas: [
                        { mesaId: 701, numero: 7, status: 'ocupada', valorConsumido: 20 },
                        { mesaId: 802, numero: 8, status: 'disponivel', valorConsumido: 0 },
                    ],
                }),
            });
            assert.equal(mapa.children[0].children[0].children.length, 3, perfil);
        }
        assert.equal(podeTransferirPedidos('ADMIN'), true);
        assert.equal(podeTransferirPedidos('CAIXA'), true);
        assert.equal(podeTransferirPedidos('GARCOM'), true);
        assert.equal(podeTransferirPedidos('COZINHA'), false);
    } finally {
        restaurarDocumento();
    }
});

test('confirma transferência usando IDs internos do pedido e da mesa destino', async () => {
    const restaurarDocumento = instalarDocumento();
    const mapa = new ElementoFake();
    const requisicoes = [];
    try {
        await carregarMapaMesas({
            mapa,
            perfil: 'CAIXA',
            obterMapa: async () => ({
                mesas: [
                    { mesaId: 701, numero: 7, status: 'ocupada', valorConsumido: 20 },
                    { mesaId: 802, numero: 8, status: 'disponivel', valorConsumido: 0 },
                ],
            }),
            listar: async ({ mesaId }) => {
                assert.equal(mesaId, 701);
                return [{ pedidoId: 3104, numero: 104, status: 'aberto' }];
            },
            transferir: async (pedidoId, mesaDestinoId) => {
                requisicoes.push({ pedidoId, mesaDestinoId });
            },
        });

        const [grupo] = mapa.children[0].children[0].children.slice(3);
        const [abrir, formulario] = grupo.children;
        await abrir.listeners.click();
        const [seletorPedido, seletorDestino, confirmar] = formulario.children;
        assert.equal(seletorPedido.children[1].value, 3104);
        assert.equal(seletorDestino.children[1].value, 802);
        seletorPedido.value = '3104';
        seletorDestino.value = '802';
        await seletorPedido.listeners.change();
        await seletorDestino.listeners.change();
        await confirmar.listeners.click();
        assert.deepEqual(requisicoes, [{ pedidoId: '3104', mesaDestinoId: 802 }]);
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

test('filtra mesas por status e inclui em pagamento no filtro de ocupadas', async () => {
    const restaurarDocumento = instalarDocumento();
    const mapa = new ElementoFake();
    const dados = {
        mesas: [
            { numero: 1, status: 'disponivel', valorConsumido: 0 },
            { numero: 2, status: 'ocupada', valorConsumido: 25 },
            { numero: 3, status: 'em_pagamento', valorConsumido: 40 },
            { numero: 4, status: 'reservada', valorConsumido: 0 },
        ],
    };
    try {
        await carregarMapaMesas({ mapa, obterMapa: async () => dados, statusFiltro: 'disponivel' });
        assert.deepEqual(mapa.children.map((card) => card.children[0].children[0].textContent), ['Mesa 1']);

        await carregarMapaMesas({ mapa, obterMapa: async () => dados, statusFiltro: 'ocupada' });
        assert.deepEqual(mapa.children.map((card) => card.children[0].children[0].textContent), [
            'Mesa 2', 'Mesa 3',
        ]);

        await carregarMapaMesas({ mapa, obterMapa: async () => dados, statusFiltro: 'reservada' });
        assert.deepEqual(mapa.children.map((card) => card.children[0].children[0].textContent), ['Mesa 4']);
    } finally {
        restaurarDocumento();
    }
});

test('pesquisa pelo número da mesa e informa quando não há correspondências', async () => {
    const restaurarDocumento = instalarDocumento();
    const mapa = new ElementoFake();
    try {
        await carregarMapaMesas({
            mapa,
            buscaNumero: ' 12 ',
            obterMapa: async () => ({
                mesas: [
                    { numero: 12, status: 'disponivel', valorConsumido: 0 },
                    { numero: 120, status: 'ocupada', valorConsumido: 10 },
                    { numero: 3, status: 'reservada', valorConsumido: 0 },
                ],
            }),
        });
        assert.deepEqual(mapa.children.map((card) => card.children[0].children[0].textContent), [
            'Mesa 12', 'Mesa 120',
        ]);

        await carregarMapaMesas({
            mapa,
            buscaNumero: '99',
            obterMapa: async () => ({ mesas: [{ numero: 12, status: 'disponivel', valorConsumido: 0 }] }),
        });
        assert.equal(mapa.textContent, 'Nenhuma mesa corresponde aos filtros selecionados.');
    } finally {
        restaurarDocumento();
    }
});

test('reaplica os filtros ao atualizar o mapa manualmente ou alterar o status', async () => {
    const restaurarDocumento = instalarDocumento();
    const mapa = new ElementoFake();
    const botao = new ElementoFake();
    const filtroStatus = new ElementoFake();
    const buscaMesa = new ElementoFake();
    filtroStatus.value = 'reservada';
    buscaMesa.value = '8';
    let chamadas = 0;
    try {
        inicializarMapaMesas({
            mapa,
            botao,
            filtroStatus,
            buscaMesa,
            obterMapa: async () => {
                chamadas += 1;
                return {
                    mesas: [
                        { numero: 8, status: 'reservada', valorConsumido: 0 },
                        { numero: 8, status: 'ocupada', valorConsumido: 10 },
                        { numero: 9, status: 'reservada', valorConsumido: 0 },
                    ],
                };
            },
        });
        await new Promise((resolve) => setImmediate(resolve));
        assert.equal(mapa.children.length, 1);
        assert.equal(mapa.children[0].children[0].children[0].textContent, 'Mesa 8');

        filtroStatus.value = 'ocupada';
        buscaMesa.value = '';
        await filtroStatus.listeners.change();
        assert.equal(mapa.children.length, 1);
        assert.equal(mapa.children[0].children[0].children[1].textContent, 'Ocupada');
        await botao.listeners.click();
        assert.equal(chamadas, 3);
    } finally {
        restaurarDocumento();
    }
});
