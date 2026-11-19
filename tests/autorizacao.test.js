import test from 'node:test';
import assert from 'node:assert/strict';
import { solicitarAutorizacao } from '../assets/js/core/autorizacao.js';

function criarDocumento() {
    const ouvintes = {};
    const doc = {
        activeElement: null,
        body: null,
        createElement: (tag) => new Elemento(tag, doc),
        addEventListener: (tipo, funcao) => { (ouvintes[tipo] ??= new Set()).add(funcao); },
        removeEventListener: (tipo, funcao) => { ouvintes[tipo]?.delete(funcao); },
        teclar: (key, extra = {}) => {
            const evento = { key, preventDefault() {}, ...extra };
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
        this.value = '';
        this.hidden = false;
        this.disabled = false;
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
    async enviar() {
        await Promise.all((this.listeners.submit ?? []).map((funcao) => funcao({ preventDefault() {} })));
    }
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
const formulario = (doc) => buscar(doc.body, (el) => el.tagName === 'form');
const aviso = (doc) => buscar(doc.body, (el) => el.attributes.role === 'alert');
const campoCodigo = (doc) => buscar(doc.body, (el) => el.tagName === 'input' && el.type === 'text');
const campoSenha = (doc) => buscar(doc.body, (el) => el.tagName === 'input' && el.type === 'password');

function preencher(doc, codigo, senha) {
    campoCodigo(doc).value = codigo;
    campoSenha(doc).value = senha;
}

test('mostra título, mensagem, campos de código e senha e foca o código', () => {
    const doc = criarDocumento();
    solicitarAutorizacao({
        titulo: 'Cancelar pedido pago',
        mensagem: 'Informe o administrador.',
        textoConfirmar: 'Cancelar pedido',
    }, doc);

    const dialogo = janela(doc);
    assert.equal(dialogo.attributes['aria-modal'], 'true');
    assert.ok(buscar(dialogo, (el) => el.textContent === 'Cancelar pedido pago'));
    assert.ok(buscar(dialogo, (el) => el.textContent === 'Informe o administrador.'));
    assert.equal(campoSenha(doc).type, 'password');
    assert.equal(botao(doc, 'confirmar').textContent, 'Cancelar pedido');
    assert.match(botao(doc, 'confirmar').className, /btn-danger/);
    assert.equal(aviso(doc).hidden, true);
    assert.equal(doc.activeElement, campoCodigo(doc));
    assert.equal(doc.body.classList.contains('modal-open'), true);
});

test('não envia sem código ou sem senha e avisa o que falta', async () => {
    const doc = criarDocumento();
    let chamadas = 0;
    solicitarAutorizacao({ aoConfirmar: async () => { chamadas += 1; } }, doc);

    await formulario(doc).enviar();
    assert.equal(aviso(doc).hidden, false);
    assert.equal(aviso(doc).textContent, 'Informe o código e a senha do administrador.');
    assert.equal(doc.activeElement, campoCodigo(doc));

    preencher(doc, 'admin', '');
    await formulario(doc).enviar();
    assert.equal(doc.activeElement, campoSenha(doc));

    preencher(doc, '   ', 'segredo');
    await formulario(doc).enviar();
    assert.equal(chamadas, 0);
    assert.ok(janela(doc), 'a janela continua aberta');
});

test('envia as credenciais (código sem espaços), resolve true e fecha a janela', async () => {
    const doc = criarDocumento();
    const recebidas = [];
    const resposta = solicitarAutorizacao({
        aoConfirmar: async (credenciais) => { recebidas.push(credenciais); },
    }, doc);

    preencher(doc, '  admin ', 'restmanager123');
    await formulario(doc).enviar();

    assert.equal(await resposta, true);
    assert.deepEqual(recebidas, [{ codigoUsuario: 'admin', senha: 'restmanager123' }]);
    assert.equal(doc.body.children.length, 0);
    assert.equal(doc.body.classList.contains('modal-open'), false);
    assert.equal(doc.ouvintes.keydown.size, 0, 'tira o ouvinte do teclado');
});

test('quando a ação é recusada, mantém a janela aberta, mostra o erro e limpa a senha', async () => {
    const doc = criarDocumento();
    let tentativa = 0;
    const resposta = solicitarAutorizacao({
        aoConfirmar: async () => {
            tentativa += 1;
            if (tentativa === 1) throw Object.assign(new Error('CREDENCIAIS_INVALIDAS'), { codigo: 'CREDENCIAIS_INVALIDAS' });
        },
        mensagemErro: (erro) => `Recusado: ${erro.codigo}`,
    }, doc);

    preencher(doc, 'admin', 'errada');
    await formulario(doc).enviar();

    assert.ok(janela(doc), 'a janela continua aberta');
    assert.equal(aviso(doc).hidden, false);
    assert.equal(aviso(doc).textContent, 'Recusado: CREDENCIAIS_INVALIDAS');
    assert.equal(campoSenha(doc).value, '');
    assert.equal(campoCodigo(doc).value, 'admin', 'mantém o código digitado');
    assert.equal(botao(doc, 'confirmar').disabled, false);
    assert.equal(botao(doc, 'cancelar').disabled, false);
    assert.equal(doc.activeElement, campoSenha(doc));

    campoSenha(doc).value = 'certa';
    await formulario(doc).enviar();
    assert.equal(await resposta, true);
    assert.equal(tentativa, 2);
});

test('bloqueia segundo envio e o Esc enquanto a ação está em andamento', async () => {
    const doc = criarDocumento();
    let chamadas = 0;
    let concluir;
    const resposta = solicitarAutorizacao({
        aoConfirmar: () => new Promise((resolve) => { chamadas += 1; concluir = resolve; }),
    }, doc);

    preencher(doc, 'admin', 'segredo');
    const primeiro = formulario(doc).enviar();
    await formulario(doc).enviar();
    doc.teclar('Escape');

    assert.equal(chamadas, 1);
    assert.equal(botao(doc, 'confirmar').disabled, true);
    assert.ok(janela(doc), 'Esc não fecha durante o envio');

    concluir();
    await primeiro;
    assert.equal(await resposta, true);
});

test('cancelar, Esc ou clique fora resolvem false sem chamar a ação', async () => {
    for (const fechar of [
        (doc) => botao(doc, 'cancelar').clicar(),
        (doc) => doc.teclar('Escape'),
        (doc) => janela(doc).clicar(janela(doc)),
    ]) {
        const doc = criarDocumento();
        let chamadas = 0;
        const resposta = solicitarAutorizacao({ aoConfirmar: async () => { chamadas += 1; } }, doc);
        fechar(doc);
        assert.equal(await resposta, false);
        assert.equal(chamadas, 0);
        assert.equal(doc.body.children.length, 0);
    }
});

test('clique dentro da janela não fecha', () => {
    const doc = criarDocumento();
    solicitarAutorizacao({}, doc);
    janela(doc).clicar(campoCodigo(doc));
    assert.ok(janela(doc));
});

test('Tab e Shift+Tab giram o foco só dentro da janela', () => {
    const doc = criarDocumento();
    solicitarAutorizacao({}, doc);
    const ordem = [campoCodigo(doc), campoSenha(doc), botao(doc, 'cancelar'), botao(doc, 'confirmar')];

    for (let i = 1; i <= ordem.length; i += 1) {
        doc.teclar('Tab');
        assert.equal(doc.activeElement, ordem[i % ordem.length]);
    }
    doc.teclar('Tab', { shiftKey: true });
    assert.equal(doc.activeElement, ordem[ordem.length - 1]);
});
