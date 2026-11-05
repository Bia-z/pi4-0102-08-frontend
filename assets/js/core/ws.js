import { lerSessao } from './auth.js';

export async function conectarAtualizacoesMesas({
    aoAtualizar,
    aoConectar = () => {},
    aoErro = (erro) => console.error(erro),
    criarCliente,
} = {}) {
    const sessao = lerSessao();
    if (!sessao?.token) {
        throw new Error('Não há uma sessão autenticada para conectar às atualizações das mesas.');
    }
    if (typeof aoAtualizar !== 'function') {
        throw new TypeError('Informe uma função para tratar as atualizações das mesas.');
    }

    const protocolo = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const brokerURL = `${protocolo}//${window.location.host}/ws`;
    const opcoesCliente = {
        brokerURL,
        connectHeaders: { Authorization: `Bearer ${sessao.token}` },
        reconnectDelay: 5000,
        onConnect: () => {
            aoConectar();
            cliente.subscribe('/topic/mesas', ({ body }) => {
                try {
                    const evento = JSON.parse(body);
                    if (evento.tipo === 'statusMesaAtualizado') {
                        Promise.resolve(aoAtualizar(evento)).catch(aoErro);
                    }
                } catch (erro) {
                    aoErro(erro);
                }
            });
        },
        onStompError: (frame) => {
            aoErro(new Error(frame.headers?.message || 'Falha na conexão STOMP.'));
        },
        onWebSocketError: () => {
            aoErro(new Error('Não foi possível conectar às atualizações das mesas.'));
        },
    };

    let cliente;
    if (criarCliente) {
        cliente = criarCliente(opcoesCliente);
    } else {
        const { Client } = await import('@stomp/stompjs');
        cliente = new Client(opcoesCliente);
    }
    cliente.activate();
    return cliente;
}
