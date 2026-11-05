import { obterCardapio } from '../../assets/js/core/api.js';
import { iniciarPagina } from '../../assets/js/core/guard.js';

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function criarProduto(produto) {
    const artigo = document.createElement('article');
    artigo.className = 'card h-100';

    if (produto.imagemUrl) {
        const imagem = document.createElement('img');
        imagem.className = 'card-img-top';
        imagem.src = produto.imagemUrl;
        imagem.alt = produto.nome;
        imagem.loading = 'lazy';
        artigo.append(imagem);
    }

    const corpo = document.createElement('div');
    corpo.className = 'card-body';
    const nome = document.createElement('h3');
    nome.className = 'h5 card-title';
    nome.textContent = produto.nome;
    corpo.append(nome);

    if (produto.descricao) {
        const descricao = document.createElement('p');
        descricao.className = 'card-text text-secondary';
        descricao.textContent = produto.descricao;
        corpo.append(descricao);
    }

    const preco = document.createElement('p');
    preco.className = 'card-text fw-semibold mb-0';
    preco.textContent = moeda.format(Number(produto.preco));
    corpo.append(preco);
    artigo.append(corpo);
    return artigo;
}

function renderizarCardapio(categorias, destino) {
    destino.replaceChildren();
    categorias.forEach((categoria) => {
        const secao = document.createElement('section');
        const titulo = document.createElement('h2');
        titulo.className = 'h4 mb-3';
        titulo.textContent = categoria.nome;
        secao.append(titulo);

        const grade = document.createElement('div');
        grade.className = 'row g-3';
        (categoria.produtos || []).forEach((produto) => {
            const coluna = document.createElement('div');
            coluna.className = 'col-sm-6 col-lg-4';
            coluna.append(criarProduto(produto));
            grade.append(coluna);
        });
        secao.append(grade);
        destino.append(secao);
    });
}

export async function carregarCardapio({
    obter = obterCardapio,
    categorias = document.getElementById('cardapio-categorias'),
    alerta = document.getElementById('cardapio-alerta'),
    vazio = document.getElementById('cardapio-vazio'),
} = {}) {
    try {
        const dados = await obter();
        if (!Array.isArray(dados)) throw new Error('RESPOSTA_INVALIDA');
        renderizarCardapio(dados, categorias);
        alerta.textContent = '';
        alerta.classList.add('d-none');
        const semProdutos = dados.every((categoria) => !categoria.produtos?.length);
        vazio.classList.toggle('d-none', !semProdutos);
    } catch {
        alerta.textContent = 'Não foi possível carregar o cardápio. Tente novamente.';
        alerta.classList.remove('d-none');
    }
}

if (typeof document !== 'undefined') {
    if (document.getElementById('pagina-cardapio') && iniciarPagina('garcom')) {
        carregarCardapio();
    }
}
