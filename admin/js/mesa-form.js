import { atualizarMesa, cadastrarMesa, listarMesas } from '../../assets/js/core/api.js';
import { iniciarPagina } from '../../assets/js/core/guard.js';

const MENSAGENS_ERRO = {
    ACESSO_NEGADO: 'Apenas um administrador pode cadastrar mesas.',
    CAPACIDADE_INVALIDA: 'A capacidade deve ser um número inteiro maior ou igual a 1.',
    MESA_DUPLICADA: 'Já existe uma mesa com esse número.',
    MESA_NAO_ENCONTRADA: 'Essa mesa não existe mais. Volte para a lista de mesas.',
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

function idDaUrl() {
    if (typeof window === 'undefined' || !window.location) return null;
    return new URLSearchParams(window.location.search).get('id');
}

export function inicializarCadastroMesa({
    form = document.getElementById('form-mesa'),
    alerta = document.getElementById('mesa-alerta'),
    sucesso = document.getElementById('mesa-sucesso'),
    botao = document.getElementById('btn-cadastrar-mesa'),
    cadastrar = cadastrarMesa,
    atualizar = atualizarMesa,
    listar = listarMesas,
    titulo = document.getElementById?.('titulo-mesa') ?? null,
    mesaId = idDaUrl(),
} = {}) {
    if (!form) return Promise.resolve();

    const numero = form.elements.namedItem('numero');
    const capacidade = form.elements.namedItem('capacidade');
    const editando = Boolean(mesaId);
    const textoBotao = editando ? 'Salvar alterações' : 'Cadastrar mesa';
    let enviando = false;

    // No modo edição, preenche o formulário com os dados atuais da mesa
    async function carregarMesa() {
        if (!editando) return;
        if (titulo) titulo.textContent = 'Editar mesa';
        botao.textContent = textoBotao;
        botao.disabled = true;
        try {
            const mesa = (await listar()).find((atual) => String(atual.id) === String(mesaId));
            if (!mesa) {
                const erro = new Error('MESA_NAO_ENCONTRADA');
                erro.codigo = 'MESA_NAO_ENCONTRADA';
                throw erro;
            }
            numero.value = String(mesa.numero);
            capacidade.value = String(mesa.capacidade);
            if (titulo) titulo.textContent = `Editar mesa ${mesa.numero}`;
            botao.disabled = false;
        } catch (erro) {
            alerta.textContent = MENSAGENS_ERRO[erro.codigo] || 'Não foi possível carregar a mesa. Tente novamente.';
            alerta.classList.remove('d-none');
        }
    }

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
        botao.textContent = editando ? 'Salvando...' : 'Cadastrando...';
        try {
            const dados = { numero: numeroMesa, capacidade: capacidadeMesa };
            if (editando) {
                const mesa = await atualizar(mesaId, dados);
                if (titulo) titulo.textContent = `Editar mesa ${mesa.numero}`;
                sucesso.textContent = `Mesa ${mesa.numero} atualizada com capacidade para ${mesa.capacidade} pessoa(s).`;
            } else {
                const mesa = await cadastrar(dados);
                form.reset();
                sucesso.textContent = `Mesa ${mesa.numero} cadastrada com capacidade para ${mesa.capacidade} pessoa(s).`;
            }
            sucesso.classList.remove('d-none');
        } catch (erro) {
            if (erro.codigo === 'MESA_DUPLICADA') {
                marcarErro('numero', 'Já existe uma mesa com esse número.');
            } else if (erro.codigo === 'CAPACIDADE_INVALIDA') {
                marcarErro('capacidade', MENSAGENS_ERRO.CAPACIDADE_INVALIDA);
            } else {
                alerta.textContent = MENSAGENS_ERRO[erro.codigo]
                    || `Não foi possível ${editando ? 'salvar' : 'cadastrar'} a mesa. Tente novamente.`;
                alerta.classList.remove('d-none');
            }
        } finally {
            enviando = false;
            botao.disabled = false;
            botao.textContent = textoBotao;
        }
    });

    return carregarMesa();
}

if (typeof document !== 'undefined') {
    const form = document.getElementById('form-mesa');
    if (form && iniciarPagina('admin')) {
        inicializarCadastroMesa({ form });
    }
}
