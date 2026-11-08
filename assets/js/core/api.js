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

export function listarPedidos({ mesaId } = {}) {
    const parametros = new URLSearchParams();
    if (mesaId !== undefined && mesaId !== null) {
        parametros.set('mesaId', mesaId);
    }
    const query = parametros.size ? `?${parametros}` : '';
    return requisitarAutenticado(`/pedidos${query}`, { method: 'GET' });
}

export function iniciarPagamento(mesaId) {
    return requisitarAutenticado(
        `/mesas/${encodeURIComponent(mesaId)}/pagamento/iniciar`,
        { method: 'POST' },
    );
}

export function cancelarPagamento(mesaId) {
    return requisitarAutenticado(
        `/mesas/${encodeURIComponent(mesaId)}/pagamento/cancelar`,
        { method: 'POST' },
    );
}

const MENSAGENS_ERRO_TRANSFERENCIA = {
    MESA_DESTINO_OCUPADA: 'A mesa de destino não está disponível. Escolha outra mesa.',
    MESA_EM_PAGAMENTO: 'Não é possível transferir o pedido porque a mesa está em pagamento.',
    PEDIDO_NAO_EM_ABERTO: 'Somente pedidos em aberto podem ser transferidos.',
    MESA_NAO_ENCONTRADA: 'A mesa de destino não foi encontrada. Atualize a lista e tente novamente.',
};

export function transferirPedidoParaMesa(pedidoId, mesaDestinoId) {
    return requisitarAutenticado(
        `/pedidos/${encodeURIComponent(pedidoId)}/transferir-mesa`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mesaDestinoId }),
        },
    ).catch((erro) => {
        if (MENSAGENS_ERRO_TRANSFERENCIA[erro.codigo]) {
            erro.message = MENSAGENS_ERRO_TRANSFERENCIA[erro.codigo];
        }
        throw erro;
    });
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

export async function baixarComprovantePedido(pedidoId) {
    if (pedidoId === undefined || pedidoId === null || pedidoId === '') {
        throw new TypeError('Informe um pedido pago para baixar o comprovante.');
    }

    const sessao = lerSessao();
    if (!sessao?.token) {
        sair();
        const erro = new Error('TOKEN_AUSENTE');
        erro.codigo = 'TOKEN_AUSENTE';
        erro.status = 401;
        throw erro;
    }

    const resposta = await fetch(
        `${API_BASE}/pedidos/${encodeURIComponent(pedidoId)}/comprovante-pdf`,
        { method: 'GET', headers: { Authorization: `Bearer ${sessao.token}` } },
    );

    if (!resposta.ok) {
        const dados = await resposta.json().catch(() => ({}));
        const codigo = dados.erro || 'ERRO_DESCONHECIDO';
        const erro = new Error(codigo);
        erro.codigo = codigo;
        erro.status = resposta.status;
        if (erro.status === 401 && ['TOKEN_AUSENTE', 'TOKEN_INVALIDO'].includes(erro.codigo)) {
            sair();
        }
        throw erro;
    }

    const arquivo = resposta.blob
        ? await resposta.blob()
        : new Blob([await resposta.arrayBuffer()], { type: 'application/pdf' });
    const url = URL.createObjectURL(arquivo);
    const link = document.createElement('a');
    link.href = url;
    link.download = `comprovante-${pedidoId}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
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

function requisitarJsonAutenticado(caminho, metodo = 'GET', corpo) {
    const opcoes = { method: metodo };
    if (corpo !== undefined) {
        opcoes.headers = { 'Content-Type': 'application/json' };
        opcoes.body = JSON.stringify(corpo);
    }
    return requisitarAutenticado(caminho, opcoes);
}

function validarRespostaObjetoCaixa(dados) {
    if (!dados || typeof dados !== 'object' || Array.isArray(dados)) {
        const erro = new Error('O servidor retornou uma resposta inesperada para o caixa.');
        erro.codigo = 'RESPOSTA_CAIXA_INVALIDA';
        throw erro;
    }
    return dados;
}

export async function obterCaixaAberto() {
    return validarRespostaObjetoCaixa(await requisitarJsonAutenticado('/caixa/aberto'));
}

export async function abrirCaixa({ valorAbertura, turno }) {
    return validarRespostaObjetoCaixa(
        await requisitarJsonAutenticado('/caixa/abrir', 'POST', { valorAbertura, turno }),
    );
}

export function fecharCaixa({ valorFechamento }) {
    return requisitarJsonAutenticado('/caixa/fechar', 'POST', { valorFechamento });
}

export function obterHistoricoCaixa() {
    return requisitarJsonAutenticado('/caixa/historico');
}

export function listarMovimentacoesCaixa() {
    return requisitarJsonAutenticado('/caixa/movimentacoes');
}

export function criarMovimentacaoCaixa({ tipo, valor, motivo }) {
    return requisitarJsonAutenticado('/caixa/movimentacoes', 'POST', { tipo, valor, motivo });
}

export function obterRelatorioCaixa(data) {
    return requisitarJsonAutenticado(`/caixa/relatorios/${encodeURIComponent(data)}`);
}

export function obterConfiguracaoCaixa() {
    return requisitarJsonAutenticado('/caixa/configuracao');
}

export function atualizarConfiguracaoCaixa({
    nomeRestaurante,
    taxaServicoPercentual,
    imprimirComandaAoAceitar,
}) {
    return requisitarJsonAutenticado('/caixa/configuracao', 'PUT', {
        nomeRestaurante,
        taxaServicoPercentual,
        imprimirComandaAoAceitar,
    });
}

export function obterComanda(pedidoId) {
    return requisitarJsonAutenticado(`/pedidos/${encodeURIComponent(pedidoId)}/comanda`);
}

async function baixarPdfAutenticado(caminho, nomeArquivo) {
    const sessao = lerSessao();
    if (!sessao?.token) {
        sair();
        const erro = new Error('TOKEN_AUSENTE');
        erro.codigo = 'TOKEN_AUSENTE';
        erro.status = 401;
        throw erro;
    }

    const resposta = await fetch(`${API_BASE}${caminho}`, {
        method: 'GET',
        headers: { Authorization: 'Bearer ' + sessao.token },
    });
    if (!resposta.ok) {
        const dados = await resposta.json().catch(() => ({}));
        const erro = new Error(dados.erro || 'ERRO_DESCONHECIDO');
        erro.codigo = dados.erro || 'ERRO_DESCONHECIDO';
        erro.status = resposta.status;
        if (erro.status === 401 && ['TOKEN_AUSENTE', 'TOKEN_INVALIDO'].includes(erro.codigo)) {
            sair();
        }
        throw erro;
    }

    const arquivo = resposta.blob
        ? await resposta.blob()
        : new Blob([await resposta.arrayBuffer()], { type: 'application/pdf' });
    const url = URL.createObjectURL(arquivo);
    const link = document.createElement('a');
    link.href = url;
    link.download = nomeArquivo;
    link.target = '_blank';
    link.click();
    URL.revokeObjectURL(url);
}

export function baixarRelatorioCaixaPdf(data) {
    return baixarPdfAutenticado(
        `/caixa/relatorios/${encodeURIComponent(data)}/pdf`,
        `relatorio-caixa-${data}.pdf`,
    );
}

export function baixarComandaPdf(pedidoId) {
    return baixarPdfAutenticado(
        `/pedidos/${encodeURIComponent(pedidoId)}/comanda/pdf`,
        `comanda-${pedidoId}.pdf`,
    );
}
