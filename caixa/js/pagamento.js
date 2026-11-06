import { baixarComprovantePedido } from '../../assets/js/core/api.js';

export function configurarBotaoComprovante({ botao, mensagem }) {
    let pedidoId;
    botao.disabled = true;

    botao.addEventListener('click', async () => {
        if (!pedidoId || botao.disabled) return;

        botao.disabled = true;
        mensagem.textContent = '';
        try {
            await baixarComprovantePedido(pedidoId);
        } catch (erro) {
            mensagem.textContent = erro.codigo || erro.message;
        } finally {
            botao.disabled = false;
        }
    });

    return function habilitarAposPagamento(resposta) {
        const pedidosPagos = resposta?.pedidosPagos;
        pedidoId = Array.isArray(pedidosPagos) ? pedidosPagos[0] : undefined;
        botao.disabled = !pedidoId;
        mensagem.textContent = '';
    };
}