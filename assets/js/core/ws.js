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

export async function conectarAtualizacoesPedidos({
    aoAtualizar,
    aoConectar = () => {},
    aoErro = (erro) => console.error(erro),
    criarCliente,
} = {}) {
    const sessao = lerSessao();
    if (!sessao?.token) {
        throw new Error('Não há uma sessão autenticada para conectar às atualizações dos pedidos.');
    }
    if (typeof aoAtualizar !== 'function') {
        throw new TypeError('Informe uma função para tratar as atualizações dos pedidos.');
    }

    const protocolo = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const brokerURL = `${protocolo}//${window.location.host}/ws`;
    let cliente;
    const opcoesCliente = {
        brokerURL,
        connectHeaders: { Authorization: `Bearer ${sessao.token}` },
        reconnectDelay: 5000,
        onConnect: () => {
            aoConectar();
            cliente.subscribe('/topic/pedidos', ({ body }) => {
                try {
                    const evento = JSON.parse(body);
                    if (evento.tipo === 'statusPedidoAtualizado') {
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
            aoErro(new Error('Não foi possível conectar às atualizações dos pedidos.'));
        },
        onWebSocketClose: () => {
            aoErro(new Error('Conexão dos pedidos interrompida. Tentando reconectar...'));
        },
    };

    if (criarCliente) {
        cliente = criarCliente(opcoesCliente);
    } else {
        const { Client } = await import('@stomp/stompjs');
        cliente = new Client(opcoesCliente);
    }
    cliente.activate();
    return cliente;
}

export async function conectarAtualizacoesComandas({
    aoAtualizar,
    aoConectar = () => {},
    aoErro = (erro) => console.error(erro),
    criarCliente,
} = {}) {
    const sessao = lerSessao();
    if (!sessao?.token) {
        throw new Error('Não há uma sessão autenticada para conectar às comandas.');
    }
    if (typeof aoAtualizar !== 'function') {
        throw new TypeError('Informe uma função para tratar as comandas recebidas.');
    }

    const protocolo = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const brokerURL = `${protocolo}//${window.location.host}/ws`;
    let cliente;
    const opcoesCliente = {
        brokerURL,
        connectHeaders: { Authorization: 'Bearer ' + sessao.token },
        reconnectDelay: 5000,
        onConnect: () => {
            aoConectar();
            cliente.subscribe('/topic/comandas', ({ body }) => {
                try {
                    const evento = JSON.parse(body);
                    Promise.resolve(aoAtualizar(evento)).catch(aoErro);
                } catch (erro) {
                    aoErro(erro);
                }
            });
        },
        onStompError: (frame) => {
            aoErro(new Error(frame.headers?.message || 'Falha na conexão STOMP.'));
        },
        onWebSocketError: () => {
            aoErro(new Error('Não foi possível conectar às atualizações das comandas.'));
        },
        onWebSocketClose: () => {
            aoErro(new Error('Conexão das comandas interrompida. Tentando reconectar...'));
        },
    };

    if (criarCliente) {
        cliente = criarCliente(opcoesCliente);
    } else {
        const { Client } = await import('@stomp/stompjs');
        cliente = new Client(opcoesCliente);
    }
    cliente.activate();
    return cliente;
}

export async function conectarAtualizacoesCozinha({
    aoAtualizar,
    aoConectar = () => {},
    aoErro = (erro) => console.error(erro),
    criarCliente,
} = {}) {
    const sessao = lerSessao();
    if (!sessao?.token) {
        throw new Error('Não há uma sessão autenticada para conectar ao painel da cozinha.');
    }
    if (typeof aoAtualizar !== 'function') {
        throw new TypeError('Informe uma função para tratar os pedidos da cozinha.');
    }

    const protocolo = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const brokerURL = `${protocolo}//${window.location.host}/ws`;
    let cliente;
    const receber = ({ body }) => {
        try {
            const evento = JSON.parse(body);
            if (evento.tipo === 'pedidoCriado' || evento.tipo === 'statusPedidoAtualizado') {
                Promise.resolve(aoAtualizar(evento)).catch(aoErro);
            }
        } catch (erro) {
            aoErro(erro);
        }
    };
    const opcoesCliente = {
        brokerURL,
        connectHeaders: { Authorization: `Bearer ${sessao.token}` },
        reconnectDelay: 5000,
        onConnect: () => {
            aoConectar();
            cliente.subscribe('/topic/cozinha', receber);
            cliente.subscribe('/topic/pedidos', receber);
        },
        onStompError: (frame) => {
            aoErro(new Error(frame.headers?.message || 'Falha na conexão STOMP.'));
        },
        onWebSocketError: () => {
            aoErro(new Error('Não foi possível conectar ao painel da cozinha.'));
        },
        onWebSocketClose: () => {
            aoErro(new Error('Conexão do painel da cozinha interrompida. Tentando reconectar...'));
        },
    };

    if (criarCliente) {
        cliente = criarCliente(opcoesCliente);
    } else {
        const { Client } = await import('@stomp/stompjs');
        cliente = new Client(opcoesCliente);
    }
    cliente.activate();
    return cliente;
}
