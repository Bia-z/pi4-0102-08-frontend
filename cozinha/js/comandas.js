import { obterComanda } from '../../assets/js/core/api.js';
import { conectarAtualizacoesComandas } from '../../assets/js/core/ws.js';
import { renderizarComanda } from '../../caixa/js/comandas.js';

function itensDa(comanda) {
    return comanda?.itens ?? comanda?.items;
}

export async function imprimirComandaDoPedido(pedidoId, {
    documento = document,
    api = obterComanda,
    imprimir = () => window.print(),
} = {}) {
    const dados = await api(pedidoId);
    renderizarComanda(dados.comanda ?? dados.pedido ?? dados, documento);
    documento.getElementById('reimprimir-comanda').disabled = false;
    imprimir();
}

export async function iniciarComandasCozinha({
    documento = document,
    api = obterComanda,
    conectar = conectarAtualizacoesComandas,
    imprimir = () => window.print(),
} = {}) {
    const status = documento.getElementById('status-comandas');
    const reimprimir = documento.getElementById('reimprimir-comanda');
    reimprimir.addEventListener('click', () => imprimir());

    const atualizar = async (evento) => {
        let comanda = evento.comanda ?? evento;
        if (!Array.isArray(itensDa(comanda))) {
            const pedidoId = evento.pedidoId ?? evento.pedido?.id;
            if (pedidoId === undefined || pedidoId === null) {
                throw new Error('A mensagem recebida não contém os itens da comanda.');
            }
            const dados = await api(pedidoId);
            comanda = dados.comanda ?? dados.pedido ?? dados;
        }
        if (!Array.isArray(itensDa(comanda))) {
            throw new Error('A mensagem recebida não contém os itens da comanda.');
        }
        renderizarComanda(comanda, documento);
        reimprimir.disabled = false;
        status.textContent = `Comanda do pedido ${comanda.pedidoId ?? evento.pedidoId} recebida.`;
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
