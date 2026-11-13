import test from 'node:test';
import assert from 'node:assert/strict';
import { infoSituacao, inicializarListaMesas, podeExcluir } from '../admin/js/mesas.js';
import { inicializarCadastroMesa } from '../admin/js/mesa-form.js';

class Elemento {
    constructor(tag = 'div', value = '') {
        this.tagName = tag;
        this.value = value;
        this.children = [];
        this.textContent = '';
        this.className = '';
        this.disabled = false;
        this.attributes = {};
        this.listeners = {};
        const classes = new Set();
        this.classList = {
            add: (...nomes) => nomes.forEach((nome) => classes.add(nome)),
            remove: (...nomes) => nomes.forEach((nome) => classes.delete(nome)),
            contains: (nome) => classes.has(nome),
        };
    }
    append(...elementos) { this.children.push(...elementos); }
    replaceChildren(...elementos) { this.children = [...elementos]; }
    setAttribute(nome, valor) { this.attributes[nome] = valor; }
    removeAttribute(nome) { delete this.attributes[nome]; }
    addEventListener(tipo, funcao) { (this.listeners[tipo] ??= []).push(funcao); }
    reset() { this.value = ''; }
}

const porId = new Map();
globalThis.document = {
    createElement: (tag) => new Elemento(tag),
    getElementById: (id) => porId.get(id),
};

function buscar(raiz, condicao) {
    const achados = [];
    const visitar = (elemento) => {
        if (condicao(elemento)) achados.push(elemento);
        elemento.children?.forEach(visitar);
    };
    visitar(raiz);
    return achados;
}

const botaoExcluir = (linha) => buscar(linha, (el) => el.tagName === 'button' && el.textContent === 'Excluir')[0];

const MESAS = [
    { id: 1, numero: 1, capacidade: 4, status: 'disponivel' },
    { id: 2, numero: 2, capacidade: 1, status: 'ocupada' },
];

// ---- Lista ----

test('situação da mesa aparece em português', () => {
    assert.equal(infoSituacao('disponivel').texto, 'Livre');
    assert.equal(infoSituacao('em_pagamento').texto, 'Em pagamento');
    assert.equal(podeExcluir({ status: 'disponivel' }), true);
    assert.equal(podeExcluir({ status: 'ocupada' }), false);
});

test('lista as mesas com editar e excluir, e bloqueia excluir mesa em uso', async () => {
    const tabela = new Elemento('tbody');
    await inicializarListaMesas({ tabela, alerta: new Elemento(), listar: async () => MESAS });

    assert.equal(tabela.children.length, 2);
    const [livre, ocupada] = tabela.children;
    assert.equal(livre.children[0].textContent, 'Mesa 1');
    assert.equal(ocupada.children[1].textContent, '1 pessoa');
    assert.equal(buscar(livre, (el) => el.textContent === 'Editar')[0].attributes.href, '/admin/mesa-form.html?id=1');
    assert.equal(botaoExcluir(livre).disabled, false);
    assert.equal(botaoExcluir(ocupada).disabled, true);
    assert.equal(botaoExcluir(ocupada).attributes.title, 'Só é possível excluir uma mesa livre');
});

test('excluir pede confirmação, chama a API e recarrega a lista', async () => {
    const tabela = new Elemento('tbody');
    const alerta = new Elemento();
    const excluidas = [];
    let mensagemConfirmacao;
    let buscas = 0;
    await inicializarListaMesas({
        tabela,
        alerta,
        listar: async () => { buscas++; return MESAS; },
        excluir: async (id) => { excluidas.push(id); },
        confirmar: async (mensagem) => { mensagemConfirmacao = mensagem; return true; },
    });

    await botaoExcluir(tabela.children[0]).listeners.click[0]();

    assert.match(mensagemConfirmacao, /^A mesa 1 sai do mapa/);
    assert.deepEqual(excluidas, [1]);
    assert.equal(buscas, 2);
    assert.equal(alerta.textContent, 'Mesa 1 excluída.');
    assert.equal(alerta.classList.contains('alert-success'), true);
});

test('desistir da exclusão não chama a API', async () => {
    const tabela = new Elemento('tbody');
    const excluidas = [];
    await inicializarListaMesas({
        tabela,
        alerta: new Elemento(),
        listar: async () => MESAS,
        excluir: async (id) => { excluidas.push(id); },
        confirmar: async () => false,
    });

    await botaoExcluir(tabela.children[0]).listeners.click[0]();

    assert.deepEqual(excluidas, []);
});

test('mesa ocupada recusada pelo servidor mostra mensagem clara', async () => {
    const tabela = new Elemento('tbody');
    const alerta = new Elemento();
    await inicializarListaMesas({
        tabela,
        alerta,
        listar: async () => MESAS,
        excluir: async () => { const erro = new Error('MESA_EM_USO'); erro.codigo = 'MESA_EM_USO'; throw erro; },
        confirmar: async () => true,
    });

    await botaoExcluir(tabela.children[0]).listeners.click[0]();

    assert.equal(alerta.textContent, 'Essa mesa está em uso agora. Só é possível excluir uma mesa livre.');
    assert.equal(alerta.classList.contains('alert-danger'), true);
});

// ---- Formulário em modo edição ----

function criarFormulario({ mesaId, atualizar, listar = async () => MESAS }) {
    const campos = { numero: new Elemento('input'), capacidade: new Elemento('input') };
    const form = new Elemento('form');
    form.elements = { namedItem: (nome) => campos[nome] };
    const alerta = new Elemento();
    const sucesso = new Elemento();
    const botao = new Elemento('button');
    const titulo = new Elemento('h1');
    alerta.classList.add('d-none');
    sucesso.classList.add('d-none');
    for (const campo of ['numero', 'capacidade']) {
        porId.set(campo, campos[campo]);
        porId.set(`${campo}-erro`, new Elemento());
    }
    const pronto = inicializarCadastroMesa({
        form, alerta, sucesso, botao, titulo, mesaId, atualizar, listar, cadastrar: async () => assert.fail('não cadastra'),
    });
    const enviar = () => form.listeners.submit[0]({ preventDefault() {} });
    return { campos, alerta, sucesso, botao, titulo, pronto, enviar };
}

test('modo edição preenche o formulário com a mesa escolhida', async () => {
    const tela = criarFormulario({ mesaId: '2', atualizar: async () => ({}) });
    await tela.pronto;

    assert.equal(tela.titulo.textContent, 'Editar mesa 2');
    assert.equal(tela.campos.numero.value, '2');
    assert.equal(tela.campos.capacidade.value, '1');
    assert.equal(tela.botao.textContent, 'Salvar alterações');
    assert.equal(tela.botao.disabled, false);
});

test('salvar no modo edição envia PUT com os novos valores', async () => {
    const enviados = [];
    const tela = criarFormulario({
        mesaId: '2',
        atualizar: async (id, dados) => { enviados.push([id, dados]); return { numero: 12, capacidade: 6, ...dados }; },
    });
    await tela.pronto;
    tela.campos.numero.value = '12';
    tela.campos.capacidade.value = '6';

    await tela.enviar();

    assert.deepEqual(enviados, [['2', { numero: 12, capacidade: 6 }]]);
    assert.equal(tela.sucesso.textContent, 'Mesa 12 atualizada com capacidade para 6 pessoa(s).');
    assert.equal(tela.titulo.textContent, 'Editar mesa 12');
    assert.equal(tela.botao.textContent, 'Salvar alterações');
});

test('mesa inexistente no modo edição avisa e mantém o botão travado', async () => {
    const tela = criarFormulario({ mesaId: '99', atualizar: async () => ({}) });
    await tela.pronto;

    assert.equal(tela.alerta.textContent, 'Essa mesa não existe mais. Volte para a lista de mesas.');
    assert.equal(tela.botao.disabled, true);
});
