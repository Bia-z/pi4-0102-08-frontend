import {
    cadastrarProduto,
    obterCardapio,
} from '../../assets/js/core/api.js';
import { iniciarPagina } from '../../assets/js/core/guard.js';

const MENSAGENS_ERRO = {
    ACESSO_NEGADO: 'Apenas um administrador pode cadastrar produtos.',
    CATEGORIA_NAO_ENCONTRADA: 'A categoria selecionada não foi encontrada. Atualize as categorias e tente novamente.',
    PRECO_INVALIDO: 'Informe um preço maior que zero.',
    PRODUTO_DUPLICADO: 'Já existe um produto com esse nome.',
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

function mostrarCategorias(categorias, seletor) {
    seletor.replaceChildren(new Option('Selecione uma categoria', ''));
    categorias.forEach((categoria) => {
        seletor.add(new Option(categoria.nome, String(categoria.categoriaId)));
    });
    seletor.disabled = categorias.length === 0;
}

export function inicializarCadastroProduto({
                                               form = document.getElementById('form-produto'),
                                               alerta = document.getElementById('produto-alerta'),
                                               sucesso = document.getElementById('produto-sucesso'),
                                               botao = document.getElementById('btn-cadastrar-produto'),
                                               obterCategorias = obterCardapio,
                                               cadastrar = cadastrarProduto,
                                           } = {}) {
    if (!form) return;

    const campos = {
        nome: form.elements.namedItem('nome'),
        descricao: form.elements.namedItem('descricao'),
        preco: form.elements.namedItem('preco'),
        categoriaId: form.elements.namedItem('categoriaId'),
        imagemUrl: form.elements.namedItem('imagemUrl'),
        ativo: form.elements.namedItem('ativo'),
    };
    let enviando = false;
    let categoriasDisponiveis = false;

    const carregarOpcoes = async () => {
        try {
            const categorias = await obterCategorias();
            if (!Array.isArray(categorias)) {
                throw new Error('RESPOSTA_INVALIDA');
            }
            mostrarCategorias(categorias, campos.categoriaId);
            categoriasDisponiveis = categorias.length > 0;
            botao.disabled = !categoriasDisponiveis;
            if (!categoriasDisponiveis) {
                alerta.textContent = 'Nenhuma categoria ativa foi encontrada no cardápio.';
                alerta.classList.remove('d-none');
            }
        } catch (erro) {
            alerta.textContent = MENSAGENS_ERRO[erro.codigo]
                || 'Não foi possível carregar as categorias.';
            alerta.classList.remove('d-none');
            campos.categoriaId.replaceChildren(new Option('Categorias indisponíveis', ''));
            campos.categoriaId.disabled = true;
            botao.disabled = true;
        } finally {
            form.classList.remove('d-none');
        }
    };

    form.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        if (enviando || !categoriasDisponiveis) return;

        alerta.textContent = '';
        alerta.classList.add('d-none');
        sucesso.textContent = '';
        sucesso.classList.add('d-none');
        ['nome', 'preco', 'categoriaId'].forEach(limparErro);

        let valido = true;
        if (!campos.nome.value.trim()) {
            mostrarErro('nome', 'Informe o nome do produto.');
            valido = false;
        }
        const preco = Number(campos.preco.value);
        if (!Number.isFinite(preco) || preco <= 0) {
            mostrarErro('preco', 'Informe um preço maior que zero.');
            valido = false;
        }
        if (!campos.categoriaId.value) {
            mostrarErro('categoriaId', 'Selecione uma categoria.');
            valido = false;
        }
        if (!valido) return;

        const produto = {
            nome: campos.nome.value.trim(),
            preco,
            categoriaId: Number(campos.categoriaId.value),
            ativo: campos.ativo.checked,
        };
        if (campos.descricao.value.trim()) produto.descricao = campos.descricao.value.trim();
        if (campos.imagemUrl.value.trim()) produto.imagemUrl = campos.imagemUrl.value.trim();

        enviando = true;
        botao.disabled = true;
        botao.textContent = 'Cadastrando...';
        try {
            const dados = await cadastrar(produto);
            form.reset();
            sucesso.textContent = dados?.nome
                ? `Produto "${dados.nome}" cadastrado com sucesso.`
                : 'Produto cadastrado com sucesso.';
            sucesso.classList.remove('d-none');
        } catch (erro) {
            const mensagensPorCampo = {
                PRECO_INVALIDO: ['preco', MENSAGENS_ERRO.PRECO_INVALIDO],
                CATEGORIA_NAO_ENCONTRADA: ['categoriaId', MENSAGENS_ERRO.CATEGORIA_NAO_ENCONTRADA],
            };
            const erroCampo = mensagensPorCampo[erro.codigo];
            if (erroCampo) {
                mostrarErro(...erroCampo);
            } else if (erro.codigo === 'PRODUTO_DUPLICADO') {
                alerta.textContent = MENSAGENS_ERRO.PRODUTO_DUPLICADO;
                alerta.classList.remove('d-none');
            } else {
                alerta.textContent = MENSAGENS_ERRO[erro.codigo]
                    || 'Não foi possível cadastrar o produto. Tente novamente.';
                alerta.classList.remove('d-none');
            }
        } finally {
            enviando = false;
            botao.disabled = !categoriasDisponiveis;
            botao.textContent = 'Cadastrar produto';
        }
    });

    carregarOpcoes();
}

if (typeof document !== 'undefined') {
    const form = document.getElementById('form-produto');
    if (form && iniciarPagina('admin')) {
        inicializarCadastroProduto({ form });
    }
}
