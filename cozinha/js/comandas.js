import { obterComanda } from '../../assets/js/core/api.js';
import { conectarAtualizacoesComandas } from '../../assets/js/core/ws.js';
import { renderizarComanda } from '../../caixa/js/comandas.js';

export async function iniciarComandasCozinha({
    documento = document,
    api = obterComanda,
    conectar = conectarAtualizacoesComandas,
    imprimir = () => window.print(),
} = {}) {
    const status = documento.getElementById('status-comandas');
    const atualizar = async (evento) => {
        const pedidoId = evento.pedidoId ?? evento.comanda?.pedidoId ?? evento.pedido?.id;
        let comanda;
        if (pedidoId !== undefined && pedidoId !== null) {
            const dados = await api(pedidoId);
            comanda = dados.comanda ?? dados.pedido ?? dados;
        } else {
            comanda = evento.comanda ?? evento;
        }
        if (!Array.isArray(comanda.itens ?? comanda.items)) {
            throw new Error('A mensagem recebida não contém os itens da comanda.');
        }
        renderizarComanda(comanda, documento);
        status.textContent = `Comanda do pedido ${comanda.pedidoId ?? pedidoId} recebida.`;
        imprimir();
    };

    const cliente = await conectar({
        aoConectar: () => { status.textContent = 'Aguardando comandas da cozinha...'; },
        aoAtualizar: atualizar,
        aoErro: (erro) => {
            status.textContent = `Conexão das comandas indisponível: ${erro.message}`;
        },
    });
    window.addEventListener('pagehide', () => cliente.deactivate());
    return cliente;
}
