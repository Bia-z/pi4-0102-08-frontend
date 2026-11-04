import { API_BASE } from './config.js';

// CT3 autenticarUsuario: POST /api/auth/login
export async function login(codigo, senha) {
    const resposta = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo, senha }),
    });

    const dados = await resposta.json().catch(() => ({}));

    if (!resposta.ok) {
        // O backend devolve {"erro": "CREDENCIAIS_INVALIDAS"} ou {"erro": "USUARIO_INATIVO"}
        const erro = new Error(dados.erro || 'ERRO_DESCONHECIDO');
        erro.codigo = dados.erro || 'ERRO_DESCONHECIDO';
        erro.status = resposta.status;
        throw erro;
    }
    return dados;
}