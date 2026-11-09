// Guarda e lê os dados de quem fez login (token, perfil e código).
const CHAVE = 'restmanager.sessao';

// Tela inicial de cada perfil
const AREAS = {
    admin: '/admin/funcionarios.html',
    garcom: '/garcom/index.html',
    cozinha: '/cozinha/index.html',
    caixa: '/caixa/index.html',
};

export function areaInicial(perfil) {
    return AREAS[perfil];
}

export function areaInicialAposLogin(perfil) {
    if (String(perfil).toUpperCase() === 'CAIXA') return '/caixa/abertura.html?login=1';
    return areaInicial(perfil);
}

export function salvarSessao(resposta, codigo) {
    const sessao = {
        token: resposta.token,
        tipoToken: resposta.tipoToken,
        perfil: resposta.perfil,
        codigo: codigo,
        usuarioId: resposta.usuarioId,
    };
    localStorage.setItem(CHAVE, JSON.stringify(sessao));
}

export function lerSessao() {
    try {
        return JSON.parse(localStorage.getItem(CHAVE));
    } catch {
        return null;
    }
}

export function sair() {
    localStorage.removeItem(CHAVE);
    window.location.href = '/index.html';
}