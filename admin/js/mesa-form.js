import { cadastrarMesa } from '../../assets/js/core/api.js';
import { iniciarPagina } from '../../assets/js/core/guard.js';

const MENSAGENS_ERRO = {
    ACESSO_NEGADO: 'Apenas um administrador pode cadastrar mesas.',
    CAPACIDADE_INVALIDA: 'A capacidade deve ser um número inteiro maior ou igual a 1.',
    MESA_DUPLICADA: 'Já existe uma mesa com esse número.',
    TOKEN_AUSENTE: 'Sua sessão expirou. Entre novamente para continuar.',
    TOKEN_INVALIDO: 'Sua sessão expirou. Entre novamente para continuar.',
};

function marcarErro(campo, mensagem) {
    const input = document.getElementById(campo);
    input.classList.add('is-invalid');
    input.setAttribute('aria-invalid', 'true');
    document.getElementById(`${campo}-erro`).textContent = mensagem;
}

function limparErro(campo) {
    const input = document.getElementById(campo);
    input.classList.remove('is-invalid');
    input.removeAttribute('aria-invalid');
    document.getElementById(`${campo}-erro`).textContent = '';
}

function inteiroPositivo(valor) {
    if (!/^[1-9]\d*$/.test(valor)) return null;
    const numero = Number(valor);
    return Number.isSafeInteger(numero) ? numero : null;
}

export function inicializarCadastroMesa({
    form = document.getElementById('form-mesa'),
    alerta = document.getElementById('mesa-alerta'),
    sucesso = document.getElementById('mesa-sucesso'),
    botao = document.getElementById('btn-cadastrar-mesa'),
    cadastrar = cadastrarMesa,
} = {}) {
    if (!form) return;

    const numero = form.elements.namedItem('numero');
    const capacidade = form.elements.namedItem('capacidade');
    let enviando = false;

    form.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        if (enviando) return;

        alerta.textContent = '';
        alerta.classList.add('d-none');
        sucesso.textContent = '';
        sucesso.classList.add('d-none');
        limparErro('numero');
        limparErro('capacidade');

        const numeroMesa = inteiroPositivo(numero.value.trim());
        const capacidadeMesa = inteiroPositivo(capacidade.value.trim());
        let valido = true;

        if (numeroMesa === null) {
            marcarErro('numero', 'Informe um número inteiro maior ou igual a 1.');
            valido = false;
        }
        if (capacidadeMesa === null) {
            marcarErro('capacidade', 'Informe uma capacidade inteira maior ou igual a 1.');
            valido = false;
        }
        if (!valido) return;

        enviando = true;
        botao.disabled = true;
        botao.textContent = 'Cadastrando...';
        try {
            const mesa = await cadastrar({ numero: numeroMesa, capacidade: capacidadeMesa });
            form.reset();
            sucesso.textContent = `Mesa ${mesa.numero} cadastrada com capacidade para ${mesa.capacidade} pessoa(s).`;
            sucesso.classList.remove('d-none');
        } catch (erro) {
            if (erro.codigo === 'MESA_DUPLICADA') {
                marcarErro('numero', 'Já existe uma mesa com esse número.');
            } else if (erro.codigo === 'CAPACIDADE_INVALIDA') {
                marcarErro('capacidade', MENSAGENS_ERRO.CAPACIDADE_INVALIDA);
            } else {
                alerta.textContent = MENSAGENS_ERRO[erro.codigo]
                    || 'Não foi possível cadastrar a mesa. Tente novamente.';
                alerta.classList.remove('d-none');
            }
        } finally {
            enviando = false;
            botao.disabled = false;
            botao.textContent = 'Cadastrar mesa';
        }
    });
}

if (typeof document !== 'undefined') {
    const form = document.getElementById('form-mesa');
    if (form && iniciarPagina('admin')) {
        inicializarCadastroMesa({ form });
    }
}
