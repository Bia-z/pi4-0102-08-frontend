import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmar } from '../assets/js/core/confirmar.js';

function criarDocumento() {
    const ouvintes = {};
    const doc = {
        activeElement: null,
        body: null,
        createElement: (tag) => new Elemento(tag, doc),
        addEventListener: (tipo, funcao) => { (ouvintes[tipo] ??= new Set()).add(funcao); },
        removeEventListener: (tipo, funcao) => { ouvintes[tipo]?.delete(funcao); },
        teclar: (key) => {
            const evento = { key, preventDefault() {} };
            [...(ouvintes.keydown ?? [])].forEach((funcao) => funcao(evento));
        },
        ouvintes,
    };
    doc.body = new Elemento('body', doc);
    return doc;
}

class Elemento {
    constructor(tag, doc) {
        this.tagName = tag;
        this.doc = doc;
        this.children = [];
        this.parent = null;
        this.textContent = '';
        this.className = '';
        this.innerHTML = '';
        this.dataset = {};
        this.attributes = {};
        this.listeners = {};
        const classes = new Set();
        this.classList = {
            add: (nome) => classes.add(nome),
            remove: (nome) => classes.delete(nome),
            contains: (nome) => classes.has(nome),
        };
    }
    append(...filhos) { filhos.forEach((filho) => { filho.parent = this; this.children.push(filho); }); }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter((filho) => filho !== this); }
    setAttribute(nome, valor) { this.attributes[nome] = valor; }
    addEventListener(tipo, funcao) { (this.listeners[tipo] ??= []).push(funcao); }
    focus() { this.doc.activeElement = this; }
    clicar(alvo = this) { (this.listeners.click ?? []).forEach((funcao) => funcao({ target: alvo })); }
}

function buscar(raiz, condicao) {
    if (condicao(raiz)) return raiz;
    for (const filho of raiz.children) {
        const achado = buscar(filho, condicao);
        if (achado) return achado;
    }
    return null;
}

const botao = (doc, acao) => buscar(doc.body, (el) => el.dataset.acao === acao);
const janela = (doc) => buscar(doc.body, (el) => el.attributes.role === 'dialog');

test('mostra título, mensagem e textos dos botões, com foco no Cancelar', () => {
    const doc = criarDocumento();
    confirmar({ titulo: 'Excluir mesa?', mensagem: 'A mesa 5 sai do mapa.', textoConfirmar: 'Excluir' }, doc);

    const dialogo = janela(doc);
    assert.equal(dialogo.attributes['aria-modal'], 'true');
    assert.ok(buscar(dialogo, (el) => el.textContent === 'Excluir mesa?'));
    assert.ok(buscar(dialogo, (el) => el.textContent === 'A mesa 5 sai do mapa.'));
    assert.equal(botao(doc, 'confirmar').textContent, 'Excluir');
    assert.match(botao(doc, 'confirmar').className, /btn-danger/);
    assert.equal(doc.activeElement, botao(doc, 'cancelar'));
    assert.equal(doc.body.classList.contains('modal-open'), true);
});

test('confirmar resolve true e some da tela', async () => {
    const doc = criarDocumento();
    const resposta = confirmar({ mensagem: 'Tem certeza?' }, doc);

    botao(doc, 'confirmar').clicar();

    assert.equal(await resposta, true);
    assert.equal(doc.body.children.length, 0);
    assert.equal(doc.body.classList.contains('modal-open'), false);
    assert.equal(doc.ouvintes.keydown.size, 0, 'tira o ouvinte do teclado');
});

test('cancelar, Esc ou clique fora resolvem false', async () => {
    for (const fechar of [
        (doc) => botao(doc, 'cancelar').clicar(),
        (doc) => doc.teclar('Escape'),
        (doc) => janela(doc).clicar(janela(doc)),
    ]) {
        const doc = criarDocumento();
        const resposta = confirmar({ mensagem: 'Tem certeza?' }, doc);
        fechar(doc);
        assert.equal(await resposta, false);
        assert.equal(doc.body.children.length, 0);
    }
});

test('clique dentro da janela não fecha', async () => {
    const doc = criarDocumento();
    confirmar({ mensagem: 'Tem certeza?' }, doc);

    janela(doc).clicar(botao(doc, 'cancelar').parent);

    assert.ok(janela(doc), 'continua aberta');
});

test('Tab alterna o foco só entre os dois botões', () => {
    const doc = criarDocumento();
    confirmar({ mensagem: 'Tem certeza?' }, doc);

    doc.teclar('Tab');
    assert.equal(doc.activeElement, botao(doc, 'confirmar'));
    doc.teclar('Tab');
    assert.equal(doc.activeElement, botao(doc, 'cancelar'));
});

test('devolve o foco para onde estava ao fechar', async () => {
    const doc = criarDocumento();
    const botaoDaTela = new Elemento('button', doc);
    botaoDaTela.focus();
    const resposta = confirmar({ mensagem: 'Tem certeza?' }, doc);

    doc.teclar('Escape');
    await resposta;

    assert.equal(doc.activeElement, botaoDaTela);
});

test('ação que não é destrutiva usa botão principal verde', () => {
    const doc = criarDocumento();
    confirmar({ mensagem: 'Reativar?', perigo: false }, doc);

    assert.match(botao(doc, 'confirmar').className, /btn-primary/);
});
