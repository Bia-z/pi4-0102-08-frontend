import { iniciarPagina } from '../../assets/js/core/guard.js';
import { carregarMapaMesas } from '../../assets/js/core/mapa-mesas.js';
import { carregarCardapio } from './cardapio.js';

export function inicializarPainelGarcom({
    botao = document.getElementById('atualizar'),
    carregarMenu = carregarCardapio,
    carregarMesas = carregarMapaMesas,
    agendar = globalThis.setInterval,
} = {}) {
    let atualizando = false;

    async function atualizar() {
        if (atualizando) return;
        atualizando = true;
        try {
            await Promise.allSettled([carregarMenu(), carregarMesas()]);
        } finally {
            atualizando = false;
        }
    }

    botao.addEventListener('click', atualizar);
    agendar(atualizar, 30_000);
    atualizar();
}

if (typeof document !== 'undefined'
    && document.getElementById('painel-garcom')
    && iniciarPagina('garcom')) {
    inicializarPainelGarcom();
}
