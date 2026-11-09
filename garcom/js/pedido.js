import { criarPedido, obterCardapio, obterMapaMesas } from '../../assets/js/core/api.js';
import { lerSessao } from '../../assets/js/core/auth.js';
import { formatarMoeda } from '../../assets/js/core/format.js';
import { iniciarPagina } from '../../assets/js/core/guard.js';
import { mensagemDeErro } from '../../assets/js/core/ui.js';
import { conectarAtualizacoesMesas } from '../../assets/js/core/ws.js';

// ---------- Carrinho (funções puras, sem tela) ----------
// Cada linha: { linhaId, produtoId, nome, preco, quantidade, observacao }

export function adicionarItem(carrinho, produto) {
    // Mesmo produto sem observação soma na mesma linha; com observação vira linha própria
    const existente = carrinho.find((linha) => linha.produtoId === produto.id && !linha.observacao);
    if (existente) {
        return carrinho.map((linha) => (
            linha === existente ? { ...linha, quantidade: linha.quantidade + 1 } : linha
        ));
    }
    const proximoId = carrinho.reduce((maior, linha) => Math.max(maior, linha.linhaId), 0) + 1;
    return [...carrinho, {
        linhaId: proximoId,
        produtoId: produto.id,
        nome: produto.nome,
        preco: Number(produto.preco),
        quantidade: 1,
        observacao: '',
    }];
}

export function alterarQuantidade(carrinho, linhaId, delta) {
    return carrinho
        .map((linha) => (linha.linhaId === linhaId
            ? { ...linha, quantidade: linha.quantidade + delta }
            : linha))
        .filter((linha) => linha.quantidade > 0);
}

export function definirObservacao(carrinho, linhaId, observacao) {
    return carrinho.map((linha) => (
        linha.linhaId === linhaId ? { ...linha, observacao } : linha
    ));
}

export function removerItem(carrinho, linhaId) {
    return carrinho.filter((linha) => linha.linhaId !== linhaId);
}

// Subtotal dos itens. A taxa de serviço é somada pelo backend (CT7), por isso o valor
// final do pedido pode ser maior que este.
export function calcularSubtotal(carrinho) {
    return carrinho.reduce((total, linha) => total + linha.preco * linha.quantidade, 0);
}

// Corpo do CT7 criarPedido
export function montarPedido({ mesaId, garcomId, carrinho }) {
    return {
        mesaId: Number(mesaId),
        garcomId: Number(garcomId),
        itens: carrinho.map((linha) => {
            const item = { produtoId: linha.produtoId, quantidade: linha.quantidade };
            const observacao = linha.observacao?.trim();
            if (observacao) item.observacao = observacao;
            return item;
        }),
    };
}

export function mesaBloqueada(mesa) {
    return String(mesa?.status ?? '').trim().toLowerCase() === 'em_pagamento';
}

// Valida e envia. Devolve { ok: true, pedido } ou { ok: false, mensagem }.
export async function enviarPedido({
                                       mesaId,
                                       carrinho,
                                       sessao = lerSessao(),
                                       criar = criarPedido,
                                   }) {
    if (!mesaId) return { ok: false, mensagem: 'Escolha a mesa do pedido.' };
    if (!carrinho.length) return { ok: false, mensagem: 'Adicione pelo menos um item ao pedido.' };
    if (!sessao?.usuarioId) {
        return {
            ok: false,
            mensagem: 'Não foi possível identificar o garçom. Saia e entre novamente.',
        };
    }
    try {
        const pedido = await criar(montarPedido({ mesaId, garcomId: sessao.usuarioId, carrinho }));
        return { ok: true, pedido };
    } catch (erro) {
        return { ok: false, mensagem: mensagemDeErro(erro), codigo: erro.codigo };
    }
}

// ---------- Tela ----------

function criarElemento(tag, classe, texto) {
    const elemento = document.createElement(tag);
    if (classe) elemento.className = classe;
    if (texto !== undefined) elemento.textContent = texto;
    return elemento;
}

function mostrarAviso(elemento, texto, tipo = 'danger') {
    if (!texto) {
        elemento.textContent = '';
        elemento.className = 'alert d-none';
        return;
    }
    elemento.textContent = texto;
    elemento.className = `alert alert-${tipo}`;
}

export async function inicializarPedidoGarcom({
                                                  obterMapa = obterMapaMesas,
                                                  obterMenu = obterCardapio,
                                                  enviar = enviarPedido,
                                                  conectarMesas = conectarAtualizacoesMesas,
                                                  mesaIdInicial = new URLSearchParams(globalThis.location?.search).get('mesaId'),
                                                  redirecionar = (url) => { globalThis.location.href = url; },
                                              } = {}) {
    const selectMesa = document.getElementById('mesa');
    const avisoMesa = document.getElementById('aviso-mesa');
    const avisoPedido = document.getElementById('aviso-pedido');
    const listaCardapio = document.getElementById('cardapio-categorias');
    const avisoCardapio = document.getElementById('cardapio-alerta');
    const listaCarrinho = document.getElementById('carrinho-itens');
    const carrinhoVazio = document.getElementById('carrinho-vazio');
    const subtotalTexto = document.getElementById('subtotal');
    const botaoEnviar = document.getElementById('enviar-pedido');
    const statusConexao = document.getElementById('status-conexao');

    let carrinho = [];
    let mesas = [];
    let enviando = false;
    let mesaSelecionada = mesaIdInicial ? String(mesaIdInicial) : '';

    function mesaAtual() {
        return mesas.find((mesa) => String(mesa.mesaId) === String(mesaSelecionada));
    }

    function atualizarBotao() {
        const bloqueada = mesaBloqueada(mesaAtual());
        botaoEnviar.disabled = enviando || bloqueada || !mesaSelecionada || !carrinho.length;
        if (bloqueada) {
            mostrarAviso(
                avisoMesa,
                'Esta mesa está em pagamento no caixa. Só é possível lançar novos itens se o pagamento for cancelado.',
                'warning',
            );
        } else {
            mostrarAviso(avisoMesa, '');
        }
    }

    function renderizarMesas() {
        selectMesa.replaceChildren();
        const vazia = criarElemento('option', '', 'Selecione uma mesa');
        vazia.value = '';
        selectMesa.append(vazia);
        for (const mesa of mesas) {
            const opcao = criarElemento('option', '', `Mesa ${mesa.numero}${mesaBloqueada(mesa) ? ' (em pagamento)' : ''}`);
            opcao.value = String(mesa.mesaId);
            opcao.disabled = mesaBloqueada(mesa) && String(mesa.mesaId) !== String(mesaSelecionada);
            selectMesa.append(opcao);
        }
        selectMesa.value = mesaSelecionada;
        atualizarBotao();
    }

    async function carregarMesas() {
        try {
            const dados = await obterMapa();
            mesas = dados.mesas ?? [];
            renderizarMesas();
        } catch (erro) {
            mostrarAviso(avisoMesa, `Não foi possível carregar as mesas: ${mensagemDeErro(erro)}`);
        }
    }

    function renderizarCarrinho() {
        listaCarrinho.replaceChildren();
        carrinhoVazio.classList.toggle('d-none', carrinho.length > 0);

        for (const linha of carrinho) {
            const item = criarElemento('li', 'list-group-item');
            const topo = criarElemento('div', 'd-flex justify-content-between align-items-start gap-2');
            topo.append(
                criarElemento('span', 'fw-semibold', linha.nome),
                criarElemento('span', 'text-nowrap', formatarMoeda(linha.preco * linha.quantidade)),
            );

            const controles = criarElemento('div', 'd-flex align-items-center gap-2 mt-2');
            const menos = criarElemento('button', 'btn btn-outline-secondary btn-sm', '−');
            menos.type = 'button';
            menos.setAttribute('aria-label', `Diminuir ${linha.nome}`);
            menos.addEventListener('click', () => {
                carrinho = alterarQuantidade(carrinho, linha.linhaId, -1);
                renderizarCarrinho();
            });
            const quantidade = criarElemento('span', 'px-2', String(linha.quantidade));
            const mais = criarElemento('button', 'btn btn-outline-secondary btn-sm', '+');
            mais.type = 'button';
            mais.setAttribute('aria-label', `Aumentar ${linha.nome}`);
            mais.addEventListener('click', () => {
                carrinho = alterarQuantidade(carrinho, linha.linhaId, 1);
                renderizarCarrinho();
            });
            const remover = criarElemento('button', 'btn btn-link btn-sm text-danger ms-auto', 'Remover');
            remover.type = 'button';
            remover.addEventListener('click', () => {
                carrinho = removerItem(carrinho, linha.linhaId);
                renderizarCarrinho();
            });
            controles.append(menos, quantidade, mais, remover);

            const observacao = criarElemento('input', 'form-control form-control-sm mt-2');
            observacao.type = 'text';
            observacao.maxLength = 255;
            observacao.placeholder = 'Observação (ex.: sem cebola)';
            observacao.value = linha.observacao;
            observacao.setAttribute('aria-label', `Observação de ${linha.nome}`);
            // Sem redesenhar a lista a cada tecla, senão o campo perde o foco
            observacao.addEventListener('input', () => {
                carrinho = definirObservacao(carrinho, linha.linhaId, observacao.value);
            });

            item.append(topo, controles, observacao);
            listaCarrinho.append(item);
        }
        subtotalTexto.textContent = formatarMoeda(calcularSubtotal(carrinho));
        atualizarBotao();
    }

    function renderizarCardapio(categorias) {
        listaCardapio.replaceChildren();
        for (const categoria of categorias) {
            const produtos = categoria.produtos ?? [];
            if (!produtos.length) continue;
            const secao = criarElemento('section', 'mb-4');
            secao.append(criarElemento('h2', 'h5 mb-3', categoria.nome));
            const lista = criarElemento('div', 'list-group');
            for (const produto of produtos) {
                const botao = criarElemento('button', 'list-group-item list-group-item-action d-flex justify-content-between align-items-center');
                botao.type = 'button';
                botao.append(
                    criarElemento('span', '', produto.nome),
                    criarElemento('span', 'text-secondary text-nowrap', formatarMoeda(produto.preco)),
                );
                botao.setAttribute('aria-label', `Adicionar ${produto.nome} ao pedido`);
                botao.addEventListener('click', () => {
                    carrinho = adicionarItem(carrinho, produto);
                    mostrarAviso(avisoPedido, '');
                    renderizarCarrinho();
                });
                lista.append(botao);
            }
            secao.append(lista);
            listaCardapio.append(secao);
        }
        if (!listaCardapio.hasChildNodes()) {
            listaCardapio.textContent = 'Não há produtos ativos no cardápio.';
        }
    }

    async function carregarCardapioPedido() {
        try {
            const dados = await obterMenu();
            if (!Array.isArray(dados)) throw new Error('RESPOSTA_INVALIDA');
            renderizarCardapio(dados);
            mostrarAviso(avisoCardapio, '');
        } catch {
            mostrarAviso(avisoCardapio, 'Não foi possível carregar o cardápio. Tente novamente.');
        }
    }

    selectMesa.addEventListener('change', () => {
        mesaSelecionada = selectMesa.value;
        mostrarAviso(avisoPedido, '');
        atualizarBotao();
    });

    botaoEnviar.addEventListener('click', async () => {
        if (enviando) return;
        enviando = true;
        botaoEnviar.textContent = 'Enviando...';
        atualizarBotao();
        const resultado = await enviar({ mesaId: mesaSelecionada, carrinho });
        enviando = false;
        botaoEnviar.textContent = 'Enviar pedido';
        if (resultado.ok) {
            const mesa = mesaAtual();
            mostrarAviso(
                avisoPedido,
                `Pedido #${resultado.pedido.id} enviado para a cozinha${mesa ? ` (mesa ${mesa.numero})` : ''}.`,
                'success',
            );
            carrinho = [];
            renderizarCarrinho();
            await carregarMesas();
        } else {
            mostrarAviso(avisoPedido, resultado.mensagem);
            // Mesa pode ter entrado em pagamento sem a tela saber: atualiza o mapa
            if (resultado.codigo === 'MESA_EM_PAGAMENTO') await carregarMesas();
            atualizarBotao();
        }
    });

    renderizarCarrinho();
    await Promise.all([carregarMesas(), carregarCardapioPedido()]);

    // Mesa que entra em pagamento enquanto o pedido está sendo montado bloqueia o botão na hora
    let primeiraConexao = true;
    try {
        await conectarMesas({
            aoConectar: () => {
                if (!primeiraConexao) carregarMesas();
                primeiraConexao = false;
                if (statusConexao) statusConexao.textContent = 'Mesas atualizadas em tempo real.';
            },
            aoAtualizar: () => carregarMesas(),
            aoErro: () => {
                if (statusConexao) statusConexao.textContent = 'Sem conexão em tempo real com as mesas.';
            },
        });
    } catch {
        if (statusConexao) statusConexao.textContent = 'Atualização em tempo real indisponível.';
    }
}

if (typeof document !== 'undefined'
    && document.getElementById('pagina-pedido')
    && iniciarPagina('garcom')) {
    inicializarPedidoGarcom();
}
