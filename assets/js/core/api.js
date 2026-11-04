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

export async function cadastrarUsuario(usuario) {
    const sessao = lerSessao();
    if (!sessao?.token) {
        sair();
        const erro = new Error('TOKEN_AUSENTE');
        erro.codigo = 'TOKEN_AUSENTE';
        erro.status = 401;
        throw erro;
    }

    try {
        return await requisitarJson('/usuarios', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${sessao.token}`,
            },
            body: JSON.stringify(usuario),
        });
    } catch (erro) {
        if (erro.status === 401 && ['TOKEN_AUSENTE', 'TOKEN_INVALIDO'].includes(erro.codigo)) {
            sair();
        }
        throw erro;
    }
}