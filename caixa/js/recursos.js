import { mensagemDeErro } from '../../assets/js/core/ui.js';

export const MENSAGENS_CAIXA = {
    CAIXA_JA_ABERTO: 'Já existe um turno de caixa aberto.',
    CAIXA_NAO_ABERTO: 'Não há um turno de caixa aberto.',
    CREDENCIAIS_INVALIDAS: 'Código/senha incorretos ou o perfil informado não pode autorizar o fechamento.',
    VALOR_INVALIDO: 'Informe um valor válido, igual ou maior que zero.',
    MOVIMENTACAO_INVALIDA: 'Confira o tipo, o valor e o motivo da movimentação.',
    TAXA_SERVICO_INVALIDA: 'A taxa de serviço deve estar entre 0 e 100%.',
    MESAS_EM_ABERTO: 'Ainda há mesas ocupadas ou em pagamento. Feche todas as contas antes de fechar o turno.',
    CAIXA_NAO_ENCONTRADO: 'Turno de caixa não encontrado.',
};

export function mensagemErroCaixa(erro) {
    if (MENSAGENS_CAIXA[erro.codigo]) return MENSAGENS_CAIXA[erro.codigo];
    if (erro instanceof TypeError) return mensagemDeErro(erro);
    if (erro.message && erro.message !== erro.codigo) return erro.message;
    return erro.codigo
        ? `Não foi possível concluir a operação (${erro.codigo}). Tente novamente.`
        : 'Não foi possível concluir a operação. Tente novamente.';
}

export const FORMATADOR_MOEDA = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
});

export function mostrarErro(elemento, erro) {
    elemento.textContent = mensagemErroCaixa(erro);
    elemento.hidden = false;
}

export function listaDe(dados, chaves) {
    if (Array.isArray(dados)) return dados;
    for (const chave of chaves) {
        if (Array.isArray(dados?.[chave])) return dados[chave];
    }
    return [];
}

export function obterValor(objeto, chaves, padrao = '-') {
    for (const chave of chaves) {
        if (objeto?.[chave] !== undefined && objeto[chave] !== null) return objeto[chave];
    }
    return padrao;
}

export function formatarDataHora(valor) {
    if (valor === null || valor === undefined || valor === '') return '-';
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return String(valor);
    return data.toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
}

export function exibirValor(elemento, valor) {
    const numero = Number(valor);
    elemento.textContent = Number.isFinite(numero) ? FORMATADOR_MOEDA.format(numero) : String(valor ?? '-');
}

export function validarValorPositivo(valor) {
    const numero = Number(valor);
    return Number.isFinite(numero) && numero >= 0;
}

export function criarCelula(documento, texto, cabecalho = false) {
    const celula = documento.createElement(cabecalho ? 'th' : 'td');
    celula.textContent = String(texto ?? '-');
    return celula;
}
