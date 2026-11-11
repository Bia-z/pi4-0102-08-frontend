import { FORMATADOR_MOEDA, formatarDataHora, obterValor } from './recursos.js';

const TIPOS_MOVIMENTACAO = { SANGRIA: 'Sangria', REFORCO: 'Reforço' };

function moeda(valor) {
    return FORMATADOR_MOEDA.format(Number(valor ?? 0));
}

export function linhasResumoTurno(resumo) {
    const caixa = resumo.caixa ?? {};
    const linhas = [
        ['Turno', obterValor(caixa, ['turno'])],
        ['Abertura', formatarDataHora(caixa.abertoEm)],
        ['Fechamento', formatarDataHora(caixa.fechadoEm)],
        ['Valor de abertura', moeda(caixa.valorAbertura)],
        ['Total recebido', moeda(resumo.totalRecebido)],
        ['Dinheiro', moeda(resumo.totalDinheiro)],
        ['Crédito', moeda(resumo.totalCredito)],
        ['Débito', moeda(resumo.totalDebito)],
        ['Pix', moeda(resumo.totalPix)],
        ['Vale-alimentação', moeda(resumo.totalVale)],
        ['Quantidade de pagamentos', String(resumo.quantidadePagamentos ?? 0)],
        ['Sangrias', moeda(resumo.totalSangrias)],
        ['Reforços', moeda(resumo.totalReforcos)],
    ];
    if (caixa.valorFechamento !== null && caixa.valorFechamento !== undefined) {
        linhas.push(
            ['Valor esperado', moeda(caixa.valorEsperado)],
            ['Valor contado', moeda(caixa.valorFechamento)],
            ['Diferença', moeda(Number(caixa.valorFechamento) - Number(caixa.valorEsperado ?? 0))],
        );
    }
    return linhas;
}

export function linhasMovimentacao(movimentacao) {
    return [
        ['Tipo', TIPOS_MOVIMENTACAO[movimentacao.tipo] ?? obterValor(movimentacao, ['tipo'])],
        ['Valor', moeda(movimentacao.valor)],
        ['Data e hora', formatarDataHora(obterValor(movimentacao, ['dataHora', 'data', 'criadoEm'], null))],
        ['Motivo', obterValor(movimentacao, ['motivo'])],
    ];
}

export function imprimirDocumento({
    titulo,
    linhas,
    documento = document,
    imprimir = () => globalThis.print(),
}) {
    const area = documento.getElementById('area-impressao');
    const cabecalho = documento.createElement('h1');
    cabecalho.className = 'h5 mb-3';
    cabecalho.textContent = titulo;
    const lista = documento.createElement('dl');
    lista.className = 'row mb-0';
    for (const [rotulo, valor] of linhas) {
        const termo = documento.createElement('dt');
        termo.className = 'col-7';
        termo.textContent = rotulo;
        const descricao = documento.createElement('dd');
        descricao.className = 'col-5 text-end';
        descricao.textContent = String(valor);
        lista.append(termo, descricao);
    }
    area.replaceChildren(cabecalho, lista);
    imprimir();
}
