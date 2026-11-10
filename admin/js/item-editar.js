import {
    atualizarProduto,
    listarIngredientesGerenciamento,
    listarProdutos,
    obterCardapio,
} from '../../assets/js/core/api.js';
import { iniciarPagina } from '../../assets/js/core/guard.js';

const MENSAGENS_ERRO = {
    ACESSO_NEGADO: 'Apenas um administrador pode editar itens.',
    CATEGORIA_NAO_ENCONTRADA: 'A categoria selecionada não foi encontrada. Atualize a página e tente novamente.',
    INGREDIENTES_OBRIGATORIOS: 'Selecione pelo menos um ingrediente.',
    INGREDIENTE_DUPLICADO: 'Não selecione o mesmo ingrediente mais de uma vez.',
    INGREDIENTE_NAO_ENCONTRADO: 'Um dos ingredientes escolhidos não existe ou está inativo. Atualize a página e escolha de novo.',
    PRECO_INVALIDO: 'Informe um preço maior que zero.',
    PRODUTO_DUPLICADO: 'Já existe um item com esse nome.',
    PRODUTO_NAO_ENCONTRADO: 'Item não encontrado. Volte para a lista e tente de novo.',
    TOKEN_AUSENTE: 'Sua sessão expirou. Entre novamente para continuar.',
    TOKEN_INVALIDO: 'Sua sessão expirou. Entre novamente para continuar.',
};

function mostrarErro(campo, mensagem) {
    const input = document.getElementById(campo);
    const erro = document.getElementById(`${campo}-erro`);
    input.classList.add('is-invalid');
    input.setAttribute('aria-invalid', 'true');
    if (erro) erro.textContent = mensagem;
}

function limparErro(campo) {
    const input = document.getElementById(campo);
    input.classList.remove('is-invalid');
    input.removeAttribute('aria-invalid');
    const erro = document.getElementById(`${campo}-erro`);
    if (erro) erro.textContent = '';
}

function mostrarCategorias(categorias, seletor, categoriaAtual) {
    seletor.replaceChildren(new Option('Selecione uma categoria', ''));
    const ids = new Set();
    categorias.forEach((categoria) => {
        ids.add(categoria.categoriaId);
        seletor.add(new Option(categoria.nome, String(categoria.categoriaId)));
    });
    if (!ids.has(categoriaAtual)) {
        seletor.add(new Option(`Categoria atual (inativa, id ${categoriaAtual})`, String(categoriaAtual)));
    }
    seletor.value = String(categoriaAtual);
}

function mostrarIngredientes(ingredientes, seletor, vinculados) {
    seletor.replaceChildren();
    const exibidos = new Set();
    ingredientes.forEach((ingrediente) => {
        if (!Number.isSafeInteger(ingrediente.id) || ingrediente.id < 1 || !ingrediente.nome) {
            throw new Error('RESPOSTA_INVALIDA');
        }
        if (exibidos.has(ingrediente.id)) return;
        const vinculado = vinculados.has(ingrediente.id);
        if (!ingrediente.ativo && !vinculado) return;
        exibidos.add(ingrediente.id);
        seletor.add(new Option(
            ingrediente.ativo ? ingrediente.nome : `${ingrediente.nome} (inativo)`,
            String(ingrediente.id),
            false,
            vinculado,
        ));
    });
}

export function inicializarEdicaoItem({
                                          form = document.getElementById('form-produto'),
                                          alerta = document.getElementById('produto-alerta'),
                                          sucesso = document.getElementById('produto-sucesso'),
                                          botao = document.getElementById('btn-salvar-produto'),
                                          produtoId,
                                          listarItens = listarProdutos,
                                          obterCategorias = obterCardapio,
                                          listarTodosIngredientes = listarIngredientesGerenciamento,
                                          atualizar = atualizarProduto,
                                      } = {}) {
    if (!form) return null;

    const campos = {
        nome: form.elements.namedItem('nome'),
        descricao: form.elements.namedItem('descricao'),
        preco: form.elements.namedItem('preco'),
        categoriaId: form.elements.namedItem('categoriaId'),
        imagemUrl: form.elements.namedItem('imagemUrl'),
        ingredientes: form.elements.namedItem('ingredientes'),
        ativo: form.elements.namedItem('ativo'),
    };
    let enviando = false;
    let carregado = false;

    const mostrarAlertaErro = (mensagem) => {
        alerta.textContent = mensagem;
        alerta.classList.remove('d-none');
    };

    form.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        if (enviando || !carregado) return;

        alerta.textContent = '';
        alerta.classList.add('d-none');
        sucesso.textContent = '';
        sucesso.classList.add('d-none');
        ['nome', 'preco', 'categoriaId', 'ingredientes'].forEach(limparErro);

        let valido = true;
        if (!campos.nome.value.trim()) {
            mostrarErro('nome', 'Informe o nome do item.');
            valido = false;
        }
        const preco = Number(campos.preco.value);
        if (!campos.preco.value || !Number.isFinite(preco) || preco <= 0) {
            mostrarErro('preco', MENSAGENS_ERRO.PRECO_INVALIDO);
            valido = false;
        }
        if (!campos.categoriaId.value) {
            mostrarErro('categoriaId', 'Selecione uma categoria.');
            valido = false;
        }
        const ingredientes = Array.from(campos.ingredientes.selectedOptions, (opcao) => Number(opcao.value));
        if (!ingredientes.length) {
            mostrarErro('ingredientes', MENSAGENS_ERRO.INGREDIENTES_OBRIGATORIOS);
            valido = false;
        }
        if (!valido) return;

        const produto = {
            nome: campos.nome.value.trim(),
            preco,
            categoriaId: Number(campos.categoriaId.value),
            ingredientes,
            ativo: campos.ativo.checked,
        };
        if (campos.descricao.value.trim()) produto.descricao = campos.descricao.value.trim();
        if (campos.imagemUrl.value.trim()) produto.imagemUrl = campos.imagemUrl.value.trim();

        enviando = true;
        botao.disabled = true;
        botao.textContent = 'Salvando...';
        try {
            const dados = await atualizar(produtoId, produto);
            sucesso.textContent = `Item "${dados?.nome || produto.nome}" atualizado com sucesso.`;
            sucesso.classList.remove('d-none');
        } catch (erro) {
            const porCampo = {
                PRECO_INVALIDO: ['preco', MENSAGENS_ERRO.PRECO_INVALIDO],
                CATEGORIA_NAO_ENCONTRADA: ['categoriaId', MENSAGENS_ERRO.CATEGORIA_NAO_ENCONTRADA],
                INGREDIENTES_OBRIGATORIOS: ['ingredientes', MENSAGENS_ERRO.INGREDIENTES_OBRIGATORIOS],
                INGREDIENTE_DUPLICADO: ['ingredientes', MENSAGENS_ERRO.INGREDIENTE_DUPLICADO],
                INGREDIENTE_NAO_ENCONTRADO: ['ingredientes', MENSAGENS_ERRO.INGREDIENTE_NAO_ENCONTRADO],
                PRODUTO_DUPLICADO: ['nome', MENSAGENS_ERRO.PRODUTO_DUPLICADO],
            };
            if (porCampo[erro.codigo]) {
                mostrarErro(...porCampo[erro.codigo]);
            } else {
                mostrarAlertaErro(MENSAGENS_ERRO[erro.codigo]
                    || 'Não foi possível salvar as alterações. Tente novamente.');
            }
        } finally {
            enviando = false;
            botao.disabled = false;
            botao.textContent = 'Salvar alterações';
        }
    });

    return (async () => {
        try {
            const [produtos, categorias, ingredientes] = await Promise.all([
                listarItens(),
                obterCategorias(),
                listarTodosIngredientes(),
            ]);
            if (![produtos, categorias, ingredientes].every(Array.isArray)) {
                throw new Error('RESPOSTA_INVALIDA');
            }
            const produto = produtos.find((item) => String(item.id) === String(produtoId));
            if (!produto) {
                mostrarAlertaErro(MENSAGENS_ERRO.PRODUTO_NAO_ENCONTRADO);
                return;
            }
            mostrarCategorias(categorias, campos.categoriaId, produto.categoriaId);
            mostrarIngredientes(ingredientes, campos.ingredientes, new Set(produto.ingredientes));
            campos.nome.value = produto.nome ?? '';
            campos.descricao.value = produto.descricao ?? '';
            campos.preco.value = String(produto.preco ?? '');
            campos.imagemUrl.value = produto.imagemUrl ?? '';
            campos.ativo.checked = Boolean(produto.ativo);
            carregado = true;
            botao.disabled = false;
            form.classList.remove('d-none');
        } catch (erro) {
            mostrarAlertaErro(MENSAGENS_ERRO[erro.codigo]
                || 'Não foi possível carregar os dados do item.');
        }
    })();
}

if (typeof document !== 'undefined') {
    const form = document.getElementById('form-produto');
    if (form && iniciarPagina('admin')) {
        const id = new URLSearchParams(window.location.search).get('id');
        if (id) {
            inicializarEdicaoItem({ form, produtoId: id });
        } else {
            const alerta = document.getElementById('produto-alerta');
            alerta.textContent = 'Nenhum item selecionado. Volte para a lista de itens e clique em Editar.';
            alerta.classList.remove('d-none');
        }
    }
}
