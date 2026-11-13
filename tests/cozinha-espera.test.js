import test from 'node:test';
import assert from 'node:assert/strict';
import {
    inicializarPainelCozinha,
    minutosDesde,
    nivelEspera,
    textoEspera,
} from '../cozinha/js/painel.js';

const MEIO_DIA = new Date('2026-11-13T12:00:00').getTime();

test('conta os minutos inteiros desde a chegada do pedido', () => {
    assert.equal(minutosDesde('2026-11-13T11:45:00', MEIO_DIA), 15);
    assert.equal(minutosDesde('2026-11-13T11:59:31', MEIO_DIA), 0);
    assert.equal(minutosDesde('2026-11-13T12:02:00', MEIO_DIA), 0, 'relógio adiantado não fica negativo');
    assert.equal(minutosDesde('data inválida', MEIO_DIA), null);
});

test('classifica a espera em normal, atenção e atrasado', () => {
    assert.equal(nivelEspera(0), 'normal');
    assert.equal(nivelEspera(14), 'normal');
    assert.equal(nivelEspera(15), 'atencao');
    assert.equal(nivelEspera(29), 'atencao');
    assert.equal(nivelEspera(30), 'atrasado');
    assert.equal(nivelEspera(null), 'normal');
});

test('escreve a espera em português', () => {
    assert.equal(textoEspera(0), 'agora');
    assert.equal(textoEspera(1), 'há 1 min');
    assert.equal(textoEspera(45), 'há 45 min');
    assert.equal(textoEspera(60), 'há 1 h');
    assert.equal(textoEspera(65), 'há 1 h 05 min');
    assert.equal(textoEspera(null), '');
});

class Elemento {
    constructor() {
        this.children = [];
        this.textContent = '';
        this.className = '';
        this.title = '';
        this.classList = { toggle() {}, add() {}, remove() {} };
    }
    append(...elementos) { this.children.push(...elementos); }
    replaceChildren(...elementos) { this.children = [...elementos]; }
    addEventListener() {}
    setAttribute() {}
}

function buscar(raiz, condicao) {
    const achados = [];
    const visitar = (elemento) => {
        if (condicao(elemento)) achados.push(elemento);
        elemento.children?.forEach(visitar);
    };
    visitar(raiz);
    return achados;
}

test('painel destaca pedido atrasado e atualiza a etiqueta com o relógio', async () => {
    const ids = ['pedidos', 'pedidos-vazio', 'pedidos-alerta', 'status-conexao', 'atualizar'];
    const elementos = Object.fromEntries(ids.map((id) => [id, new Elemento()]));
    const original = globalThis.document;
    globalThis.document = {
        getElementById: (id) => elementos[id],
        createElement: () => new Elemento(),
    };
    let agora = MEIO_DIA;
    let tique;
    try {
        await inicializarPainelCozinha({
            listar: async () => [
                { id: 1, numeroMesa: 3, dataCriacao: '2026-11-13T11:25:00', itens: [] },
                { id: 2, numeroMesa: 5, dataCriacao: '2026-11-13T11:55:00', itens: [] },
            ],
            conectar: async () => {},
            agora: () => agora,
            iniciarRelogio: (atualizar) => { tique = atualizar; },
        });

        const etiquetas = () => buscar(elementos.pedidos, (el) => el.className.startsWith('badge'));
        const cartoes = () => buscar(elementos.pedidos, (el) => el.className.startsWith('card h-100'));

        assert.deepEqual(etiquetas().map((el) => el.textContent), ['há 35 min', 'há 5 min']);
        assert.match(etiquetas()[0].className, /text-bg-danger/);
        assert.match(cartoes()[0].className, /border-danger/);
        assert.equal(cartoes()[1].className, 'card h-100');

        agora += 10 * 60000;
        tique();

        assert.deepEqual(etiquetas().map((el) => el.textContent), ['há 45 min', 'há 15 min']);
        assert.match(etiquetas()[1].className, /text-bg-warning/);
        assert.match(cartoes()[1].className, /border-warning/);
    } finally {
        globalThis.document = original;
    }
});
