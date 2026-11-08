import {
    baixarComprovantePedido,
    cancelarPagamento,
    iniciarPagamento,
    listarPedidos,
    obterMapaMesas,
    processarPagamento,
    transferirPedidoParaMesa,
} from '../../assets/js/core/api.js';
import {
    conectarAtualizacoesMesas,
    conectarAtualizacoesPedidos,
} from '../../assets/js/core/ws.js';

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
const ROTULOS_STATUS_ITEM = {
    aguardando: 'Aguardando cozinha',
    em_preparo: 'Em preparo',
    em_preparacao: 'Em preparo',
    preparando: 'Em preparo',
    pronto: 'Pronto',
    entregue: 'Entregue',
    cancelado: 'Cancelado',
};
const ROTULOS_STATUS_MESA = {
    disponivel: 'Disponível',
    ocupada: 'Ocupada',
    em_pagamento: 'Em pagamento',
    reservada: 'Reservada',
};
const MENSAGENS_ERRO = {
    VALOR_PAGAMENTO_INSUFICIENTE: 'A soma dos pagamentos é menor que o total da conta.',
    TROCO_REQUER_DINHEIRO: 'O troco só pode ser devolvido quando há pagamento em dinheiro.',
    DESCONTO_INVALIDO: 'O desconto não pode ser negativo nem maior que o subtotal com a taxa.',
    PAGAMENTO_INVALIDO: 'Confira as formas de pagamento e os valores informados.',
    MESA_SEM_PEDIDO_ABERTO: 'Não há pedidos em aberto para esta mesa.',
    MESA_JA_EM_PAGAMENTO: 'Esta mesa já está sendo fechada em outro caixa.',
    MESA_NAO_EM_PAGAMENTO: 'Este fechamento já não está ativo. Volte ao mapa para conferir o status atualizado da mesa.',
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
    api = {
        listarPedidos,
        obterMapaMesas,
        iniciarPagamento,
        processarPagamento,
        cancelarPagamento,
        transferirPedido: transferirPedidoParaMesa,
    },
    conectarSessao = conectarAtualizacoesMesas,
    conectarPedidos = conectarAtualizacoesPedidos,
    registrarPagehide = (callback) => globalThis.addEventListener('pagehide', callback, { once: true }),
    aoConcluir,
    aoCancelar,
    aoVoltar,
    navegar = (url) => globalThis.location.assign(url),
    registrarIntervalo = (callback, intervalo) => globalThis.setInterval(callback, intervalo),
    limparIntervalo = (intervalo) => globalThis.clearInterval(intervalo),
} = {}) {
    const elementos = {
        mesa: documento.getElementById('mesa-numero'),
        itens: documento.getElementById('itens-pedido'),
        statusPedidos: documento.getElementById('status-pedidos'),
        iniciar: documento.getElementById('iniciar-pagamento'),
        detalhesPagamento: documento.getElementById('detalhes-pagamento'),
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
    elementos.voltar.addEventListener('click', (evento) => {
        if (!aoVoltar) return;
        evento.preventDefault();
        aoVoltar();
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
    let clienteWebSocket;
    let clientePedidos;
    let intervaloAtualizacao;
    let carregandoPedidos = false;
    const linhasPagamento = [];

    const obterPedidosDaMesa = async () => {
        const [respostaPedidos, respostaMapa] = await Promise.all([
            api.listarPedidos({ mesaId }),
            api.obterMapaMesas(),
        ]);
        const pedidosDaMesa = Array.isArray(respostaPedidos)
            ? respostaPedidos
            : respostaPedidos.pedidos ?? respostaPedidos.conteudo ?? [];
        const mesa = (respostaMapa.mesas ?? []).find(
            (registro) => String(registro.mesaId) === String(mesaId),
        );
        if (!mesa) throw new Error('Não foi possível localizar a mesa selecionada.');
        const statusMesa = String(mesa.status ?? '').trim().toLocaleLowerCase('pt-BR');
        return {
            mesa,
            statusMesa,
            pedidos: pedidosDaMesa.filter((pedido) => {
                const statusPedido = String(pedido.status ?? '').trim().toLocaleLowerCase('pt-BR');
                return !['pago', 'cancelado'].includes(statusPedido);
            }),
            destinos: (respostaMapa.mesas ?? []).filter((registro) => (
                String(registro.mesaId) !== String(mesaId)
                && String(registro.status ?? '').trim().toLocaleLowerCase('pt-BR') === 'disponivel'
            )),
        };
    };

    const carregarPedidosDaMesa = async () => {
        if (carregandoPedidos) return;
        carregandoPedidos = true;
        elementos.statusPedidos.textContent = 'Carregando pedidos e itens...';
        elementos.iniciar.disabled = true;
        try {
            const dados = await obterPedidosDaMesa();
            elementos.erro.hidden = true;
            pedidos = dados.pedidos;
            elementos.mesa.textContent = `Mesa ${dados.mesa.numero ?? mesaId}`;
            elementos.itens.replaceChildren();
            if (!pedidos.length) {
                const vazio = documento.createElement('li');
                vazio.className = 'list-group-item text-secondary';
                vazio.textContent = 'Não há pedidos ou itens em aberto nesta mesa.';
                elementos.itens.appendChild(vazio);
            }
            for (const pedido of pedidos) {
                const grupo = documento.createElement('li');
                grupo.className = 'list-group-item';
                const titulo = documento.createElement('h3');
                titulo.className = 'h6';
                titulo.textContent = `Pedido ${pedido.pedidoId ?? pedido.id} · ${pedido.status || 'Em aberto'}`;
                grupo.appendChild(titulo);
                const listaItens = documento.createElement('ul');
                listaItens.className = 'list-unstyled mb-3';
                for (const item of pedido.itens ?? pedido.items ?? []) {
                    if (item.status?.toLowerCase() === 'cancelado') continue;
                    const linha = documento.createElement('li');
                    const subtotalItem = Math.round(Number(item.precoUnitario) * 100) * item.quantidade;
                    const statusItem = String(item.status || 'Não informado')
                        .toLowerCase()
                        .replaceAll(' ', '_');
                    linha.textContent = `${item.quantidade} x ${item.produtoNome ?? item.nome ?? 'Item'} — ${
                        FORMATO_MOEDA.format(subtotalItem / 100)} · Status: ${
                        ROTULOS_STATUS_ITEM[statusItem] ?? item.status ?? 'Não informado'}`;
                    if (item.observacao) linha.textContent += ` · ${item.observacao}`;
                    listaItens.appendChild(linha);
                }
                grupo.appendChild(listaItens);

                if (!pagamentoIniciado && dados.statusMesa === 'ocupada' && dados.destinos.length) {
                    const linhaTransferencia = documento.createElement('div');
                    linhaTransferencia.className = 'row g-2 align-items-end';
                    const colunaSelect = documento.createElement('div');
                    colunaSelect.className = 'col-12 col-md-8';
                    const rotulo = documento.createElement('label');
                    rotulo.className = 'form-label';
                    rotulo.textContent = 'Transferir pedido para';
                    const seletor = documento.createElement('select');
                    seletor.className = 'form-select';
                    seletor.setAttribute('aria-label', `Mesa de destino do pedido ${pedido.pedidoId ?? pedido.id}`);
                    const opcaoPadrao = documento.createElement('option');
                    opcaoPadrao.value = '';
                    opcaoPadrao.textContent = 'Selecione uma mesa disponível';
                    seletor.appendChild(opcaoPadrao);
                    for (const destino of dados.destinos) {
                        const opcao = documento.createElement('option');
                        opcao.value = destino.mesaId;
                        opcao.textContent = `Mesa ${destino.numero}`;
                        seletor.appendChild(opcao);
                    }
                    rotulo.appendChild(seletor);
                    colunaSelect.appendChild(rotulo);
                    const colunaBotao = documento.createElement('div');
                    colunaBotao.className = 'col-12 col-md-4';
                    const transferir = documento.createElement('button');
                    transferir.type = 'button';
                    transferir.className = 'btn btn-outline-primary w-100';
                    transferir.textContent = 'Transferir';
                    transferir.disabled = true;
                    seletor.addEventListener('change', () => { transferir.disabled = !seletor.value; });
                    transferir.addEventListener('click', async () => {
                        const destinoId = Number(seletor.value);
                        if (!Number.isInteger(destinoId) || destinoId <= 0) return;
                        transferir.disabled = true;
                        elementos.erro.hidden = true;
                        try {
                            await api.transferirPedido(pedido.pedidoId ?? pedido.id, destinoId);
                            await carregarPedidosDaMesa();
                        } catch (falha) {
                            mostrarErro(falha);
                            transferir.disabled = false;
                        }
                    });
                    colunaBotao.appendChild(transferir);
                    linhaTransferencia.append(colunaSelect, colunaBotao);
                    grupo.appendChild(linhaTransferencia);
                }
                elementos.itens.appendChild(grupo);
            }
            elementos.iniciar.disabled = pedidos.length === 0;
            const statusMesa = ROTULOS_STATUS_MESA[dados.statusMesa] ?? dados.mesa.status ?? 'Desconhecido';
            elementos.statusPedidos.textContent = pedidos.length === 0
                ? `Mesa ${statusMesa.toLocaleLowerCase('pt-BR')}; nenhum pedido em aberto.`
                : `Mesa ${statusMesa} · ${pedidos.length} pedido(s) em aberto.`;
        } catch (falha) {
            elementos.statusPedidos.textContent = '';
            mostrarErro(falha);
        } finally {
            carregandoPedidos = false;
        }
    };

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
        await carregarPedidosDaMesa();
        intervaloAtualizacao = registrarIntervalo(() => {
            if (!pagamentoIniciado) carregarPedidosDaMesa();
        }, 5000);
        registrarPagehide(() => limparIntervalo(intervaloAtualizacao));
        clientePedidos = await conectarPedidos({
            aoAtualizar: () => {
                if (!pagamentoIniciado) return carregarPedidosDaMesa();
            },
            aoErro: () => {
                if (!pagamentoIniciado) {
                    elementos.statusPedidos.textContent =
                        'WebSocket reconectando; atualizações automáticas continuam ativas.';
                }
            },
        });
        registrarPagehide(() => clientePedidos?.deactivate());
    } catch (falha) {
        elementos.statusPedidos.textContent =
            'WebSocket indisponível; atualizações automáticas continuam ativas.';
    }

    elementos.iniciar.addEventListener('click', async () => {
        if (pagamentoIniciado || elementos.iniciar.disabled) return;
        elementos.iniciar.disabled = true;
        elementos.erro.hidden = true;
        try {
            Promise.resolve()
                .then(() => conectarSessao({ aoAtualizar: () => {} }))
                .then((cliente) => {
                    clienteWebSocket = cliente;
                    registrarPagehide(() => clienteWebSocket?.deactivate());
                })
                .catch(() => {
                    if (!elementos.statusPedidos.textContent.startsWith('Mesa ')) {
                        elementos.statusPedidos.textContent =
                            'WebSocket indisponível; o pagamento continua pela conexão com o servidor.';
                    }
                });
            await api.iniciarPagamento(mesaId);
            pagamentoIniciado = true;
            const dados = await obterPedidosDaMesa();
            pedidos = dados.pedidos;
            if (pedidos.length === 0) {
                throw Object.assign(new Error('Não há pedidos em aberto para esta mesa.'), {
                    codigo: 'MESA_SEM_PEDIDO_ABERTO',
                });
            }
            const percentual = Number(pedidos[0].taxaServicoPercentual);
            if (!Number.isFinite(percentual) || percentual < 0) {
                throw new TypeError('Não foi possível obter o percentual da taxa de serviço.');
            }
            resumo = calcularResumoPagamento(pedidos, 0, percentual);
            elementos.taxaLabel.textContent = `Taxa de serviço (${percentual}%)`;
            atualizarResumo();
            elementos.detalhesPagamento.hidden = false;
            elementos.formulario.hidden = false;
            elementos.statusPedidos.textContent = 'Pagamento iniciado.';
        } catch (falha) {
            mostrarErro(falha);
            if (pagamentoIniciado) {
                try {
                    await api.cancelarPagamento(mesaId);
                    pagamentoIniciado = false;
                } catch (erroCancelamento) {
                    elementos.erro.textContent += ` Não foi possível liberar a mesa: ${
                        erroCancelamento.codigo || erroCancelamento.message}`;
                }
            }
            const erroInicio = elementos.erro.textContent;
            elementos.iniciar.disabled = false;
            await carregarPedidosDaMesa();
            elementos.erro.textContent = erroInicio;
            elementos.erro.hidden = false;
        }
    });

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
            aoConcluir?.(resposta);
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
            if (aoCancelar) aoCancelar();
            else navegar('/caixa/index.html');
        } catch (erro) {
            if (erro.codigo === 'MESA_NAO_EM_PAGAMENTO') {
                pagamentoIniciado = false;
                elementos.voltar.hidden = false;
                elementos.erro.textContent = mensagemErroPagamento(erro);
                elementos.erro.hidden = false;
                return;
            }
            mostrarErro(erro);
            elementos.cancelar.disabled = false;
        }
    });
}
