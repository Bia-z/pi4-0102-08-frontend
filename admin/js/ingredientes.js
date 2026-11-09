import {
    atualizarIngrediente,
    desativarIngrediente,
    listarIngredientesGerenciamento,
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
import { iniciarPagina } from '../../assets/js/core/guard.js';

const MENSAGENS_ERRO = {
    ACESSO_NEGADO: 'Apenas um administrador pode gerenciar ingredientes.',
    TOKEN_AUSENTE: 'Sua sessão expirou. Entre novamente para continuar.',
    TOKEN_INVALIDO: 'Sua sessão expirou. Entre novamente para continuar.',
    INGREDIENTE_NAO_ENCONTRADO: 'Ingrediente não encontrado. A lista foi atualizada.',
    INGREDIENTE_DUPLICADO: 'Já existe um ingrediente com esse nome.',
};

export function inicializarListaIngredientes({
                                                 tabela = document.getElementById('corpo-ingredientes'),
                                                 alerta = document.getElementById('lista-alerta'),
                                                 listar = listarIngredientesGerenciamento,
                                                 atualizar = atualizarIngrediente,
                                                 desativar = desativarIngrediente,
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

    const desativarItem = (ingrediente) => {
        if (!confirmar(`Desativar "${ingrediente.nome}"? Ele deixa de ficar disponível para novos itens.`)) {
            return Promise.resolve();
        }
        return executar(
            () => desativar(ingrediente.id),
            'Não foi possível desativar o ingrediente. Tente novamente.',
        );
    };

    const reativarItem = (ingrediente) => executar(
        () => atualizar(ingrediente.id, { nome: ingrediente.nome, ativo: true }),
        'Não foi possível reativar o ingrediente. Tente novamente.',
    );

    const criarLinha = (ingrediente) => {
        const tr = criarElemento('tr');
        const acoes = [linkAcao('Editar', `/admin/ingrediente-form.html?id=${encodeURIComponent(ingrediente.id)}`)];
        acoes.push(ingrediente.ativo
            ? botaoAcao('Desativar', 'btn-outline-danger', () => desativarItem(ingrediente))
            : botaoAcao('Reativar', 'btn-outline-success', () => reativarItem(ingrediente)));
        const celulaAcoes = celula(acoes);
        celulaAcoes.className = 'text-end d-flex gap-2 justify-content-end';

        tr.append(
            celula(ingrediente.nome ?? ''),
            celula(badgeStatus(Boolean(ingrediente.ativo))),
            celulaAcoes,
        );
        return tr;
    };

    async function carregar() {
        try {
            const ingredientes = await listar();
            if (!Array.isArray(ingredientes)) throw new Error('RESPOSTA_INVALIDA');
            tabela.replaceChildren(...(ingredientes.length
                ? ingredientes.map(criarLinha)
                : [linhaVazia(3, 'Nenhum ingrediente cadastrado.')]));
        } catch (erro) {
            tabela.replaceChildren(linhaVazia(3, 'Não foi possível carregar os ingredientes.'));
            mostrarErro(erro, 'Não foi possível carregar os ingredientes. Tente novamente.');
        }
    }

    return carregar();
}

if (typeof document !== 'undefined') {
    const tabela = document.getElementById('corpo-ingredientes');
    if (tabela && iniciarPagina('admin')) inicializarListaIngredientes({ tabela });
}
