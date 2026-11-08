import {
    fecharCaixa,
    obterCaixaAberto,
    obterRelatorioCaixa,
} from '../../assets/js/core/api.js';
import {
    exibirValor,
    FORMATADOR_MOEDA,
    mostrarErro,
    obterValor,
    validarValorPositivo,
} from './recursos.js';
import { converterValorAbertura } from './abertura.js';

const TOTAIS_POR_FORMA = [
    ['dinheiro', ['totalDinheiro', 'totalRecebidoDinheiro', 'valorDinheiro', 'dinheiro']],
    ['credito', ['totalCredito', 'totalRecebidoCredito', 'valorCredito', 'credito']],
    ['debito', ['totalDebito', 'totalRecebidoDebito', 'valorDebito', 'debito']],
    ['pix', ['totalPix', 'totalRecebidoPix', 'valorPix', 'pix']],
    ['vale', [
        'totalValeAlimentacao', 'totalRecebidoValeAlimentacao',
        'valorValeAlimentacao', 'valeAlimentacao', 'vale',
    ]],
];

function dataLocalAtual() {
    const agora = new Date();
    const ano = agora.getFullYear();
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const dia = String(agora.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

function numeroRelatorio(valor) {
    if (typeof valor !== 'number' && typeof valor !== 'string') {
        throw new Error('A resposta do servidor não contém um valor válido para o fechamento.');
    }
    let texto = String(valor).trim().replace(/^(-?)R\$\s*/i, '$1').replace(/\s/g, '');
    if (!texto) {
        throw new Error('A resposta do servidor não contém um valor válido para o fechamento.');
    }
    const virgula = texto.lastIndexOf(',');
    const ponto = texto.lastIndexOf('.');
    if (virgula !== -1 && ponto !== -1) {
        const separadorDecimal = virgula > ponto ? ',' : '.';
        const separadorMilhar = separadorDecimal === ',' ? /\./g : /,/g;
        texto = texto.replace(separadorMilhar, '').replace(separadorDecimal, '.');
    } else if (virgula !== -1) {
        texto = texto.replace(/\./g, '').replace(',', '.');
    }
    const numero = Number(texto);
    if (!Number.isFinite(numero)) {
        throw new Error('A resposta do servidor não contém um valor válido para o fechamento.');
    }
    return numero;
}

function diferencaDoBackend(valor) {
    const diferenca = numeroRelatorio(valor);
    if (diferenca > 0) return { texto: 'Sobra', classe: 'text-success' };
    if (diferenca < 0) return { texto: 'Falta', classe: 'text-danger' };
    return { texto: 'Sem diferença', classe: 'text-secondary' };
}

export async function inicializarFechamento({
    documento = document,
    api = { fecharCaixa, obterCaixaAberto, obterRelatorioCaixa },
    dataAtual = dataLocalAtual,
    perfil,
    navegar = (url) => window.location.assign(url),
} = {}) {
    const form = documento.getElementById('form-fechamento');
    const erro = documento.getElementById('erro-caixa');
    const status = documento.getElementById('status-caixa');
    const botao = documento.getElementById('fechar-turno');
    const campoCodigo = documento.getElementById('codigo-usuario');
    const campoSenha = documento.getElementById('senha-autorizacao');
    const carregar = documento.getElementById('recarregar-fechamento');
    const resumo = documento.getElementById('resumo-vendas');
    const resultadoFechamento = documento.getElementById('resultado-fechamento');
    form.hidden = true;
    resumo.hidden = true;
    resultadoFechamento.hidden = true;
    carregar.hidden = true;

    const carregarResumo = async () => {
        erro.hidden = true;
        form.hidden = true;
        resumo.hidden = true;
        carregar.hidden = true;
        status.textContent = 'Consultando turno aberto e vendas de hoje...';
        try {
            const turnoDados = await api.obterCaixaAberto();
            const caixaAberto = turnoDados.caixa ?? turnoDados;
            const relatorioDados = await api.obterRelatorioCaixa(dataAtual());
            const relatorio = relatorioDados.relatorio ?? relatorioDados;
            const totais = relatorio.totaisPorFormaPagamento ?? relatorio.totais ?? relatorio;
            const valorAbertura = obterValor(caixaAberto, ['valorAbertura'], null);
            exibirValor(
                documento.getElementById('fechamento-valor-abertura'),
                valorAbertura === null ? 'Não informado' : numeroRelatorio(valorAbertura),
            );
            let somaFormas = 0;
            for (const [id, chaves] of TOTAIS_POR_FORMA) {
                const valor = numeroRelatorio(obterValor(totais, chaves, 0));
                somaFormas += valor;
                exibirValor(documento.getElementById(`fechamento-total-${id}`), valor);
            }
            const totalRecebido = obterValor(relatorio, [
                'totalRecebido', 'totalRecebidoNoDia', 'valorTotalRecebido', 'totalVendas',
            ], obterValor(totais, ['totalRecebido', 'valorTotalRecebido'], somaFormas));
            exibirValor(documento.getElementById('fechamento-total-recebido'), numeroRelatorio(totalRecebido));
            documento.getElementById('fechamento-quantidade-pagamentos').textContent = String(
                obterValor(relatorio, [
                    'quantidadePagamentos', 'quantidadeDePagamentos', 'totalPagamentos', 'numeroPagamentos',
                ], 0),
            );
            status.textContent = `Turno aberto: ${obterValor(caixaAberto, ['turno'])}`;
            resumo.hidden = false;
            form.hidden = false;
        } catch (falha) {
            mostrarErro(erro, falha);
            status.textContent = '';
            carregar.hidden = false;
        }
    };

    carregar.addEventListener('click', carregarResumo);
    form.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        erro.hidden = true;
        const valorTexto = documento.getElementById('valor-fechamento').value;
        const valorFechamento = converterValorAbertura(valorTexto);
        if (valorFechamento === null || !validarValorPositivo(valorFechamento)) {
            mostrarErro(erro, { codigo: 'VALOR_INVALIDO' });
            return;
        }
        const codigoUsuario = campoCodigo.value.trim();
        const senha = campoSenha.value;
        if (!codigoUsuario || !senha) {
            mostrarErro(erro, {
                message: 'Informe o código e a senha da pessoa que está autorizando o fechamento.',
            });
            return;
        }
        botao.disabled = true;
        try {
            const resultado = await api.fecharCaixa({ valorFechamento, codigoUsuario, senha });
            const caixa = resultado?.caixa ?? resultado ?? {};
            const esperadoRetornado = obterValor(caixa, [
                'valorEsperado', 'valorCalculado', 'valorAberturaEsperado',
                'valorEsperadoFechamento', 'valorTotalEsperado',
            ], null);
            const diferencaRetornada = obterValor(caixa, ['diferenca', 'valorDiferenca'], null);
            const diferenca = diferencaRetornada === null
                ? null
                : numeroRelatorio(diferencaRetornada);
            const esperado = esperadoRetornado === null
                ? (diferenca === null ? null : valorFechamento - diferenca)
                : numeroRelatorio(esperadoRetornado);
            const diferencaFinal = diferenca ?? (esperado === null ? null : valorFechamento - esperado);
            const infoDiferenca = diferencaFinal === null
                ? { texto: 'Não informado', classe: 'text-secondary' }
                : diferencaDoBackend(diferencaFinal);
            exibirValor(documento.getElementById('valor-esperado'), esperado ?? 'Não informado');
            exibirValor(documento.getElementById('valor-contado'), valorFechamento);
            const campoDiferenca = documento.getElementById('diferenca');
            exibirValor(campoDiferenca, diferencaFinal ?? 'Não informado');
            campoDiferenca.className = `col-5 text-end fw-bold ${infoDiferenca.classe}`;
            documento.getElementById('tipo-diferenca').textContent = infoDiferenca.texto;
            resultadoFechamento.hidden = false;
            form.hidden = true;
            resumo.hidden = true;
            status.textContent = 'Turno fechado.';
            if (String(perfil).toUpperCase() === 'CAIXA') navegar('/caixa/abertura.html');
        } catch (falha) {
            mostrarErro(erro, falha);
        } finally {
            campoSenha.value = '';
            botao.disabled = false;
        }
    });

    await carregarResumo();
}