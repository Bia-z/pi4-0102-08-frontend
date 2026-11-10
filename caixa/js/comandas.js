import { baixarComandaPdf, listarComandas, obterComanda } from '../../assets/js/core/api.js';
import { criarCelula, formatarDataHora, mostrarErro, obterValor } from './recursos.js';

function definir(elemento, objeto, chaves) {
    elemento.textContent = String(obterValor(objeto, chaves));
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
    raiz.append(titulo, detalhes, tabela);
    return raiz;
}

export function dataLocal(data = new Date()) {
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${data.getFullYear()}-${mes}-${dia}`;
}

export function inicializarComandas({
    documento = document,
    api = { obter: obterComanda, listar: listarComandas, baixarPdf: baixarComandaPdf },
    imprimir = () => globalThis.print(),
    hoje = dataLocal,
} = {}) {
    const form = documento.getElementById('form-comanda');
    const erro = documento.getElementById('erro-comanda');
    const pedido = documento.getElementById('pedido-id');
    const baixar = documento.getElementById('baixar-comanda');
    const botaoImprimir = documento.getElementById('imprimir-comanda');
    const campoData = documento.getElementById('data-comandas');
    const lista = documento.getElementById('lista-comandas');
    let pedidoCarregado;

    const exibir = (comanda) => {
        renderizarComanda(comanda, documento);
        pedidoCarregado = comanda.pedidoId;
        baixar.disabled = false;
        botaoImprimir.disabled = false;
    };

    const listar = async () => {
        erro.hidden = true;
        lista.replaceChildren();
        if (!campoData.value) return;
        try {
            const comandas = await api.listar(campoData.value);
            if (!comandas.length) {
                const linha = documento.createElement('tr');
                const vazia = criarCelula(documento, 'Nenhuma comanda nesta data.');
                vazia.colSpan = 5;
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
                linha.append(
                    criarCelula(documento, comanda.pedidoId),
                    criarCelula(documento, comanda.numeroMesa),
                    criarCelula(documento, comanda.nomeGarcom),
                    criarCelula(documento, formatarDataHora(comanda.criadaEm)),
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