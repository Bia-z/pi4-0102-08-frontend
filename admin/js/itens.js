import {
    atualizarProduto,
    desativarProduto,
    listarProdutos,
    obterCardapio,
} from '../../assets/js/core/api.js';
import {
    badgeStatus,
    botaoAcao,
    celula,
    criarElemento,
    esconderAlerta,
    linhaVazia,
    linkAcao,
    mostrarAlerta,
} from '../../assets/js/core/admin-lista.js';
import { formatarMoeda } from '../../assets/js/core/format.js';
import { iniciarPagina } from '../../assets/js/core/guard.js';

const MENSAGENS_ERRO = {
    ACESSO_NEGADO: 'Apenas um administrador pode gerenciar itens.',
    TOKEN_AUSENTE: 'Sua sessão expirou. Entre novamente para continuar.',
    TOKEN_INVALIDO: 'Sua sessão expirou. Entre novamente para continuar.',
    PRODUTO_NAO_ENCONTRADO: 'Item não encontrado. A lista foi atualizada.',
    INGREDIENTE_NAO_ENCONTRADO: 'Não foi possível reativar: um ingrediente do item não existe mais. Edite o item e escolha os ingredientes.',
    CATEGORIA_NAO_ENCONTRADA: 'Não foi possível reativar: a categoria do item não foi encontrada. Edite o item.',
};

export function inicializarListaItens({
                                          tabela = document.getElementById('corpo-itens'),
                                          alerta = document.getElementById('lista-alerta'),
                                          listar = listarProdutos,
                                          obterCategorias = obterCardapio,
                                          atualizar = atualizarProduto,
                                          desativar = desativarProduto,
                                          confirmar = (mensagem) => window.confirm(mensagem),
                                      } = {}) {
    if (!tabela) return null;

    const mostrarErro = (erro, padrao) => {
        mostrarAlerta(alerta, MENSAGENS_ERRO[erro?.codigo] || padrao);
    };

    const executar = async (acao, padrao) => {
        esconderAlerta(alerta);
        try {
            await acao();
        } catch (erro) {
            mostrarErro(erro, padrao);
        }
        await carregar();
    };

    const desativarItem = (produto) => {
        if (!confirmar(`Desativar "${produto.nome}"? O item deixa de aparecer no cardápio.`)) {
            return Promise.resolve();
        }
        return executar(
            () => desativar(produto.id),
            'Não foi possível desativar o item. Tente novamente.',
        );
    };

    const reativarItem = (produto) => executar(
        () => atualizar(produto.id, {
            nome: produto.nome,
            descricao: produto.descricao ?? null,
            preco: produto.preco,
            categoriaId: produto.categoriaId,
            imagemUrl: produto.imagemUrl ?? null,
            ingredientes: produto.ingredientes,
            ativo: true,
        }),
        'Não foi possível reativar o item. Tente novamente.',
    );

    const criarLinha = (produto, nomesCategorias) => {
        const tr = criarElemento('tr');
        const acoes = [linkAcao('Editar', `/admin/item-editar.html?id=${encodeURIComponent(produto.id)}`)];
        acoes.push(produto.ativo
            ? botaoAcao('Desativar', 'btn-outline-danger', () => desativarItem(produto))
            : botaoAcao('Reativar', 'btn-outline-success', () => reativarItem(produto)));
        const celulaAcoes = celula(acoes);
        celulaAcoes.className = 'text-end d-flex gap-2 justify-content-end';

        tr.append(
            celula(produto.nome ?? ''),
            celula(nomesCategorias.get(produto.categoriaId) || '—'),
            celula(formatarMoeda(produto.preco)),
            celula(badgeStatus(Boolean(produto.ativo))),
            celulaAcoes,
        );
        return tr;
    };

    async function carregar() {
        try {
            const [produtos, categorias] = await Promise.all([
                listar(),
                Promise.resolve().then(() => obterCategorias()).catch(() => []),
            ]);
            if (!Array.isArray(produtos)) throw new Error('RESPOSTA_INVALIDA');
            const nomesCategorias = new Map(
                (Array.isArray(categorias) ? categorias : [])
                    .map((categoria) => [categoria.categoriaId, categoria.nome]),
            );
            tabela.replaceChildren(...(produtos.length
                ? produtos.map((produto) => criarLinha(produto, nomesCategorias))
                : [linhaVazia(5, 'Nenhum item cadastrado.')]));
        } catch (erro) {
            tabela.replaceChildren(linhaVazia(5, 'Não foi possível carregar os itens.'));
            mostrarErro(erro, 'Não foi possível carregar os itens. Tente novamente.');
        }
    }

    return carregar();
}

if (typeof document !== 'undefined') {
    const tabela = document.getElementById('corpo-itens');
    if (tabela && iniciarPagina('admin')) inicializarListaItens({ tabela });
}
