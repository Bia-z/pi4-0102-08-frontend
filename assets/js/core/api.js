import { API_BASE } from './config.js';
import { lerSessao, sair } from './auth.js';

async function requisitarJson(caminho, opcoes) {
    const resposta = await fetch(`${API_BASE}${caminho}`, opcoes);
    const dados = await resposta.json().catch(() => ({}));

    if (!resposta.ok) {
        const erro = new Error(dados.erro || 'ERRO_DESCONHECIDO');
        erro.codigo = dados.erro || 'ERRO_DESCONHECIDO';
        erro.status = resposta.status;
        throw erro;
    }
    return dados;
}

// CT3 autenticarUsuario: POST /api/auth/login
export function login(codigo, senha) {
    return requisitarJson('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo, senha }),
    });
}

async function requisitarAutenticado(caminho, opcoes = {}) {
    const sessao = lerSessao();
    if (!sessao?.token) {
        sair();
        const erro = new Error('TOKEN_AUSENTE');
        erro.codigo = 'TOKEN_AUSENTE';
        erro.status = 401;
        throw erro;
    }

    try {
        return await requisitarJson(caminho, {
            ...opcoes,
            headers: {
                ...opcoes.headers,
                Authorization: `Bearer ${sessao.token}`,
            },
        });
    } catch (erro) {
        if (erro.status === 401 && ['TOKEN_AUSENTE', 'TOKEN_INVALIDO'].includes(erro.codigo)) {
            sair();
        }
        throw erro;
    }
}

export function cadastrarUsuario(usuario) {
    return requisitarAutenticado('/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(usuario),
    });
}

export function cadastrarProduto(produto) {
    return requisitarAutenticado('/produtos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(produto),
    });
}

export function cadastrarMesa(mesa) {
    return requisitarAutenticado('/mesas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mesa),
    });
}

export function obterCardapio() {
    return requisitarAutenticado('/cardapio', { method: 'GET' });
}

export function obterIngredientes() {
    return requisitarAutenticado('/ingredientes', { method: 'GET' });
}

export function obterMapaMesas() {
    return requisitarAutenticado('/mesas/mapa', { method: 'GET' });
}

export function atualizarStatusItemPedido(pedidoId, itemId, novoStatus) {
    return requisitarAutenticado(
        `/pedidos/${encodeURIComponent(pedidoId)}/itens/${encodeURIComponent(itemId)}/status`,
        {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ novoStatus }),
        },
    );
}

export function processarPagamento(mesaId, { pagamentos, desconto } = {}) {
    const corpo = { pagamentos };
    if (desconto !== undefined) corpo.desconto = desconto;

    return requisitarAutenticado(`/mesas/${encodeURIComponent(mesaId)}/pagamento/processar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
    });
}
