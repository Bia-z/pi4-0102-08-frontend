import {
    criarMovimentacaoCaixa,
    listarMovimentacoesCaixa,
} from '../../assets/js/core/api.js';
import { imprimirDocumento, linhasMovimentacao, TIPOS_MOVIMENTACAO } from './impressao.js';
import {
    criarCelula,
    FORMATADOR_MOEDA,
    formatarDataHora,
    listaDe,
    mostrarErro,
    obterValor,
    validarValorPositivo,
} from './recursos.js';

export async function carregarMovimentacoes({
    documento = document,
    api = listarMovimentacoesCaixa,
    imprimir,
} = {}) {
    const corpo = documento.getElementById('movimentacoes-caixa');
    const erro = documento.getElementById('erro-movimentacao');
    corpo.replaceChildren();
    const carregando = documento.createElement('tr');
    const celula = criarCelula(documento, 'Carregando movimentações...');
    celula.colSpan = 5;
    carregando.appendChild(celula);
    corpo.appendChild(carregando);
    try {
        const dados = await api();
        const movimentacoes = listaDe(dados, ['movimentacoes', 'itens']);
        corpo.replaceChildren();
        if (!movimentacoes.length) {
            const linha = documento.createElement('tr');
            const vazia = criarCelula(documento, 'Nenhuma movimentação registrada.');
            vazia.colSpan = 5;
            linha.appendChild(vazia);
            corpo.appendChild(linha);
            return;
        }
        for (const mov of movimentacoes) {
            const linha = documento.createElement('tr');
            const acoes = documento.createElement('td');
            const botao = documento.createElement('button');
            botao.type = 'button';
            botao.className = 'btn btn-outline-primary btn-sm';
            botao.textContent = 'Imprimir';
            botao.addEventListener('click', () => imprimirDocumento({
                titulo: mov.tipo === 'REFORCO' ? 'Reforço de caixa' : 'Sangria de caixa',
                linhas: linhasMovimentacao(mov),
                documento,
                imprimir,
            }));
            acoes.appendChild(botao);
            linha.append(
                criarCelula(documento, formatarDataHora(obterValor(mov, ['dataHora', 'data', 'criadoEm'], null))),
                criarCelula(documento, TIPOS_MOVIMENTACAO[mov.tipo] ?? obterValor(mov, ['tipo'])),
                criarCelula(documento, FORMATADOR_MOEDA.format(Number(obterValor(mov, ['valor'], 0)))),
                criarCelula(documento, obterValor(mov, ['motivo'])),
                acoes,
            );
            corpo.appendChild(linha);
        }
    } catch (falha) {
        corpo.replaceChildren();
        mostrarErro(erro, falha);
    }
}

export function inicializarSangria({
    documento = document,
    api = { criar: criarMovimentacaoCaixa, listar: listarMovimentacoesCaixa },
} = {}) {
    const form = documento.getElementById('form-movimentacao');
    const erro = documento.getElementById('erro-movimentacao');
    const sucesso = documento.getElementById('sucesso-movimentacao');
    const botao = documento.getElementById('registrar-movimentacao');
    form.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        erro.hidden = true;
        sucesso.hidden = true;
        const valor = documento.getElementById('valor').value;
        const motivo = documento.getElementById('motivo').value.trim();
        if (!validarValorPositivo(valor) || Number(valor) === 0 || !motivo) {
            mostrarErro(erro, { codigo: 'MOVIMENTACAO_INVALIDA' });
            return;
        }
        botao.disabled = true;
        try {
            await api.criar({
                tipo: documento.getElementById('tipo').value,
                valor: Number(valor),
                motivo,
            });
            sucesso.textContent = 'Movimentação registrada.';
            sucesso.hidden = false;
            form.reset();
            await carregarMovimentacoes({ documento, api: api.listar });
        } catch (falha) {
            mostrarErro(erro, falha);
        } finally {
            botao.disabled = false;
        }
    });
    carregarMovimentacoes({ documento, api: api.listar });
}