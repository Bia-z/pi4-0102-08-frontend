import test from 'node:test';
import assert from 'node:assert/strict';
import {
    inicializarAcompanhamento,
    infoStatusItem,
    podeCancelar,
    textoConfirmacaoCancelamento,
} from '../garcom/js/acompanhamento.js';

class Elemento {
    constructor(tag) {
        this.tagName = tag;
        this.children = [];
        this.textContent = '';
        this.className = '';
        this.dataset = {};
        this.listeners = {};
        this.disabled = false;
        this.checked = false;
        const classes = new Set();
        this.classList = {
            add: (...nomes) => nomes.forEach((nome) => classes.add(nome)),
            remove: (...nomes) => nomes.forEach((nome) => classes.delete(nome)),
            toggle: (nome, ligar = !classes.has(nome)) => (ligar ? classes.add(nome) : classes.delete(nome)),
            contains: (nome) => classes.has(nome),
        };
    }
    append(...elementos) { this.children.push(...elementos); }
    replaceChildren(...elementos) { this.children = [...elementos]; }
    addEventListener(tipo, funcao) { (this.listeners[tipo] ??= []).push(funcao); }
    setAttribute() {}
}

function botoesCancelar(raiz) {
    const encontrados = [];
    const visitar = (elemento) => {
        if (elemento.dataset?.cancelarItem !== undefined) encontrados.push(elemento);
        elemento.children?.forEach(visitar);
    };
    visitar(raiz);
    return encontrados;
}

function pedidosDeExemplo() {
    return [{
        id: 101,
        numeroMesa: 8,
        dataCriacao: '2026-11-13T12:00:00',
        itens: [
            { id: 201, produtoNome: 'Bruschetta Italiana', quantidade: 2, status: 'em_preparo' },
            { id: 202, produtoNome: 'Suco de laranja', quantidade: 1, status: 'aguardando' },
            { id: 203, produtoNome: 'Água', quantidade: 1, status: 'cancelado' },
        ],
    }];
}

async function montarTela({ confirmar = () => true, cancelar = async () => ({}) } = {}) {
    const ids = ['pedidos', 'pedidos-vazio', 'pedidos-alerta', 'avisos-prontos', 'status-conexao', 'atualizar', 'todos-garcons'];
    const elementos = Object.fromEntries(ids.map((id) => [id, new Elemento('div')]));
    const original = globalThis.document;
    globalThis.document = {
        getElementById: (id) => elementos[id],
        createElement: (tag) => new Elemento(tag),
    };
    let buscas = 0;
    await inicializarAcompanhamento({
        listar: async () => { buscas++; return pedidosDeExemplo(); },
        conectar: async () => {},
        sessao: { usuarioId: 2 },
        confirmar,
        cancelar,
    });
    return {
        elementos,
        buscas: () => buscas,
        restaurar: () => { globalThis.document = original; },
    };
}

test('só item aguardando pode ser cancelado', () => {
    assert.equal(podeCancelar({ status: 'aguardando' }), true);
    assert.equal(podeCancelar({ status: 'em_preparo' }), false);
    assert.equal(podeCancelar({ status: 'pronto' }), false);
    assert.equal(podeCancelar({ status: 'cancelado' }), false);
});

test('item cancelado tem etiqueta própria', () => {
    assert.equal(infoStatusItem('cancelado').texto, 'Cancelado');
});

test('confirmação cita quantidade, produto e mesa', () => {
    assert.equal(
        textoConfirmacaoCancelamento({ numeroMesa: 8 }, { quantidade: 1, produtoNome: 'Suco de laranja' }),
        '1× Suco de laranja sai do pedido da mesa 8 e da conta.',
    );
});

test('mostra o botão Cancelar só no item aguardando', async () => {
    const tela = await montarTela();
    try {
        const botoes = botoesCancelar(tela.elementos.pedidos);
        assert.equal(botoes.length, 1);
        assert.equal(botoes[0].dataset.cancelarItem, 202);
        assert.equal(botoes[0].textContent, 'Cancelar');
    } finally {
        tela.restaurar();
    }
});

test('confirmar o cancelamento chama a API com pedido e item e recarrega a lista', async () => {
    const chamadas = [];
    const tela = await montarTela({ cancelar: async (pedidoId, itemId) => { chamadas.push([pedidoId, itemId]); } });
    try {
        const [botao] = botoesCancelar(tela.elementos.pedidos);
        await botao.listeners.click[0]();

        assert.deepEqual(chamadas, [[101, 202]]);
        assert.equal(tela.buscas(), 2, 'busca de novo depois de cancelar');
        assert.equal(tela.elementos['pedidos-alerta'].classList.contains('d-none'), true);
    } finally {
        tela.restaurar();
    }
});

test('desistir na confirmação não cancela nada', async () => {
    const chamadas = [];
    const tela = await montarTela({
        confirmar: () => false,
        cancelar: async (...args) => { chamadas.push(args); },
    });
    try {
        const [botao] = botoesCancelar(tela.elementos.pedidos);
        await botao.listeners.click[0]();

        assert.equal(chamadas.length, 0);
        assert.equal(tela.buscas(), 1);
    } finally {
        tela.restaurar();
    }
});

test('erro da API aparece no alerta em português', async () => {
    const tela = await montarTela({
        cancelar: async () => {
            const erro = new Error('CANCELAMENTO_NAO_PERMITIDO');
            erro.codigo = 'CANCELAMENTO_NAO_PERMITIDO';
            throw erro;
        },
    });
    try {
        const [botao] = botoesCancelar(tela.elementos.pedidos);
        await botao.listeners.click[0]();

        const alerta = tela.elementos['pedidos-alerta'];
        assert.match(alerta.textContent, /^Não foi possível cancelar o item\. A cozinha já começou a preparar/);
        assert.equal(alerta.classList.contains('d-none'), false);
    } finally {
        tela.restaurar();
    }
});
