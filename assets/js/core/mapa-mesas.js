import { listarPedidos, obterMapaMesas, transferirPedidoParaMesa } from './api.js';
import { lerSessao } from './auth.js';

const STATUS_LABEL = {
    disponivel: 'Disponível',
    ocupada: 'Ocupada',
    reservada: 'Reservada',
    em_pagamento: 'Em pagamento',
};

const FORMATO_MOEDA = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
});
const PERFIS_COM_TRANSFERENCIA = new Set(['ADMIN', 'CAIXA', 'GARCOM']);
const STATUS_PEDIDO_FECHADO = new Set(['pago', 'cancelado']);

export function podeTransferirPedidos(perfil) {
    const perfilNormalizado = String(perfil ?? '').trim().toUpperCase().replace('Ç', 'C');
    return PERFIS_COM_TRANSFERENCIA.has(perfilNormalizado);
}

function criarAcaoTransferencia({
    documento,
    mesa,
    destinos,
    listar = listarPedidos,
    transferir = transferirPedidoParaMesa,
    recarregar,
}) {
    const grupo = documento.createElement('div');
    grupo.className = 'mt-3';
    const botao = documento.createElement('button');
    botao.type = 'button';
    botao.className = 'btn btn-outline-primary';
    botao.textContent = 'Transferir pedido';
    const formulario = documento.createElement('div');
    formulario.className = 'mt-2';
    formulario.hidden = true;
    const mensagem = documento.createElement('p');
    mensagem.className = 'small mt-2';
    mensagem.setAttribute('role', 'status');
    const pedido = documento.createElement('select');
    pedido.className = 'form-select mb-2';
    pedido.setAttribute('aria-label', `Pedido da mesa ${mesa.numero}`);
    const destino = documento.createElement('select');
    destino.className = 'form-select mb-2';
    destino.setAttribute('aria-label', `Mesa de destino do pedido da mesa ${mesa.numero}`);
    const confirmar = documento.createElement('button');
    confirmar.type = 'button';
    confirmar.className = 'btn btn-primary';
    confirmar.textContent = 'Confirmar transferência';
    confirmar.disabled = true;

    pedido.addEventListener('change', () => {
        confirmar.disabled = !pedido.value || !destino.value;
    });
    destino.addEventListener('change', () => {
        confirmar.disabled = !pedido.value || !destino.value;
    });
    botao.addEventListener('click', async () => {
        botao.disabled = true;
        mensagem.textContent = 'Carregando pedidos em aberto...';
        mensagem.className = 'small mt-2 text-secondary';
        formulario.hidden = false;
        pedido.replaceChildren();
        const opcaoPedido = documento.createElement('option');
        opcaoPedido.value = '';
        opcaoPedido.textContent = 'Selecione um pedido';
        pedido.appendChild(opcaoPedido);
        try {
            const resposta = await listar({ mesaId: mesa.mesaId });
            const pedidos = Array.isArray(resposta)
                ? resposta
                : resposta.pedidos ?? resposta.conteudo ?? [];
            const emAberto = pedidos.filter((item) => (
                !STATUS_PEDIDO_FECHADO.has(String(item.status ?? '').trim().toLowerCase())
            ));
            for (const item of emAberto) {
                const id = item.pedidoId ?? item.id;
                if (id == null) continue;
                const opcao = documento.createElement('option');
                opcao.value = id;
                opcao.textContent = `Pedido ${item.pedidoId ?? item.id}`;
                pedido.appendChild(opcao);
            }
            if (!emAberto.length) {
                mensagem.textContent = 'Não há pedidos em aberto nesta mesa.';
                confirmar.disabled = true;
            } else {
                mensagem.textContent = '';
            }
        } catch (erro) {
            mensagem.textContent = erro.message;
            mensagem.className = 'small mt-2 text-danger';
        } finally {
            botao.disabled = false;
        }
    });
    confirmar.addEventListener('click', async () => {
        if (!pedido.value || !destino.value || confirmar.disabled) return;
        confirmar.disabled = true;
        mensagem.textContent = 'Transferindo pedido...';
        mensagem.className = 'small mt-2 text-secondary';
        try {
            await transferir(pedido.value, Number(destino.value));
            mensagem.textContent = 'Pedido transferido com sucesso.';
            mensagem.className = 'small mt-2 text-success';
            await recarregar();
        } catch (erro) {
            mensagem.textContent = erro.message;
            mensagem.className = 'small mt-2 text-danger';
            confirmar.disabled = false;
        }
    });

    const opcaoDestino = documento.createElement('option');
    opcaoDestino.value = '';
    opcaoDestino.textContent = 'Selecione uma mesa de destino';
    destino.appendChild(opcaoDestino);
    for (const mesaDestino of destinos) {
        if (mesaDestino.mesaId == null) continue;
        const opcao = documento.createElement('option');
        opcao.value = mesaDestino.mesaId;
        opcao.textContent = `Mesa ${mesaDestino.numero}`;
        destino.appendChild(opcao);
    }

    formulario.append(pedido, destino, confirmar, mensagem);
    botao.disabled = destinos.length === 0;
    if (!destinos.length) botao.title = 'Não há mesas disponíveis para receber o pedido.';
    grupo.append(botao, formulario);
    return grupo;
}

function criarAcaoLancamento(mesa, statusMesa) {
    if (statusMesa === 'em_pagamento') {
        const bloqueado = document.createElement('button');
        bloqueado.type = 'button';
        bloqueado.className = 'btn btn-outline-secondary mt-3';
        bloqueado.textContent = 'Mesa em pagamento';
        bloqueado.disabled = true;
        return bloqueado;
    }
    const lancar = document.createElement('a');
    lancar.className = 'btn btn-primary mt-3';
    lancar.href = `/garcom/pedido.html?mesaId=${encodeURIComponent(mesa.mesaId)}`;
    lancar.textContent = 'Lançar pedido';
    return lancar;
}

export async function carregarMapaMesas({
    documento = globalThis.document,
    mapa = documento.getElementById('mapa-mesas'),
    obterMapa = obterMapaMesas,
    listar = listarPedidos,
    transferir = transferirPedidoParaMesa,
    perfil = lerSessao()?.perfil,
    permitirFechamento = false,
    permitirLancamento = false,
    statusFiltro,
    buscaNumero,
} = {}) {
    if (!mapa.hasChildNodes()) mapa.textContent = 'Carregando mesas...';

    try {
        const dados = await obterMapa();
        mapa.replaceChildren();

        const getElementById = globalThis.document?.getElementById;
        const statusAtual = statusFiltro
            ?? (typeof getElementById === 'function'
                ? getElementById.call(globalThis.document, 'filtro-status-mesa')?.value
                : null)
            ?? 'todos';
        const buscaAtual = buscaNumero
            ?? (typeof getElementById === 'function'
                ? getElementById.call(globalThis.document, 'buscar-mesa')?.value
                : null)
            ?? '';
        const termoBusca = String(buscaAtual).trim().toLocaleLowerCase('pt-BR');
        const mesas = (dados.mesas ?? []).filter((mesa) => {
            const status = String(mesa.status ?? '').toLocaleLowerCase('pt-BR');
            const atendeStatus = statusAtual === 'todos'
                || status === statusAtual
                || (statusAtual === 'ocupada' && status === 'em_pagamento');
            const atendeBusca = String(mesa.numero ?? '').toLocaleLowerCase('pt-BR')
                .includes(termoBusca);
            return atendeStatus && atendeBusca;
        });

        if (!mesas.length) {
            mapa.textContent = dados.mesas?.length
                ? 'Nenhuma mesa corresponde aos filtros selecionados.'
                : 'Nenhuma mesa disponível para exibição.';
            return;
        }

        for (const mesa of mesas) {
            const card = document.createElement('article');
            card.className = 'card h-100';

            const corpo = document.createElement('div');
            corpo.className = 'card-body';

            const titulo = document.createElement('h3');
            titulo.className = 'h5 card-title';
            titulo.textContent = `Mesa ${mesa.numero}`;

            const status = document.createElement('p');
            status.className = 'card-text';
            status.textContent = `Status: ${STATUS_LABEL[mesa.status] ?? mesa.status}`;

            const valor = document.createElement('p');
            valor.className = 'card-text mb-0';
            valor.textContent = `Consumido: ${FORMATO_MOEDA.format(mesa.valorConsumido)}`;

            corpo.append(titulo, status, valor);
            const statusMesa = String(mesa.status ?? '').trim().toLowerCase();
            const destinos = (dados.mesas ?? []).filter((candidata) => (
                candidata.mesaId != null
                && String(candidata.status ?? '').trim().toLowerCase() === 'disponivel'
                && String(candidata.mesaId) !== String(mesa.mesaId)
            ));
            if (podeTransferirPedidos(perfil) && statusMesa === 'ocupada' && mesa.mesaId != null) {
                corpo.appendChild(criarAcaoTransferencia({
                    documento,
                    mesa,
                    destinos,
                    listar,
                    transferir,
                    recarregar: () => carregarMapaMesas({
                        mapa,
                        obterMapa,
                        listar,
                        transferir,
                        perfil,
                        permitirFechamento,
                        permitirLancamento,
                        statusFiltro: statusAtual,
                        buscaNumero: buscaAtual,
                    }),
                }));
            }
            if (permitirFechamento && mesa.mesaId != null) {
                const abrir = document.createElement('a');
                abrir.className = 'btn btn-primary mt-3';
                abrir.href = `/caixa/pagamento.html?mesaId=${encodeURIComponent(mesa.mesaId)}`;
                abrir.textContent = 'Ver itens';
                corpo.appendChild(abrir);
            }
            if (permitirLancamento && mesa.mesaId != null) {
                corpo.appendChild(criarAcaoLancamento(mesa, statusMesa));
            }
            card.appendChild(corpo);
            mapa.appendChild(card);
        }
    } catch (erro) {
        mapa.textContent = `Não foi possível carregar as mesas: ${erro.message}`;
    }
}

export function inicializarMapaMesas({
    mapa = document.getElementById('mapa-mesas'),
    botao = document.getElementById('atualizar-mesas'),
    filtroStatus = document.getElementById('filtro-status-mesa'),
    buscaMesa = document.getElementById('buscar-mesa'),
    obterMapa = obterMapaMesas,
    listar = listarPedidos,
    transferir = transferirPedidoParaMesa,
    perfil = lerSessao()?.perfil,
    permitirFechamento = false,
} = {}) {
    const carregar = () => carregarMapaMesas({
        mapa,
        obterMapa,
        listar,
        transferir,
        perfil,
        permitirFechamento,
        statusFiltro: filtroStatus?.value || 'todos',
        buscaNumero: buscaMesa?.value || '',
    });
    botao.addEventListener('click', carregar);
    filtroStatus?.addEventListener('change', carregar);
    buscaMesa?.addEventListener('input', carregar);
    carregar();
}
