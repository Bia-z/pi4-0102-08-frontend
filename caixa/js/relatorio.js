import {
    baixarRelatorioCaixaPdf,
    obterRelatorioCaixa,
} from '../../assets/js/core/api.js';
import {
    criarCelula,
    exibirValor,
    FORMATADOR_MOEDA,
    listaDe,
    mostrarErro,
    obterValor,
} from './recursos.js';

const TOTAIS = [
    ['dinheiro', ['totalDinheiro', 'totalRecebidoDinheiro', 'valorDinheiro', 'dinheiro']],
    ['credito', ['totalCredito', 'totalRecebidoCredito', 'valorCredito', 'credito']],
    ['debito', ['totalDebito', 'totalRecebidoDebito', 'valorDebito', 'debito']],
    ['pix', ['totalPix', 'totalRecebidoPix', 'valorPix', 'pix']],
    ['vale', [
        'totalValeAlimentacao', 'totalRecebidoValeAlimentacao',
        'valorValeAlimentacao', 'valeAlimentacao', 'vale',
    ]],
];

export async function consultarRelatorio({
    data,
    documento = document,
    api = obterRelatorioCaixa,
} = {}) {
    const erro = documento.getElementById('erro-relatorio');
    const conteudo = documento.getElementById('resultado-relatorio');
    erro.hidden = true;
    conteudo.hidden = true;
    documento.getElementById('carregando-relatorio').hidden = false;
    try {
        const dados = await api(data);
        const relatorio = dados.relatorio ?? dados;
        const totais = relatorio.totaisPorFormaPagamento ?? relatorio.totais ?? relatorio;
        for (const [id, chaves] of TOTAIS) {
            const valor = obterValor(totais, chaves, 0);
            exibirValor(documento.getElementById(`total-${id}`), valor);
        }
        documento.getElementById('quantidade-pagamentos').textContent = String(obterValor(relatorio, [
            'quantidadePagamentos', 'quantidadeDePagamentos', 'totalPagamentos', 'numeroPagamentos',
        ], 0));
        const corpo = documento.getElementById('movimentacoes-relatorio');
        corpo.replaceChildren();
        const movimentacoes = listaDe(relatorio, ['movimentacoes', 'movimentacoesDia']);
        if (!movimentacoes.length) {
            const linha = documento.createElement('tr');
            const celula = criarCelula(documento, 'Nenhuma movimentação no dia.');
            celula.colSpan = 3;
            linha.appendChild(celula);
            corpo.appendChild(linha);
        } else {
            for (const mov of movimentacoes) {
                const linha = documento.createElement('tr');
                linha.append(
                    criarCelula(documento, obterValor(mov, ['tipo'])),
                    criarCelula(documento, obterValor(mov, ['motivo'])),
                    criarCelula(documento, FORMATADOR_MOEDA.format(Number(obterValor(mov, ['valor'], 0)))),
                );
                corpo.appendChild(linha);
            }
        }
        conteudo.hidden = false;
    } catch (falha) {
        mostrarErro(erro, falha);
    } finally {
        documento.getElementById('carregando-relatorio').hidden = true;
    }
}

export function inicializarRelatorio({
    documento = document,
    api = { consultar: obterRelatorioCaixa, baixarPdf: baixarRelatorioCaixaPdf },
} = {}) {
    const campoData = documento.getElementById('data-relatorio');
    campoData.value = new Date().toLocaleDateString('sv-SE');
    const form = documento.getElementById('form-relatorio');
    form.addEventListener('submit', (evento) => {
        evento.preventDefault();
        const data = campoData.value;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
            mostrarErro(documento.getElementById('erro-relatorio'), new Error('Informe uma data válida.'));
            return;
        }
        return consultarRelatorio({ data, documento, api: api.consultar });
    });
    documento.getElementById('baixar-relatorio').addEventListener('click', async () => {
        const botao = documento.getElementById('baixar-relatorio');
        const erro = documento.getElementById('erro-relatorio');
        botao.disabled = true;
        erro.hidden = true;
        try {
            await api.baixarPdf(campoData.value);
        } catch (falha) {
            mostrarErro(erro, falha);
        } finally {
            botao.disabled = false;
        }
    });
}