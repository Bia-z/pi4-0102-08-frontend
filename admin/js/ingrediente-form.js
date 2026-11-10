import {
    atualizarIngrediente,
    cadastrarIngrediente,
    listarIngredientesGerenciamento,
} from '../../assets/js/core/api.js';
import { iniciarPagina } from '../../assets/js/core/guard.js';

const MENSAGENS_ERRO = {
    ACESSO_NEGADO: 'Apenas um administrador pode gerenciar ingredientes.',
    TOKEN_AUSENTE: 'Sua sessão expirou. Entre novamente para continuar.',
    TOKEN_INVALIDO: 'Sua sessão expirou. Entre novamente para continuar.',
    INGREDIENTE_NAO_ENCONTRADO: 'Ingrediente não encontrado. Volte para a lista e tente de novo.',
};

export function inicializarFormIngrediente({
                                               form = document.getElementById('form-ingrediente'),
                                               alerta = document.getElementById('ingrediente-alerta'),
                                               sucesso = document.getElementById('ingrediente-sucesso'),
                                               botao = document.getElementById('btn-salvar'),
                                               ingredienteId = null,
                                               cadastrar = cadastrarIngrediente,
                                               atualizar = atualizarIngrediente,
                                               listar = listarIngredientesGerenciamento,
                                           } = {}) {
    if (!form) return null;

    const edicao = ingredienteId !== null && ingredienteId !== undefined;
    const rotuloBotao = edicao ? 'Salvar alterações' : 'Cadastrar ingrediente';
    const nome = form.elements.namedItem('nome');
    const ativo = edicao ? form.elements.namedItem('ativo') : null;
    const erroNome = document.getElementById('nome-erro');
    let enviando = false;

    const mostrarAlertaErro = (mensagem) => {
        alerta.textContent = mensagem;
        alerta.classList.remove('d-none');
    };
    const marcarErroNome = (mensagem) => {
        nome.classList.add('is-invalid');
        nome.setAttribute('aria-invalid', 'true');
        if (erroNome) erroNome.textContent = mensagem;
    };
    const limparErroNome = () => {
        nome.classList.remove('is-invalid');
        nome.removeAttribute('aria-invalid');
        if (erroNome) erroNome.textContent = '';
    };

    form.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        if (enviando) return;

        alerta.textContent = '';
        alerta.classList.add('d-none');
        sucesso.textContent = '';
        sucesso.classList.add('d-none');
        limparErroNome();

        if (!nome.value.trim()) {
            marcarErroNome('Informe o nome do ingrediente.');
            return;
        }
        const dados = { nome: nome.value.trim() };
        if (edicao) dados.ativo = ativo.checked;

        enviando = true;
        botao.disabled = true;
        botao.textContent = 'Salvando...';
        try {
            const resposta = edicao ? await atualizar(ingredienteId, dados) : await cadastrar(dados);
            const nomeSalvo = resposta?.nome || dados.nome;
            if (edicao) {
                nome.value = nomeSalvo;
            } else {
                form.reset();
            }
            sucesso.textContent = edicao
                ? `Ingrediente "${nomeSalvo}" atualizado com sucesso.`
                : `Ingrediente "${nomeSalvo}" cadastrado com sucesso.`;
            sucesso.classList.remove('d-none');
        } catch (erro) {
            if (erro.codigo === 'INGREDIENTE_DUPLICADO') {
                marcarErroNome('Já existe um ingrediente com esse nome.');
            } else {
                mostrarAlertaErro(MENSAGENS_ERRO[erro.codigo]
                    || (edicao
                        ? 'Não foi possível salvar as alterações. Tente novamente.'
                        : 'Não foi possível cadastrar o ingrediente. Tente novamente.'));
            }
        } finally {
            enviando = false;
            botao.disabled = false;
            botao.textContent = rotuloBotao;
        }
    });

    if (!edicao) return null;

    return (async () => {
        botao.disabled = true;
        try {
            const lista = await listar();
            const ingrediente = Array.isArray(lista)
                ? lista.find((item) => String(item.id) === String(ingredienteId))
                : null;
            if (!ingrediente) {
                mostrarAlertaErro(MENSAGENS_ERRO.INGREDIENTE_NAO_ENCONTRADO);
                return;
            }
            nome.value = ingrediente.nome ?? '';
            ativo.checked = Boolean(ingrediente.ativo);
            botao.disabled = false;
        } catch (erro) {
            mostrarAlertaErro(MENSAGENS_ERRO[erro.codigo]
                || 'Não foi possível carregar o ingrediente.');
        }
    })();
}

if (typeof document !== 'undefined') {
    const form = document.getElementById('form-ingrediente');
    if (form && iniciarPagina('admin')) {
        const id = new URLSearchParams(window.location.search).get('id');
        if (id) {
            document.title = 'RestManager | Editar ingrediente';
            document.getElementById('titulo-pagina').textContent = 'Editar ingrediente';
            document.getElementById('btn-salvar').textContent = 'Salvar alterações';
            document.getElementById('grupo-ativo').classList.remove('d-none');
        }
        inicializarFormIngrediente({ form, ingredienteId: id });
    }
}
