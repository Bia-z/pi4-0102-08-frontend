import test from 'node:test';
import assert from 'node:assert/strict';
import { inicializarCategorias, proximaOrdem, validarCategoria } from '../admin/js/categorias.js';

class Elemento {
    constructor(tag = 'div', name = '') {
        this.tagName = tag;
        this.name = name;
        this.value = '';
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

const botao = (linha, texto) => buscar(linha, (el) => el.tagName === 'button' && el.textContent === texto)[0];

function categoriasDeExemplo() {
    return [
        { id: 1, nome: 'Entradas', ordem: 1, ativo: true, itensAtivos: 2 },
        { id: 2, nome: 'Drinks', ordem: 5, ativo: true, itensAtivos: 0 },
        { id: 3, nome: 'Antiga', ordem: 9, ativo: false, itensAtivos: 0 },
    ];
}

async function montarTela(dependencias = {}) {
    const campos = { nome: new Elemento('input', 'nome'), ordem: new Elemento('input', 'ordem') };
    const form = new Elemento('form');
    form.elements = { namedItem: (nome) => campos[nome] };
    porId.set('nome-erro', new Elemento());
    porId.set('ordem-erro', new Elemento());
    const tela = {
        campos,
        tabela: new Elemento('tbody'),
        alerta: new Elemento(),
        titulo: new Elemento('h2'),
        botaoSalvar: new Elemento('button'),
        botaoCancelar: new Elemento('button'),
        enviar: () => form.listeners.submit[0]({ preventDefault() {} }),
    };
    tela.botaoCancelar.classList.add('d-none');
    await inicializarCategorias({
        tabela: tela.tabela,
        alerta: tela.alerta,
        form,
        titulo: tela.titulo,
        botaoSalvar: tela.botaoSalvar,
        botaoCancelar: tela.botaoCancelar,
        listar: async () => categoriasDeExemplo(),
        cadastrar: async () => ({}),
        atualizar: async () => ({}),
        desativar: async () => {},
        confirmar: async () => true,
        ...dependencias,
    });
    return tela;
}

test('valida nome e ordem antes de enviar', () => {
    assert.deepEqual(validarCategoria({ nome: '  Porções ', ordem: '5' }), { dados: { nome: 'Porções', ordem: 5 } });
    assert.equal(validarCategoria({ nome: '   ', ordem: '1' }).erros.nome, 'Informe o nome da categoria.');
    assert.equal(validarCategoria({ nome: 'x'.repeat(81), ordem: '1' }).erros.nome, 'Use no máximo 80 caracteres.');
    assert.equal(validarCategoria({ nome: 'Ok', ordem: '-1' }).erros.ordem, 'Informe um número inteiro a partir de 0.');
    assert.equal(validarCategoria({ nome: 'Ok', ordem: '' }).erros.ordem, 'Informe um número inteiro a partir de 0.');
});

test('sugere a próxima ordem depois da maior', () => {
    assert.equal(proximaOrdem(categoriasDeExemplo()), 10);
    assert.equal(proximaOrdem([]), 1);
});

test('lista categorias e já sugere a ordem no formulário', async () => {
    const tela = await montarTela();

    assert.equal(tela.tabela.children.length, 3);
    assert.equal(tela.tabela.children[0].children[1].textContent, 'Entradas');
    assert.equal(tela.tabela.children[0].children[2].textContent, '2 itens');
    assert.equal(tela.campos.ordem.value, '10');
});

test('desativar fica bloqueado em categoria com itens e vira Reativar na desativada', async () => {
    const tela = await montarTela();
    const [entradas, drinks, antiga] = tela.tabela.children;

    assert.equal(botao(entradas, 'Desativar').disabled, true);
    assert.equal(botao(drinks, 'Desativar').disabled, false);
    assert.equal(botao(antiga, 'Desativar'), undefined);
    assert.ok(botao(antiga, 'Reativar'));
});

test('cadastrar envia os dados limpos e volta o formulário para o início', async () => {
    const enviados = [];
    const tela = await montarTela({ cadastrar: async (dados) => { enviados.push(dados); } });
    tela.campos.nome.value = ' Porções ';
    tela.campos.ordem.value = '6';

    await tela.enviar();

    assert.deepEqual(enviados, [{ nome: 'Porções', ordem: 6 }]);
    assert.equal(tela.alerta.textContent, 'Categoria "Porções" cadastrada.');
    assert.equal(tela.campos.nome.value, '');
});

test('formulário inválido não chama a API e marca o campo', async () => {
    const enviados = [];
    const tela = await montarTela({ cadastrar: async (dados) => { enviados.push(dados); } });
    tela.campos.nome.value = '';
    tela.campos.ordem.value = '1';

    await tela.enviar();

    assert.equal(enviados.length, 0);
    assert.equal(tela.campos.nome.classList.contains('is-invalid'), true);
    assert.equal(porId.get('nome-erro').textContent, 'Informe o nome da categoria.');
});

test('Editar preenche o formulário e salvar manda PUT', async () => {
    const enviados = [];
    const tela = await montarTela({ atualizar: async (id, dados) => { enviados.push([id, dados]); } });
    botao(tela.tabela.children[1], 'Editar').listeners.click[0]();

    assert.equal(tela.titulo.textContent, 'Editar "Drinks"');
    assert.equal(tela.campos.nome.value, 'Drinks');
    assert.equal(tela.botaoSalvar.textContent, 'Salvar alterações');
    assert.equal(tela.botaoCancelar.classList.contains('d-none'), false);

    tela.campos.nome.value = 'Drinks e coquetéis';
    await tela.enviar();

    assert.deepEqual(enviados, [[2, { nome: 'Drinks e coquetéis', ordem: 5 }]]);
    assert.equal(tela.titulo.textContent, 'Nova categoria');
});

test('nome repetido aparece no campo nome', async () => {
    const tela = await montarTela({
        cadastrar: async () => { const erro = new Error('dup'); erro.codigo = 'CATEGORIA_DUPLICADA'; throw erro; },
    });
    tela.campos.nome.value = 'Entradas';
    tela.campos.ordem.value = '1';

    await tela.enviar();

    assert.equal(porId.get('nome-erro').textContent, 'Já existe uma categoria com esse nome.');
});

test('desativar pede confirmação e reativar manda ativo true', async () => {
    const chamadas = [];
    const tela = await montarTela({
        desativar: async (id) => { chamadas.push(['desativar', id]); },
        atualizar: async (id, dados) => { chamadas.push(['atualizar', id, dados.ativo]); },
        confirmar: async (mensagem) => { chamadas.push(['confirmar', mensagem.startsWith('"Drinks"')]); return true; },
    });

    await botao(tela.tabela.children[1], 'Desativar').listeners.click[0]();
    await botao(tela.tabela.children[2], 'Reativar').listeners.click[0]();

    assert.deepEqual(chamadas, [['confirmar', true], ['desativar', 2], ['atualizar', 3, true]]);
});
