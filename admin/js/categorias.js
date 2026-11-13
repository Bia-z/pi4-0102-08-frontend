import { confirmar as confirmarAcao } from '../../assets/js/core/confirmar.js';
import {
    atualizarCategoria,
    cadastrarCategoria,
    desativarCategoria,
    listarCategorias,
} from '../../assets/js/core/api.js';
import {
    badgeStatus,
    botaoAcao,
    celula,
    criarElemento,
    esconderAlerta,
    linhaVazia,
    mostrarAlerta,
} from '../../assets/js/core/admin-lista.js';
import { iniciarPagina } from '../../assets/js/core/guard.js';

const MENSAGENS_ERRO = {
    ACESSO_NEGADO: 'Apenas um administrador pode gerenciar categorias.',
    TOKEN_AUSENTE: 'Sua sessão expirou. Entre novamente para continuar.',
    TOKEN_INVALIDO: 'Sua sessão expirou. Entre novamente para continuar.',
    CATEGORIA_NAO_ENCONTRADA: 'Categoria não encontrada. A lista foi atualizada.',
    CATEGORIA_DUPLICADA: 'Já existe uma categoria com esse nome.',
    CATEGORIA_COM_ITENS: 'Essa categoria ainda tem itens ativos. Desative os itens ou mude-os de categoria antes.',
};

// Valida o formulário e devolve os dados prontos para a API, ou os erros por campo
export function validarCategoria({ nome, ordem }) {
    const erros = {};
    const nomeLimpo = String(nome ?? '').trim();
    const ordemTexto = String(ordem ?? '').trim();
    if (!nomeLimpo) erros.nome = 'Informe o nome da categoria.';
    else if (nomeLimpo.length > 80) erros.nome = 'Use no máximo 80 caracteres.';
    if (!/^\d+$/.test(ordemTexto)) erros.ordem = 'Informe um número inteiro a partir de 0.';
    if (Object.keys(erros).length) return { erros };
    return { dados: { nome: nomeLimpo, ordem: Number(ordemTexto) } };
}

export function proximaOrdem(categorias) {
    return categorias.reduce((maior, categoria) => Math.max(maior, categoria.ordem), 0) + 1;
}

export function inicializarCategorias({
    tabela = document.getElementById('corpo-categorias'),
    alerta = document.getElementById('lista-alerta'),
    form = document.getElementById('form-categoria'),
    titulo = document.getElementById('titulo-form'),
    botaoSalvar = document.getElementById('btn-salvar'),
    botaoCancelar = document.getElementById('btn-cancelar-edicao'),
    listar = listarCategorias,
    cadastrar = cadastrarCategoria,
    atualizar = atualizarCategoria,
    desativar = desativarCategoria,
    confirmar = (mensagem) => confirmarAcao({ titulo: 'Desativar categoria?', mensagem, textoConfirmar: 'Desativar' }),
} = {}) {
    if (!tabela) return null;

    const campoNome = form.elements.namedItem('nome');
    const campoOrdem = form.elements.namedItem('ordem');
    let categorias = [];
    let editando = null; // categoria em edição, ou null quando cadastrando
    let enviando = false;

    function marcarErro(campo, mensagem) {
        campo.classList.add('is-invalid');
        campo.setAttribute('aria-invalid', 'true');
        document.getElementById(`${campo.name}-erro`).textContent = mensagem;
    }

    function limparErros() {
        for (const campo of [campoNome, campoOrdem]) {
            campo.classList.remove('is-invalid');
            campo.removeAttribute('aria-invalid');
            document.getElementById(`${campo.name}-erro`).textContent = '';
        }
    }

    function modoCadastro() {
        editando = null;
        limparErros();
        campoNome.value = '';
        campoOrdem.value = String(proximaOrdem(categorias));
        titulo.textContent = 'Nova categoria';
        botaoSalvar.textContent = 'Cadastrar categoria';
        botaoCancelar.classList.add('d-none');
    }

    function modoEdicao(categoria) {
        editando = categoria;
        limparErros();
        campoNome.value = categoria.nome;
        campoOrdem.value = String(categoria.ordem);
        titulo.textContent = `Editar "${categoria.nome}"`;
        botaoSalvar.textContent = 'Salvar alterações';
        botaoCancelar.classList.remove('d-none');
        campoNome.focus?.();
    }

    const executar = async (acao, sucesso, padrao) => {
        esconderAlerta(alerta);
        try {
            await acao();
            if (sucesso) mostrarAlerta(alerta, sucesso, 'success');
        } catch (erro) {
            mostrarAlerta(alerta, MENSAGENS_ERRO[erro?.codigo] || padrao);
        }
        await carregar();
    };

    const desativarLinha = async (categoria) => {
        if (!(await confirmar(`"${categoria.nome}" deixa de aparecer no cardápio e no cadastro de itens. Dá para reativar depois.`))) {
            return;
        }
        if (editando?.id === categoria.id) modoCadastro();
        await executar(
            () => desativar(categoria.id),
            `Categoria "${categoria.nome}" desativada.`,
            'Não foi possível desativar a categoria. Tente novamente.',
        );
    };

    const reativarLinha = (categoria) => executar(
        () => atualizar(categoria.id, { nome: categoria.nome, ordem: categoria.ordem, ativo: true }),
        `Categoria "${categoria.nome}" reativada.`,
        'Não foi possível reativar a categoria. Tente novamente.',
    );

    const criarLinha = (categoria) => {
        const tr = criarElemento('tr');
        const temItens = categoria.itensAtivos > 0;
        const acoes = [botaoAcao('Editar', 'btn-outline-primary', () => modoEdicao(categoria))];
        acoes.push(categoria.ativo
            ? botaoAcao('Desativar', 'btn-outline-danger', () => desativarLinha(categoria), {
                desabilitado: temItens,
                titulo: temItens ? 'Tem itens ativos nesta categoria' : undefined,
            })
            : botaoAcao('Reativar', 'btn-outline-success', () => reativarLinha(categoria)));
        const celulaAcoes = celula(acoes);
        celulaAcoes.className = 'text-end d-flex gap-2 justify-content-end';
        tr.append(
            celula(String(categoria.ordem)),
            celula(categoria.nome),
            celula(`${categoria.itensAtivos} ${categoria.itensAtivos === 1 ? 'item' : 'itens'}`),
            celula(badgeStatus(Boolean(categoria.ativo))),
            celulaAcoes,
        );
        return tr;
    };

    async function carregar() {
        try {
            const dados = await listar();
            if (!Array.isArray(dados)) throw new Error('RESPOSTA_INVALIDA');
            categorias = dados;
            tabela.replaceChildren(...(categorias.length
                ? categorias.map(criarLinha)
                : [linhaVazia(5, 'Nenhuma categoria cadastrada.')]));
            if (!editando && !campoOrdem.value) campoOrdem.value = String(proximaOrdem(categorias));
        } catch (erro) {
            tabela.replaceChildren(linhaVazia(5, 'Não foi possível carregar as categorias.'));
            mostrarAlerta(alerta, MENSAGENS_ERRO[erro?.codigo] || 'Não foi possível carregar as categorias. Tente novamente.');
        }
    }

    form.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        if (enviando) return;
        limparErros();
        const { dados, erros } = validarCategoria({ nome: campoNome.value, ordem: campoOrdem.value });
        if (erros) {
            if (erros.nome) marcarErro(campoNome, erros.nome);
            if (erros.ordem) marcarErro(campoOrdem, erros.ordem);
            return;
        }

        enviando = true;
        botaoSalvar.disabled = true;
        esconderAlerta(alerta);
        try {
            if (editando) {
                await atualizar(editando.id, dados);
                mostrarAlerta(alerta, `Categoria "${dados.nome}" atualizada.`, 'success');
            } else {
                await cadastrar(dados);
                mostrarAlerta(alerta, `Categoria "${dados.nome}" cadastrada.`, 'success');
            }
            await carregar();
            modoCadastro();
        } catch (erro) {
            if (erro?.codigo === 'CATEGORIA_DUPLICADA') {
                marcarErro(campoNome, MENSAGENS_ERRO.CATEGORIA_DUPLICADA);
            } else {
                mostrarAlerta(alerta, MENSAGENS_ERRO[erro?.codigo] || 'Não foi possível salvar a categoria. Tente novamente.');
            }
        } finally {
            enviando = false;
            botaoSalvar.disabled = false;
        }
    });

    botaoCancelar.addEventListener('click', modoCadastro);

    return carregar();
}

if (typeof document !== 'undefined') {
    const tabela = document.getElementById('corpo-categorias');
    if (tabela && iniciarPagina('admin')) inicializarCategorias({ tabela });
}
