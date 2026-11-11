import { login } from './api.js';
import { salvarSessao, areaInicialAposLogin } from './auth.js';
import { mensagemDeErro } from './ui.js';

const form = document.getElementById('form-login');
const alerta = document.getElementById('alerta');
const botao = document.getElementById('btn-entrar');

form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    alerta.classList.add('d-none');

    const codigo = document.getElementById('codigo').value.trim();
    const senha = document.getElementById('senha').value;

    botao.disabled = true;
    botao.textContent = 'Entrando...';

    try {
        const resposta = await login(codigo, senha);
        const destino = areaInicialAposLogin(resposta.perfil);
        if (!destino) {
            throw new Error('PERFIL_DESCONHECIDO');
        }
        salvarSessao(resposta, codigo);
        window.location.href = destino;
    } catch (erro) {
        alerta.textContent = mensagemDeErro(erro);
        alerta.classList.remove('d-none');
        botao.disabled = false;
        botao.textContent = 'Entrar';
    }
});