import { lerSessao, areaInicial, sair } from './auth.js';

// Chamado no começo de cada página de uma área.
// Sem login volta para a tela de entrada; com outro perfil volta para a área do próprio perfil.
// Atenção: isto é só conforto de navegação. Quem protege de verdade é o backend (H02.2).
export function exigirPerfil(perfilPermitido) {
    const sessao = lerSessao();

    if (!sessao) {
        window.location.href = '/index.html';
        return null;
    }
    if (sessao.perfil !== perfilPermitido) {
        window.location.href = areaInicial(sessao.perfil) || '/index.html';
        return null;
    }
    return sessao;
}

// Faz a checagem e liga o topo da página (código do usuário e botão Sair).
export function iniciarPagina(perfilPermitido) {
    const sessao = exigirPerfil(perfilPermitido);
    if (!sessao) return null;

    document.getElementById('usuario').textContent = sessao.codigo;
    document.getElementById('btn-sair').addEventListener('click', sair);
    return sessao;
}