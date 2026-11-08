import { obterMapaMesas } from './api.js';

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

export async function carregarMapaMesas({
    mapa = document.getElementById('mapa-mesas'),
    obterMapa = obterMapaMesas,
    permitirFechamento = false,
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
            if (permitirFechamento && mesa.status === 'ocupada' && mesa.mesaId != null) {
                const fechar = document.createElement('a');
                fechar.className = 'btn btn-primary mt-3';
                fechar.href = `/caixa/pagamento.html?mesaId=${encodeURIComponent(mesa.mesaId)}`;
                fechar.textContent = 'Fechar conta';
                corpo.appendChild(fechar);
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
    permitirFechamento = false,
} = {}) {
    const carregar = () => carregarMapaMesas({
        mapa,
        obterMapa,
        permitirFechamento,
        statusFiltro: filtroStatus?.value || 'todos',
        buscaNumero: buscaMesa?.value || '',
    });
    botao.addEventListener('click', carregar);
    filtroStatus?.addEventListener('change', carregar);
    buscaMesa?.addEventListener('input', carregar);
    carregar();
}
