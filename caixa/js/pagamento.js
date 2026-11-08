import {
    baixarComprovantePedido,
    cancelarPagamento,
    iniciarPagamento,
    listarPedidos,
    processarPagamento,
} from '../../assets/js/core/api.js';

const TAXA_SERVICO_PERCENTUAL = 10;
const FORMAS_PAGAMENTO = [
    ['dinheiro', 'Dinheiro'],
    ['credito', 'Cartão de crédito'],
    ['debito', 'Cartão de débito'],
    ['pix', 'Pix'],
    ['vale', 'Vale-alimentação'],
];
const FORMATO_MOEDA = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
});
const MENSAGENS_ERRO = {
    VALOR_PAGAMENTO_INSUFICIENTE: 'A soma dos pagamentos é menor que o total da conta.',
    TROCO_REQUER_DINHEIRO: 'O troco só pode ser devolvido quando há pagamento em dinheiro.',
    DESCONTO_INVALIDO: 'O desconto não pode ser negativo nem maior que o subtotal com a taxa.',
    PAGAMENTO_INVALIDO: 'Confira as formas de pagamento e os valores informados.',
    MESA_SEM_PEDIDO_ABERTO: 'Não há pedidos em aberto para esta mesa.',
    MESA_JA_EM_PAGAMENTO: 'Esta mesa já está sendo fechada em outro caixa.',
    MESA_NAO_EM_PAGAMENTO: 'A mesa não está em pagamento. Atualize o mapa e tente novamente.',
};

export function mensagemErroPagamento(erro) {
    return MENSAGENS_ERRO[erro.codigo] || erro.message || erro.codigo;
}

export function configurarBotaoComprovante({ botao, mensagem }) {
    let pedidoId;
    botao.disabled = true;

    botao.addEventListener('click', async () => {
        if (!pedidoId || botao.disabled) return;

        botao.disabled = true;
        mensagem.textContent = '';
        try {
            await baixarComprovantePedido(pedidoId);
        } catch (erro) {
            mensagem.textContent = erro.codigo || erro.message;
        } finally {
            botao.disabled = false;
        }
    });

    return function habilitarAposPagamento(resposta) {
        const pedidosPagos = resposta?.pedidosPagos;
        pedidoId = Array.isArray(pedidosPagos) ? pedidosPagos[0] : undefined;
        botao.disabled = !pedidoId;
        mensagem.textContent = '';
    };
}

export function calcularResumoPagamento(pedidos, desconto = 0, percentual = TAXA_SERVICO_PERCENTUAL) {
    const subtotalCentavos = pedidos
        .flatMap((pedido) => pedido.itens ?? [])
        .filter((item) => item.status?.toLowerCase() !== 'cancelado')
        .reduce((soma, item) => {
            const preco = Number(item.precoUnitario);
            if (!Number.isFinite(preco) || !Number.isInteger(item.quantidade) || item.quantidade < 1) {
                throw new TypeError('Os pedidos não contêm preços e quantidades válidos.');
            }
            return soma + Math.round(preco * 100) * item.quantidade;
        }, 0);
    const descontoCentavos = Math.round(Number(desconto) * 100);
    if (!Number.isFinite(descontoCentavos) || descontoCentavos < 0) {
        throw new TypeError('Informe um desconto válido.');
    }
    const taxaCentavos = Math.round(subtotalCentavos * percentual / 100);
    return {
        subtotalCentavos,
        taxaCentavos,
        descontoCentavos,
        totalCentavos: subtotalCentavos + taxaCentavos - descontoCentavos,
    };
}

export function calcularSaldoPagamento(totalCentavos, pagamentos) {
    const recebidoCentavos = pagamentos.reduce((soma, pagamento) => soma + pagamento.centavos, 0);
    const naoDinheiroCentavos = pagamentos
        .filter((pagamento) => pagamento.formaPagamento !== 'dinheiro')
        .reduce((soma, pagamento) => soma + pagamento.centavos, 0);
    const dinheiroCentavos = recebidoCentavos - naoDinheiroCentavos;
    return {
        recebidoCentavos,
        faltaCentavos: Math.max(totalCentavos - recebidoCentavos, 0),
        trocoCentavos: naoDinheiroCentavos <= totalCentavos
            ? Math.max(dinheiroCentavos - (totalCentavos - naoDinheiroCentavos), 0)
            : 0,
    };
}

function criarLinhaPagamento(documento, aoRemover) {
    const linha = documento.createElement('div');
    linha.className = 'row g-2 align-items-end mb-2 linha-pagamento';

    const formaColuna = documento.createElement('div');
    formaColuna.className = 'col-12 col-md-5';
    const formaLabel = documento.createElement('label');
    formaLabel.className = 'form-label';
    formaLabel.textContent = 'Forma de pagamento';
    const forma = documento.createElement('select');
    forma.className = 'form-select forma-pagamento';
    for (const [valor, rotulo] of FORMAS_PAGAMENTO) {
        const opcao = documento.createElement('option');
        opcao.value = valor;
        opcao.textContent = rotulo;
        forma.appendChild(opcao);
    }
    formaLabel.appendChild(forma);
    formaColuna.appendChild(formaLabel);

    const valorColuna = documento.createElement('div');
    valorColuna.className = 'col-8 col-md-5';
    const valorLabel = documento.createElement('label');
    valorLabel.className = 'form-label';
    valorLabel.textContent = 'Valor';
    const valor = documento.createElement('input');
    valor.type = 'number';
    valor.min = '0.01';
    valor.step = '0.01';
    valor.inputMode = 'decimal';
    valor.className = 'form-control valor-pagamento';
    valor.placeholder = '0,00';
    valorLabel.appendChild(valor);
    valorColuna.appendChild(valorLabel);

    const removerColuna = documento.createElement('div');
    removerColuna.className = 'col-4 col-md-2';
    const remover = documento.createElement('button');
    remover.type = 'button';
    remover.className = 'btn btn-outline-danger w-100 remover-pagamento';
    remover.textContent = 'Remover';
    remover.addEventListener('click', aoRemover);
    removerColuna.appendChild(remover);

    linha.append(formaColuna, valorColuna, removerColuna);
    return { linha, forma, valor };
}

export async function inicializarPagamento({
    mesaId = new URLSearchParams(globalThis.location.search).get('mesaId'),
    documento = globalThis.document,
    api = { listarPedidos, iniciarPagamento, processarPagamento, cancelarPagamento },
} = {}) {
    const elementos = {
        mesa: documento.getElementById('mesa-numero'),
        itens: documento.getElementById('itens-pedido'),
        linhas: documento.getElementById('pagamentos'),
        formulario: documento.getElementById('form-pagamento'),
        desconto: documento.getElementById('desconto'),
        adicionar: documento.getElementById('adicionar-pagamento'),
        cancelar: documento.getElementById('cancelar-pagamento'),
        erro: documento.getElementById('erro-pagamento'),
        sucesso: documento.getElementById('sucesso-pagamento'),
        voltar: documento.getElementById('voltar-mapa'),
        comprovante: documento.getElementById('baixar-comprovante'),
        erroComprovante: documento.getElementById('erro-comprovante'),
        subtotal: documento.getElementById('subtotal'),
        taxaLabel: documento.getElementById('taxa-servico-label'),
        taxa: documento.getElementById('taxa-servico'),
        descontoResumo: documento.getElementById('desconto-resumo'),
        total: documento.getElementById('total'),
        recebido: documento.getElementById('total-recebido'),
        falta: documento.getElementById('valor-falta'),
        troco: documento.getElementById('valor-troco'),
        enviar: documento.getElementById('confirmar-pagamento'),
    };
    const habilitarComprovante = configurarBotaoComprovante({
        botao: elementos.comprovante,
        mensagem: elementos.erroComprovante,
    });

    const mostrarErro = (erro) => {
        elementos.erro.textContent = mensagemErroPagamento(erro);
        elementos.erro.hidden = false;
        elementos.sucesso.textContent = '';
        elementos.sucesso.hidden = true;
    };

    if (!mesaId) {
        mostrarErro({ message: 'Mesa não informada. Volte ao mapa e selecione uma mesa.' });
        elementos.voltar.hidden = false;
        return;
    }

    elementos.formulario.hidden = true;
    elementos.mesa.textContent = `Mesa ${mesaId}`;
    let resumo;
    let pedidos = [];
    let pagamentoIniciado = false;
    const linhasPagamento = [];

    const incluirLinha = () => {
        let registro;
        const linha = criarLinhaPagamento(documento, () => {
            if (linhasPagamento.length === 1) return;
            registro.linha.remove();
            linhasPagamento.splice(linhasPagamento.indexOf(registro), 1);
            atualizarResumo();
        });
        registro = linha;
        linhasPagamento.push(registro);
        elementos.linhas.appendChild(registro.linha);
        registro.valor.addEventListener('input', atualizarResumo);
        registro.forma.addEventListener('change', atualizarResumo);
        atualizarResumo();
    };

    const atualizarResumo = () => {
        if (!resumo) return;
        const descontoValor = elementos.desconto.value === '' ? 0 : Number(elementos.desconto.value);
        let descontoCentavos = Number.isFinite(descontoValor) ? Math.round(descontoValor * 100) : 0;
        const totalCentavos = resumo.subtotalCentavos + resumo.taxaCentavos - descontoCentavos;
        const pagamentos = linhasPagamento.map((linha) => {
            const valor = linha.valor.value === '' ? 0 : Number(linha.valor.value);
            return {
                formaPagamento: linha.forma.value,
                centavos: Number.isFinite(valor) && valor > 0 ? Math.round(valor * 100) : 0,
            };
        });
        const saldo = calcularSaldoPagamento(totalCentavos, pagamentos);
        elementos.subtotal.textContent = FORMATO_MOEDA.format(resumo.subtotalCentavos / 100);
        elementos.taxa.textContent = FORMATO_MOEDA.format(resumo.taxaCentavos / 100);
        elementos.descontoResumo.textContent = FORMATO_MOEDA.format(Math.max(descontoCentavos, 0) / 100);
        elementos.total.textContent = FORMATO_MOEDA.format(totalCentavos / 100);
        elementos.recebido.textContent = FORMATO_MOEDA.format(saldo.recebidoCentavos / 100);
        elementos.falta.textContent = FORMATO_MOEDA.format(saldo.faltaCentavos / 100);
        elementos.troco.textContent = FORMATO_MOEDA.format(saldo.trocoCentavos / 100);
    };

    elementos.adicionar.addEventListener('click', incluirLinha);
    elementos.desconto.addEventListener('input', atualizarResumo);
    incluirLinha();
    elementos.formulario.hidden = true;

    try {
        await api.iniciarPagamento(mesaId);
        pagamentoIniciado = true;
        const pedidosDaMesa = await api.listarPedidos({ mesaId });
        pedidos = pedidosDaMesa.filter((pedido) => String(pedido.mesaId) === String(mesaId)
            && !['pago', 'cancelado'].includes(pedido.status?.toLowerCase()));
        if (pedidos.length === 0) {
            throw Object.assign(new Error('Não há pedidos em aberto para esta mesa.'), {
                codigo: 'MESA_SEM_PEDIDO_ABERTO',
            });
        }

        for (const pedido of pedidos) {
            for (const item of pedido.itens ?? []) {
                if (item.status?.toLowerCase() === 'cancelado') continue;
                const itemLinha = documento.createElement('li');
                const subtotalItem = Math.round(Number(item.precoUnitario) * 100) * item.quantidade;
                itemLinha.textContent = `${item.quantidade} x ${item.produtoNome} — ${
                    FORMATO_MOEDA.format(subtotalItem / 100)}`;
                elementos.itens.appendChild(itemLinha);
            }
        }
        const percentual = Number(pedidos[0].taxaServicoPercentual);
        if (!Number.isFinite(percentual) || percentual < 0) {
            throw new TypeError('Não foi possível obter o percentual da taxa de serviço.');
        }
        resumo = calcularResumoPagamento(pedidos, 0, percentual);
        elementos.taxaLabel.textContent = `Taxa de serviço (${percentual}%)`;
        atualizarResumo();
        elementos.formulario.hidden = false;
    } catch (erro) {
        mostrarErro(erro);
        if (pagamentoIniciado) {
            try {
                await api.cancelarPagamento(mesaId);
                pagamentoIniciado = false;
                elementos.voltar.hidden = false;
            } catch (erroCancelamento) {
                elementos.erro.textContent += ` Não foi possível liberar a mesa: ${
                    erroCancelamento.codigo || erroCancelamento.message}`;
            }
        } else {
            elementos.voltar.hidden = false;
        }
        return;
    }

    elementos.formulario.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        if (elementos.enviar.disabled) return;
        elementos.erro.textContent = '';
        elementos.erro.hidden = true;
        const descontoValor = elementos.desconto.value === '' ? 0 : Number(elementos.desconto.value);
        if (!Number.isFinite(descontoValor) || descontoValor < 0
                || Math.round(descontoValor * 100) > resumo.subtotalCentavos + resumo.taxaCentavos) {
            mostrarErro({ codigo: 'DESCONTO_INVALIDO' });
            return;
        }
        const entradas = linhasPagamento
            .filter((linha) => linha.valor.value !== '')
            .map((linha) => ({
                formaPagamento: linha.forma.value,
                valor: Number(linha.valor.value),
            }));
        if (entradas.length === 0 || entradas.some((entrada) => !Number.isFinite(entrada.valor)
                || entrada.valor <= 0
                || Math.abs(entrada.valor * 100 - Math.round(entrada.valor * 100)) > 0.0000001)) {
            mostrarErro({ codigo: 'PAGAMENTO_INVALIDO' });
            return;
        }
        for (const entrada of entradas) {
            entrada.valor = Math.round(entrada.valor * 100) / 100;
        }

        elementos.enviar.disabled = true;
        let pagamentoConcluido = false;
        try {
            const resposta = await api.processarPagamento(mesaId, {
                pagamentos: entradas,
                desconto: descontoValor,
            });
            habilitarComprovante(resposta);
            elementos.sucesso.textContent = `Pagamento concluído. Total: ${
                FORMATO_MOEDA.format(resposta.total)}. Troco: ${
                FORMATO_MOEDA.format(resposta.troco)}.`;
            elementos.sucesso.hidden = false;
            elementos.erro.hidden = true;
            elementos.voltar.hidden = false;
            pagamentoConcluido = true;
            elementos.adicionar.disabled = true;
            elementos.desconto.disabled = true;
            for (const linha of linhasPagamento) {
                linha.forma.disabled = true;
                linha.valor.disabled = true;
            }
            elementos.cancelar.disabled = true;
        } catch (erro) {
            mostrarErro(erro);
        } finally {
            elementos.enviar.disabled = pagamentoConcluido;
        }
    });

    elementos.cancelar.addEventListener('click', async () => {
        elementos.cancelar.disabled = true;
        try {
            await api.cancelarPagamento(mesaId);
            pagamentoIniciado = false;
            globalThis.location.assign('/caixa/index.html');
        } catch (erro) {
            mostrarErro(erro);
            elementos.cancelar.disabled = false;
        }
    });
}
