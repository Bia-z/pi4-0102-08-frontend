import { confirmar as confirmarAcao } from '../../assets/js/core/confirmar.js';
import { cancelarItemPedido, listarPedidos } from '../../assets/js/core/api.js';
import { lerSessao } from '../../assets/js/core/auth.js';
import { iniciarPagina } from '../../assets/js/core/guard.js';
import { mensagemDeErro } from '../../assets/js/core/ui.js';
import { conectarAtualizacoesPedidos } from '../../assets/js/core/ws.js';

const STATUS_ITEM = {
    aguardando: { texto: 'Aguardando', classe: 'text-bg-secondary' },
    em_preparo: { texto: 'Em preparo', classe: 'text-bg-warning' },
    pronto: { texto: 'Pronto para servir', classe: 'text-bg-success' },
    cancelado: { texto: 'Cancelado', classe: 'text-bg-dark' },
};

export function infoStatusItem(status) {
    return STATUS_ITEM[status] ?? { texto: String(status ?? ''), classe: 'text-bg-light' };
}

// O garçom só cancela o que a cozinha ainda não começou a preparar
export function podeCancelar(item) {
    return item.status === 'aguardando';
}

export function textoConfirmacaoCancelamento(pedido, item) {
    return `${item.quantidade}× ${item.produtoNome} sai do pedido da mesa ${pedido.numeroMesa} e da conta.`;
}

export function aplicarStatusItem(pedidos, evento) {
    let item = null;
    let mesa = null;
    const atualizados = pedidos.map((pedido) => {
        if (pedido.id !== evento.pedidoId) return pedido;
        return {
            ...pedido,
            itens: pedido.itens.map((atual) => {
                if (atual.id !== evento.itemId) return atual;
                item = atual;
                mesa = pedido.numeroMesa;
                return { ...atual, status: evento.status };
            }),
        };
    });
    return {
        pedidos: atualizados,
        encontrado: item !== null,
        mudou: item !== null && item.status !== evento.status,
        item,
        numeroMesa: mesa ?? evento.numeroMesa,
    };
}

export function contarProntos(pedido) {
    return pedido.itens.filter((item) => item.status === 'pronto').length;
}

export function descreverItemPronto({ item, numeroMesa }) {
    return `Mesa ${numeroMesa}: ${item.quantidade}× ${item.produtoNome} pronto para servir.`;
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

export async function inicializarAcompanhamento({
                                                    listar = listarPedidos,
                                                    conectar = conectarAtualizacoesPedidos,
                                                    sessao = lerSessao(),
                                                    cancelar = cancelarItemPedido,
                                                    confirmar = (texto) => confirmarAcao({
                                                        titulo: 'Cancelar item?',
                                                        mensagem: texto,
                                                        textoConfirmar: 'Cancelar item',
                                                        textoCancelar: 'Voltar',
                                                    }),
                                                } = {}) {
    const lista = document.getElementById('pedidos');
    const vazio = document.getElementById('pedidos-vazio');
    const alerta = document.getElementById('pedidos-alerta');
    const avisos = document.getElementById('avisos-prontos');
    const status = document.getElementById('status-conexao');
    const botaoAtualizar = document.getElementById('atualizar');
    const todos = document.getElementById('todos-garcons');

    let pedidos = [];
    let notificacoes = [];
    let proximaNotificacao = 1;

    function mostrarStatus(texto, erro = false) {
        status.textContent = texto;
        status.classList.toggle('text-danger', erro);
        status.classList.toggle('text-secondary', !erro);
    }

    function renderizarAvisos() {
        avisos.replaceChildren();
        for (const aviso of notificacoes) {
            const caixa = criarElemento('div', 'alert alert-success d-flex justify-content-between align-items-center');
            caixa.setAttribute('role', 'alert');
            caixa.append(criarElemento('span', 'fw-semibold', aviso.texto));
            const dispensar = criarElemento('button', 'btn btn-sm btn-outline-success', 'Ok');
            dispensar.type = 'button';
            dispensar.addEventListener('click', () => {
                notificacoes = notificacoes.filter((atual) => atual.id !== aviso.id);
                renderizarAvisos();
            });
            caixa.append(dispensar);
            avisos.append(caixa);
        }
    }

    function renderizarPedidos() {
        lista.replaceChildren();
        vazio.classList.toggle('d-none', pedidos.length > 0);

        for (const pedido of pedidos) {
            const cartao = criarElemento('article', 'card');
            const corpo = criarElemento('div', 'card-body');

            const cabecalho = criarElemento('div', 'd-flex justify-content-between align-items-center mb-2');
            cabecalho.append(
                criarElemento('h2', 'h5 mb-0', `Mesa ${pedido.numeroMesa} · Pedido #${pedido.id}`),
                criarElemento('span', 'text-secondary small', formatarHora(pedido.dataCriacao)),
            );
            corpo.append(cabecalho);

            const prontos = contarProntos(pedido);
            if (prontos > 0) {
                corpo.append(criarElemento(
                    'p',
                    'small fw-semibold text-success mb-2',
                    `${prontos} ${prontos === 1 ? 'item pronto' : 'itens prontos'} para servir`,
                ));
            }

            const itens = criarElemento('ul', 'list-group list-group-flush');
            for (const item of pedido.itens) {
                const linha = criarElemento('li', 'list-group-item d-flex justify-content-between align-items-start px-0');
                const descricao = criarElemento('div');
                const nome = criarElemento('span', '', `${item.quantidade}× ${item.produtoNome}`);
                if (item.status === 'cancelado') {
                    nome.classList.add('text-decoration-line-through', 'text-secondary');
                }
                descricao.append(nome);
                if (item.observacao) {
                    descricao.append(criarElemento('div', 'small text-secondary', `Obs.: ${item.observacao}`));
                }
                const info = infoStatusItem(item.status);
                const lado = criarElemento('div', 'd-flex flex-column align-items-end gap-1');
                lado.append(criarElemento('span', `badge ${info.classe}`, info.texto));
                if (podeCancelar(item)) {
                    const botao = criarElemento('button', 'btn btn-sm btn-outline-danger', 'Cancelar');
                    botao.type = 'button';
                    botao.dataset.cancelarItem = item.id;
                    botao.setAttribute('aria-label', `Cancelar ${item.produtoNome} da mesa ${pedido.numeroMesa}`);
                    botao.addEventListener('click', () => cancelarItem(pedido, item, botao));
                    lado.append(botao);
                }
                linha.append(descricao, lado);
                itens.append(linha);
            }
            corpo.append(itens);
            cartao.append(corpo);
            lista.append(cartao);
        }
    }

    async function carregar() {
        const filtro = !todos.checked && sessao?.usuarioId ? { garcomId: sessao.usuarioId } : {};
        try {
            const dados = await listar(filtro);
            if (!Array.isArray(dados)) throw new Error('RESPOSTA_INVALIDA');
            pedidos = dados;
            alerta.classList.add('d-none');
            renderizarPedidos();
        } catch (erro) {
            alerta.textContent = `Não foi possível carregar os pedidos. ${mensagemDeErro(erro)}`;
            alerta.classList.remove('d-none');
        }
    }

    async function cancelarItem(pedido, item, botao) {
        if (!(await confirmar(textoConfirmacaoCancelamento(pedido, item)))) return;
        botao.disabled = true;
        try {
            await cancelar(pedido.id, item.id);
        } catch (erro) {
            // Recarrega primeiro: o carregar() limpa o alerta quando dá certo
            await carregar();
            alerta.textContent = `Não foi possível cancelar o item. ${mensagemDeErro(erro)}`;
            alerta.classList.remove('d-none');
            return;
        }
        await carregar();
    }

    function tratarEvento(evento) {
        // Cancelamento pode fechar o pedido inteiro; a API devolve a lista certa
        if (evento?.status === 'cancelado') {
            return carregar();
        }
        const resultado = aplicarStatusItem(pedidos, evento);
        if (!resultado.encontrado) {
            return carregar();
        }
        pedidos = resultado.pedidos;
        if (resultado.mudou && evento.status === 'pronto') {
            notificacoes = [
                ...notificacoes,
                { id: proximaNotificacao++, texto: descreverItemPronto(resultado) },
            ];
            renderizarAvisos();
        }
        renderizarPedidos();
        return undefined;
    }

    botaoAtualizar.addEventListener('click', carregar);
    todos.addEventListener('change', carregar);
    await carregar();

    let primeiraConexao = true;
    try {
        await conectar({
            aoConectar: () => {
                if (!primeiraConexao) carregar();
                primeiraConexao = false;
                mostrarStatus('Pedidos atualizados em tempo real.');
            },
            aoAtualizar: tratarEvento,
            aoErro: (erro) => mostrarStatus(
                erro.message || 'Sem conexão em tempo real. Use o botão Atualizar.',
                true,
            ),
        });
    } catch {
        mostrarStatus('Atualização em tempo real indisponível. Use o botão Atualizar.', true);
    }
}

if (typeof document !== 'undefined'
    && document.getElementById('pagina-acompanhamento')
    && iniciarPagina('garcom')) {
    inicializarAcompanhamento();
}
