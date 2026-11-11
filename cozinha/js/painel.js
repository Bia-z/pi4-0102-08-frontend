import { atualizarStatusItemPedido, listarPedidos } from '../../assets/js/core/api.js';
import { mensagemDeErro } from '../../assets/js/core/ui.js';
import { conectarAtualizacoesCozinha } from '../../assets/js/core/ws.js';
import { imprimirComandaDoPedido } from './comandas.js';

const STATUS_ITEM = {
    aguardando: { texto: 'Aguardando', classe: 'text-bg-secondary', proximo: 'em_preparo', acao: 'Iniciar preparo' },
    em_preparo: { texto: 'Em preparo', classe: 'text-bg-warning', proximo: 'pronto', acao: 'Marcar como pronto' },
};

export function infoStatusItem(status) {
    return STATUS_ITEM[status] ?? { texto: String(status ?? ''), classe: 'text-bg-light' };
}

export function ordenarPorChegada(pedidos) {
    return [...pedidos].sort((a, b) => new Date(a.dataCriacao) - new Date(b.dataCriacao));
}

function criarElemento(tag, classe, texto) {
    const elemento = document.createElement(tag);
    if (classe) elemento.className = classe;
    if (texto !== undefined) elemento.textContent = texto;
    return elemento;
}

function formatarHora(dataHora) {
    const data = new Date(dataHora);
    if (Number.isNaN(data.getTime())) return '';
    return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export async function inicializarPainelCozinha({
    listar = listarPedidos,
    atualizarStatus = atualizarStatusItemPedido,
    conectar = conectarAtualizacoesCozinha,
    imprimirComanda = imprimirComandaDoPedido,
} = {}) {
    const lista = document.getElementById('pedidos');
    const vazio = document.getElementById('pedidos-vazio');
    const alerta = document.getElementById('pedidos-alerta');
    const status = document.getElementById('status-conexao');
    const botaoAtualizar = document.getElementById('atualizar');

    let pedidos = [];

    function mostrarStatus(texto, erro = false) {
        status.textContent = texto;
        status.classList.toggle('text-danger', erro);
        status.classList.toggle('text-secondary', !erro);
    }

    function mostrarAlerta(texto) {
        alerta.textContent = texto;
        alerta.classList.remove('d-none');
    }

    async function avancar(pedido, item, botao) {
        botao.disabled = true;
        try {
            await atualizarStatus(pedido.id, item.id, infoStatusItem(item.status).proximo);
            await carregar();
        } catch (erro) {
            mostrarAlerta(`Não foi possível atualizar o item. ${mensagemDeErro(erro)}`);
            botao.disabled = false;
        }
    }

    async function imprimir(pedido, botao) {
        botao.disabled = true;
        try {
            await imprimirComanda(pedido.id);
        } catch (erro) {
            mostrarAlerta(`Não foi possível imprimir a comanda. ${mensagemDeErro(erro)}`);
        } finally {
            botao.disabled = false;
        }
    }

    function renderizarPedidos() {
        lista.replaceChildren();
        vazio.classList.toggle('d-none', pedidos.length > 0);

        for (const pedido of pedidos) {
            const coluna = criarElemento('div', 'col');
            const cartao = criarElemento('article', 'card h-100');
            const corpo = criarElemento('div', 'card-body');

            const cabecalho = criarElemento('div', 'd-flex justify-content-between align-items-center mb-2');
            cabecalho.append(
                criarElemento('h2', 'h5 mb-0', `Mesa ${pedido.numeroMesa} · Pedido #${pedido.id}`),
                criarElemento('span', 'text-secondary small', formatarHora(pedido.dataCriacao)),
            );
            corpo.append(cabecalho);

            const itens = criarElemento('ul', 'list-group list-group-flush');
            for (const item of pedido.itens) {
                const linha = criarElemento('li', 'list-group-item px-0');
                const topo = criarElemento('div', 'd-flex justify-content-between align-items-start');
                const descricao = criarElemento('div');
                descricao.append(criarElemento('span', 'fw-semibold', `${item.quantidade}× ${item.produtoNome}`));
                if (item.observacao) {
                    descricao.append(criarElemento('div', 'small text-secondary', `Obs.: ${item.observacao}`));
                }
                const info = infoStatusItem(item.status);
                topo.append(descricao, criarElemento('span', `badge ${info.classe}`, info.texto));
                linha.append(topo);

                if (info.proximo) {
                    const botao = criarElemento('button', 'btn btn-sm btn-outline-primary mt-2', info.acao);
                    botao.type = 'button';
                    botao.addEventListener('click', () => avancar(pedido, item, botao));
                    linha.append(botao);
                }
                itens.append(linha);
            }
            const botaoImprimir = criarElemento('button', 'btn btn-sm btn-outline-secondary mt-3', 'Imprimir comanda');
            botaoImprimir.type = 'button';
            botaoImprimir.addEventListener('click', () => imprimir(pedido, botaoImprimir));
            corpo.append(itens, botaoImprimir);
            cartao.append(corpo);
            coluna.append(cartao);
            lista.append(coluna);
        }
    }

    async function carregar() {
        try {
            const dados = await listar();
            if (!Array.isArray(dados)) throw new Error('RESPOSTA_INVALIDA');
            pedidos = ordenarPorChegada(dados);
            alerta.classList.add('d-none');
            renderizarPedidos();
        } catch (erro) {
            mostrarAlerta(`Não foi possível carregar os pedidos. ${mensagemDeErro(erro)}`);
        }
    }

    botaoAtualizar.addEventListener('click', carregar);
    await carregar();

    let primeiraConexao = true;
    try {
        await conectar({
            aoConectar: () => {
                if (!primeiraConexao) carregar();
                primeiraConexao = false;
                mostrarStatus('Pedidos atualizados em tempo real.');
            },
            aoAtualizar: carregar,
            aoErro: (erro) => mostrarStatus(
                erro.message || 'Sem conexão em tempo real. Use o botão Atualizar.',
                true,
            ),
        });
    } catch {
        mostrarStatus('Atualização em tempo real indisponível. Use o botão Atualizar.', true);
    }
}
