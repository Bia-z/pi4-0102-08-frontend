import {
    atualizarUsuario,
    desativarUsuario,
    listarUsuarios,
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

const ROTULOS_PERFIL = {
    admin: 'Administrador',
    garcom: 'Garçom',
    cozinha: 'Cozinha',
    caixa: 'Caixa',
};
const MENSAGENS_ERRO = {
    ACESSO_NEGADO: 'Apenas um administrador pode gerenciar funcionários.',
    TOKEN_AUSENTE: 'Sua sessão expirou. Entre novamente para continuar.',
    TOKEN_INVALIDO: 'Sua sessão expirou. Entre novamente para continuar.',
    USUARIO_NAO_ENCONTRADO: 'Funcionário não encontrado. A lista foi atualizada.',
    ADMINISTRADOR_NAO_PODE_SE_DESATIVAR: 'Você não pode desativar a sua própria conta.',
    ULTIMO_ADMINISTRADOR_ATIVO: 'Não é possível desativar o último administrador ativo.',
    CPF_DUPLICADO: 'Este CPF já está cadastrado em outro funcionário.',
    CODIGO_DUPLICADO: 'Este código já está cadastrado em outro funcionário.',
    CPF_INVALIDO: 'O CPF deste funcionário é inválido. Abra Editar e corrija.',
    TELEFONE_INVALIDO: 'O telefone deste funcionário é inválido. Abra Editar e corrija.',
    EMAIL_INVALIDO: 'O e-mail deste funcionário é inválido. Abra Editar e corrija.',
    EMAIL_DUPLICADO: 'Este e-mail já está cadastrado em outro funcionário.',
};

export function inicializarListaFuncionarios({
                                                 tabela = document.getElementById('corpo-funcionarios'),
                                                 alerta = document.getElementById('lista-alerta'),
                                                 codigoLogado = '',
                                                 listar = listarUsuarios,
                                                 atualizar = atualizarUsuario,
                                                 desativar = desativarUsuario,
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

    const desativarFuncionario = (usuario) => {
        if (!confirmar(`Desativar ${usuario.nome}? Esse funcionário não conseguirá mais entrar no sistema.`)) {
            return Promise.resolve();
        }
        return executar(
            () => desativar(usuario.id),
            'Não foi possível desativar o funcionário. Tente novamente.',
        );
    };

    const reativarFuncionario = (usuario) => {
        // Funcionários antigos (ex.: criados pelo seed) podem não ter CPF e telefone, que o
        // backend exige para salvar. Nesse caso o admin completa os dados pela tela de edição.
        if (!usuario.cpf || !usuario.telefone) {
            mostrarAlerta(
                alerta,
                `${usuario.nome} não tem CPF e telefone cadastrados. Clique em Editar, complete os dados e marque "Funcionário ativo".`,
                'warning',
            );
            return Promise.resolve();
        }
        return reativarComDados(usuario);
    };

    const reativarComDados = (usuario) => executar(
        () => atualizar(usuario.id, {
            codigo: usuario.codigo,
            nome: usuario.nome,
            email: usuario.email ?? null,
            cpf: usuario.cpf,
            telefone: usuario.telefone,
            perfil: usuario.perfil,
            ativo: true,
        }),
        'Não foi possível reativar o funcionário. Tente novamente.',
    );

    const criarLinha = (usuario) => {
        const tr = criarElemento('tr');
        const propria = usuario.codigo === codigoLogado;
        const acoes = [linkAcao('Editar', `/admin/funcionario-form.html?id=${encodeURIComponent(usuario.id)}`)];
        if (usuario.ativo) {
            acoes.push(botaoAcao(
                'Desativar',
                'btn-outline-danger',
                () => desativarFuncionario(usuario),
                {
                    desabilitado: propria,
                    titulo: propria ? 'Você não pode desativar a sua própria conta' : undefined,
                },
            ));
        } else {
            acoes.push(botaoAcao('Reativar', 'btn-outline-success', () => reativarFuncionario(usuario)));
        }
        const celulaAcoes = celula(acoes, 'text-end');
        celulaAcoes.className = 'text-end d-flex gap-2 justify-content-end';

        tr.append(
            celula(usuario.codigo ?? ''),
            celula(usuario.nome ?? ''),
            celula(ROTULOS_PERFIL[usuario.perfil] || String(usuario.perfil ?? '')),
            celula(usuario.telefone ?? ''),
            celula(badgeStatus(Boolean(usuario.ativo))),
            celulaAcoes,
        );
        return tr;
    };

    async function carregar() {
        try {
            const usuarios = await listar();
            if (!Array.isArray(usuarios)) throw new Error('RESPOSTA_INVALIDA');
            tabela.replaceChildren(...(usuarios.length
                ? usuarios.map(criarLinha)
                : [linhaVazia(6, 'Nenhum funcionário cadastrado.')]));
        } catch (erro) {
            tabela.replaceChildren(linhaVazia(6, 'Não foi possível carregar os funcionários.'));
            mostrarErro(erro, 'Não foi possível carregar os funcionários. Tente novamente.');
        }
    }

    return carregar();
}

if (typeof document !== 'undefined') {
    const tabela = document.getElementById('corpo-funcionarios');
    const sessao = tabela ? iniciarPagina('admin') : null;
    if (sessao) inicializarListaFuncionarios({ tabela, codigoLogado: sessao.codigo });
}