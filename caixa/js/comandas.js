import { baixarComandaPdf, cancelarPedidoPago, listarComandas, obterComanda } from '../../assets/js/core/api.js';
import { solicitarAutorizacao } from '../../assets/js/core/autorizacao.js';
import { criarCelula, formatarDataHora, mensagemErroCaixa, mostrarErro, obterValor } from './recursos.js';

function definir(elemento, objeto, chaves) {
    elemento.textContent = String(obterValor(objeto, chaves));
}

export function descreverPagamento(statusPedido) {
    if (!statusPedido) return null;
    const status = String(statusPedido).toLowerCase();
    if (status === 'pago') {
        return { texto: 'Pago', aviso: 'Este pedido já foi pago.', classe: 'success' };
    }
    if (status === 'cancelado') {
        return { texto: 'Cancelado', aviso: 'Este pedido foi cancelado.', classe: 'secondary' };
    }
    return { texto: 'Não pago', aviso: 'Este pedido ainda não foi pago.', classe: 'warning' };
}

export function renderizarComanda(comanda, documento = document) {
    const raiz = documento.getElementById('visualizacao-comanda');
    const pedido = comanda.pedido ?? comanda;
    const mesa = pedido.mesa;
    const garcom = pedido.garcom;
    raiz.replaceChildren();
    const titulo = documento.createElement('h2');
    titulo.className = 'h4';
    titulo.textContent = `Comanda do pedido ${obterValor(pedido, ['pedidoId', 'id'])}`;
    const detalhes = documento.createElement('dl');
    detalhes.className = 'row';
    const campos = [
        ['Mesa', ['numeroMesa', 'mesaNumero', 'mesa']],
        ['Garçom', ['garcomNome', 'nomeGarcom', 'garcom']],
        ['Horário', ['criadaEm', 'horario', 'criadoEm', 'dataHora', 'data']],
    ];
    for (const [label, chaves] of campos) {
        const termo = documento.createElement('dt');
        termo.className = 'col-sm-3';
        termo.textContent = label;
        const valor = documento.createElement('dd');
        valor.className = 'col-sm-9';
        const padrao = label === 'Mesa'
            ? obterValor(mesa, ['numero', 'numeroMesa', 'id'])
            : label === 'Garçom'
                ? obterValor(garcom, ['nome', 'nomeCompleto', 'codigo'])
                : '-';
        definir(valor, pedido, chaves);
        if (label === 'Horário') valor.textContent = formatarDataHora(obterValor(pedido, chaves, null));
        if (valor.textContent === '-' || valor.textContent === '[object Object]') {
            valor.textContent = String(padrao);
        }
        detalhes.append(termo, valor);
    }

    const tabela = documento.createElement('table');
    tabela.className = 'table';
    const cabecalho = documento.createElement('thead');
    const linhaTitulo = documento.createElement('tr');
    for (const label of ['Item', 'Quantidade', 'Observação', 'Status']) {
        const celula = documento.createElement('th');
        celula.textContent = label;
        linhaTitulo.appendChild(celula);
    }
    cabecalho.appendChild(linhaTitulo);
    const corpo = documento.createElement('tbody');
    for (const item of pedido.itens ?? pedido.items ?? []) {
        const linha = documento.createElement('tr');
        for (const valor of [
            obterValor(item, ['produtoNome', 'nome', 'item']),
            obterValor(item, ['quantidade']),
            obterValor(item, ['observacao', 'observações', 'observacaoItem'], ''),
            obterValor(item, ['status']),
        ]) {
            const celula = documento.createElement('td');
            celula.textContent = String(valor);
            linha.appendChild(celula);
        }
        corpo.appendChild(linha);
    }
    tabela.append(cabecalho, corpo);
    const pagamento = descreverPagamento(obterValor(pedido, ['statusPedido'], null));
    if (pagamento) {
        const aviso = documento.createElement('div');
        aviso.className = `alert alert-${pagamento.classe} mb-3`;
        aviso.setAttribute?.('role', 'status');
        aviso.textContent = pagamento.aviso;
        raiz.append(titulo, aviso, detalhes, tabela);
    } else {
        raiz.append(titulo, detalhes, tabela);
    }
    return raiz;
}

export function dataLocal(data = new Date()) {
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${data.getFullYear()}-${mes}-${dia}`;
}

export function inicializarComandas({
                                        documento = document,
                                        api = {
                                            obter: obterComanda,
                                            listar: listarComandas,
                                            baixarPdf: baixarComandaPdf,
                                            cancelar: cancelarPedidoPago,
                                        },
                                        autorizar = solicitarAutorizacao,
                                        imprimir = () => globalThis.print(),
                                        hoje = dataLocal,
                                    } = {}) {
    const form = documento.getElementById('form-comanda');
    const erro = documento.getElementById('erro-comanda');
    const sucesso = documento.getElementById('sucesso-comanda');
    const pedido = documento.getElementById('pedido-id');
    const baixar = documento.getElementById('baixar-comanda');
    const botaoImprimir = documento.getElementById('imprimir-comanda');
    const campoData = documento.getElementById('data-comandas');
    const lista = documento.getElementById('lista-comandas');
    let pedidoCarregado;

    const limparSucesso = () => {
        if (sucesso) sucesso.hidden = true;
    };

    const exibir = (comanda) => {
        renderizarComanda(comanda, documento);
        pedidoCarregado = comanda.pedidoId;
        baixar.disabled = false;
        botaoImprimir.disabled = false;
    };

    const cancelarPedido = async (comanda) => {
        erro.hidden = true;
        limparSucesso();
        const cancelado = await autorizar({
            titulo: 'Cancelar pedido pago',
            mensagem: `O pedido ${comanda.pedidoId} (mesa ${comanda.numeroMesa}) já foi pago. `
                + 'Para cancelá-lo, informe o código e a senha de um administrador.',
            textoConfirmar: 'Cancelar pedido',
            aoConfirmar: (credenciais) => api.cancelar(comanda.pedidoId, credenciais),
            mensagemErro: mensagemErroCaixa,
        }, documento);
        if (!cancelado) return;
        await listar();
        if (pedidoCarregado === comanda.pedidoId) await consultar(comanda.pedidoId);
        if (sucesso) {
            sucesso.textContent = `Pedido ${comanda.pedidoId} cancelado.`;
            sucesso.hidden = false;
        }
    };

    const listar = async () => {
        erro.hidden = true;
        limparSucesso();
        lista.replaceChildren();
        if (!campoData.value) return;
        try {
            const comandas = await api.listar(campoData.value);
            if (!comandas.length) {
                const linha = documento.createElement('tr');
                const vazia = criarCelula(documento, 'Nenhuma comanda nesta data.');
                vazia.colSpan = 6;
                linha.appendChild(vazia);
                lista.appendChild(linha);
                return;
            }
            for (const comanda of comandas) {
                const linha = documento.createElement('tr');
                const acoes = documento.createElement('td');
                const ver = documento.createElement('button');
                ver.type = 'button';
                ver.className = 'btn btn-outline-primary btn-sm';
                ver.textContent = 'Ver';
                ver.addEventListener('click', () => exibir(comanda));
                acoes.appendChild(ver);
                if (String(comanda.statusPedido ?? '').toLowerCase() === 'pago') {
                    const cancelar = documento.createElement('button');
                    cancelar.type = 'button';
                    cancelar.className = 'btn btn-outline-danger btn-sm ms-1';
                    cancelar.textContent = 'Cancelar pedido';
                    cancelar.addEventListener('click', () => cancelarPedido(comanda));
                    acoes.appendChild(cancelar);
                }
                const pagamento = descreverPagamento(comanda.statusPedido);
                const celulaPagamento = criarCelula(documento, pagamento ? '' : '-');
                if (pagamento) {
                    const selo = documento.createElement('span');
                    selo.className = `badge text-bg-${pagamento.classe}`;
                    selo.textContent = pagamento.texto;
                    celulaPagamento.appendChild(selo);
                }
                linha.append(
                    criarCelula(documento, comanda.pedidoId),
                    criarCelula(documento, comanda.numeroMesa),
                    criarCelula(documento, comanda.nomeGarcom),
                    criarCelula(documento, formatarDataHora(comanda.criadaEm)),
                    celulaPagamento,
                    acoes,
                );
                lista.appendChild(linha);
            }
        } catch (falha) {
            mostrarErro(erro, falha);
        }
    };

    const consultar = async (pedidoId) => {
        erro.hidden = true;
        limparSucesso();
        documento.getElementById('visualizacao-comanda').textContent = 'Carregando comanda...';
        baixar.disabled = true;
        botaoImprimir.disabled = true;
        try {
            const dados = await api.obter(pedidoId);
            exibir(dados.comanda ?? dados.pedido ?? dados);
        } catch (falha) {
            documento.getElementById('visualizacao-comanda').replaceChildren();
            mostrarErro(erro, falha);
        }
    };

    form.addEventListener('submit', (evento) => {
        evento.preventDefault();
        if (pedido.value.trim()) consultar(pedido.value.trim());
    });
    if (new URLSearchParams(globalThis.location.search).has('pedidoId')) {
        pedido.value = new URLSearchParams(globalThis.location.search).get('pedidoId');
        consultar(pedido.value);
    }
    campoData.addEventListener('change', listar);
    botaoImprimir.addEventListener('click', () => {
        if (pedidoCarregado) imprimir();
    });
    campoData.value = hoje();
    listar();
    baixar.addEventListener('click', async () => {
        if (!pedidoCarregado) return;
        baixar.disabled = true;
        try {
            await api.baixarPdf(pedidoCarregado);
        } catch (falha) {
            mostrarErro(erro, falha);
        } finally {
            baixar.disabled = false;
        }
    });
    return consultar;
}