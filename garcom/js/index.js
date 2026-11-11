import { iniciarPagina } from '../../assets/js/core/guard.js';
import { carregarMapaMesas } from '../../assets/js/core/mapa-mesas.js';
import { conectarAtualizacoesMesas } from '../../assets/js/core/ws.js';
import { carregarCardapio } from './cardapio.js';

function mostrarStatus(elemento, texto, erro = false) {
    if (!elemento) return;
    elemento.textContent = texto;
    elemento.classList.toggle('text-danger', erro);
    elemento.classList.toggle('text-secondary', !erro);
}

export async function acompanharMesasEmTempoReal({
    recarregar,
    conectar = conectarAtualizacoesMesas,
    status = globalThis.document?.getElementById('status-conexao'),
} = {}) {
    let primeiraConexao = true;
    try {
        return await conectar({
            aoConectar: () => {
                if (!primeiraConexao) recarregar();
                primeiraConexao = false;
                mostrarStatus(status, 'Mesas atualizadas em tempo real.');
            },
            aoAtualizar: () => recarregar(),
            aoErro: () => mostrarStatus(
                status,
                'Sem conexão em tempo real. Use o botão Atualizar enquanto reconectamos.',
                true,
            ),
        });
    } catch {
        mostrarStatus(status, 'Atualização em tempo real indisponível. Use o botão Atualizar.', true);
        return null;
    }
}

export function inicializarPainelGarcom({
    botao = document.getElementById('atualizar'),
    carregarMenu = carregarCardapio,
    carregarMesas = () => carregarMapaMesas({ permitirLancamento: true }),
    acompanhar = acompanharMesasEmTempoReal,
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
    atualizar();
    return acompanhar({ recarregar: carregarMesas });
}

if (typeof document !== 'undefined'
    && document.getElementById('painel-garcom')
    && iniciarPagina('garcom')) {
    inicializarPainelGarcom();
}
