import { lerSessao, areaInicial, sair } from './auth.js';
import { obterCaixaAberto } from './api.js';

// Chamado no começo de cada página de uma área.
// Sem login volta para a tela de entrada; com outro perfil volta para a área do próprio perfil.
// Atenção: isto é só conforto de navegação. Quem protege de verdade é o backend (H02.2).
export function exigirPerfil(perfilPermitido) {
    return exigirPerfis([perfilPermitido]);
}

export function exigirPerfis(perfisPermitidos) {
    const sessao = lerSessao();

    if (!sessao) {
        window.location.href = '/index.html';
        return null;
    }
    const perfil = String(sessao.perfil || '').toUpperCase();
    if (!perfisPermitidos.some((permitido) => String(permitido).toUpperCase() === perfil)) {
        window.location.href = areaInicial(String(sessao.perfil || '').toLowerCase()) || '/index.html';
        return null;
    }
    return sessao;
}

// Faz a checagem e liga o topo da página (código do usuário e botão Sair).
export function iniciarPagina(perfilPermitido) {
    return iniciarPaginaPerfis([perfilPermitido]);
}

export function iniciarPaginaPerfis(perfisPermitidos) {
    const sessao = exigirPerfis(perfisPermitidos);
    if (!sessao) return null;

    document.getElementById('usuario').textContent = sessao.codigo;
    document.getElementById('btn-sair').addEventListener('click', sair);
    document.getElementById('voltar-caixa')?.addEventListener('click', (evento) => {
        if (!document.referrer) return;
        const paginaAnterior = new URL(document.referrer);
        if (paginaAnterior.origin === window.location.origin
            && paginaAnterior.pathname.startsWith('/caixa/')) {
            evento.preventDefault();
            window.history.back();
        }
    });
    return sessao;
}

export async function iniciarPaginaCaixa() {
    const sessao = iniciarPaginaPerfis(['ADMIN', 'CAIXA']);
    if (!sessao) return null;
    if (String(sessao.perfil).toUpperCase() !== 'CAIXA') return sessao;

    const conteudo = document.querySelector?.('main');
    if (conteudo) conteudo.hidden = true;
    window.addEventListener?.('pageshow', async (evento) => {
        if (!evento.persisted || !conteudo) return;
        conteudo.hidden = true;
        try {
            await obterCaixaAberto();
            conteudo.hidden = false;
        } catch (erro) {
            if (erro.status !== 401) window.location.href = '/caixa/abertura.html';
        }
    });
    try {
        await obterCaixaAberto();
        if (conteudo) conteudo.hidden = false;
        return sessao;
    } catch (erro) {
        if (erro.codigo === 'CAIXA_NAO_ABERTO') {
            window.location.href = '/caixa/abertura.html';
            return null;
        }
        if (erro.status === 401) return null;
        window.location.href = '/caixa/abertura.html';
        return null;
    }
}