import { lerSessao, areaInicial, sair } from './auth.js';

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
    return sessao;
}