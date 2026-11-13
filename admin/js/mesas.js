import { confirmar as confirmarAcao } from '../../assets/js/core/confirmar.js';
import { excluirMesa, listarMesas } from '../../assets/js/core/api.js';
import {
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
    ACESSO_NEGADO: 'Apenas um administrador pode gerenciar mesas.',
    TOKEN_AUSENTE: 'Sua sessão expirou. Entre novamente para continuar.',
    TOKEN_INVALIDO: 'Sua sessão expirou. Entre novamente para continuar.',
    MESA_NAO_ENCONTRADA: 'Mesa não encontrada. A lista foi atualizada.',
    MESA_EM_USO: 'Essa mesa está em uso agora. Só é possível excluir uma mesa livre.',
};

const SITUACAO = {
    disponivel: { texto: 'Livre', classe: 'text-bg-success' },
    ocupada: { texto: 'Ocupada', classe: 'text-bg-warning' },
    reservada: { texto: 'Reservada', classe: 'text-bg-info' },
    em_pagamento: { texto: 'Em pagamento', classe: 'text-bg-danger' },
};

export function infoSituacao(status) {
    return SITUACAO[status] ?? { texto: String(status ?? ''), classe: 'text-bg-light' };
}

export function podeExcluir(mesa) {
    return mesa.status === 'disponivel';
}

export function inicializarListaMesas({
    tabela = document.getElementById('corpo-mesas'),
    alerta = document.getElementById('lista-alerta'),
    listar = listarMesas,
    excluir = excluirMesa,
    confirmar = (mensagem) => confirmarAcao({ titulo: 'Excluir mesa?', mensagem, textoConfirmar: 'Excluir' }),
} = {}) {
    if (!tabela) return null;

    const excluirLinha = async (mesa) => {
        const confirmado = await confirmar(
            `A mesa ${mesa.numero} sai do mapa, mas os pedidos antigos continuam no histórico.`,
        );
        if (!confirmado) return;
        esconderAlerta(alerta);
        try {
            await excluir(mesa.id);
            mostrarAlerta(alerta, `Mesa ${mesa.numero} excluída.`, 'success');
        } catch (erro) {
            mostrarAlerta(alerta, MENSAGENS_ERRO[erro?.codigo] || 'Não foi possível excluir a mesa. Tente novamente.');
        }
        await carregar();
    };

    const criarLinha = (mesa) => {
        const tr = criarElemento('tr');
        const situacao = infoSituacao(mesa.status);
        const livre = podeExcluir(mesa);
        const acoes = celula([
            linkAcao('Editar', `/admin/mesa-form.html?id=${encodeURIComponent(mesa.id)}`),
            botaoAcao('Excluir', 'btn-outline-danger', () => excluirLinha(mesa), {
                desabilitado: !livre,
                titulo: livre ? undefined : 'Só é possível excluir uma mesa livre',
            }),
        ]);
        acoes.className = 'text-end d-flex gap-2 justify-content-end';
        tr.append(
            celula(`Mesa ${mesa.numero}`),
            celula(`${mesa.capacidade} ${mesa.capacidade === 1 ? 'pessoa' : 'pessoas'}`),
            celula(criarElemento('span', { texto: situacao.texto, classe: `badge ${situacao.classe}` })),
            acoes,
        );
        return tr;
    };

    async function carregar() {
        try {
            const mesas = await listar();
            if (!Array.isArray(mesas)) throw new Error('RESPOSTA_INVALIDA');
            tabela.replaceChildren(...(mesas.length
                ? mesas.map(criarLinha)
                : [linhaVazia(4, 'Nenhuma mesa cadastrada.')]));
        } catch (erro) {
            tabela.replaceChildren(linhaVazia(4, 'Não foi possível carregar as mesas.'));
            mostrarAlerta(alerta, MENSAGENS_ERRO[erro?.codigo] || 'Não foi possível carregar as mesas. Tente novamente.');
        }
    }

    return carregar();
}

if (typeof document !== 'undefined') {
    const tabela = document.getElementById('corpo-mesas');
    if (tabela && iniciarPagina('admin')) inicializarListaMesas({ tabela });
}
