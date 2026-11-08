import {
    criarMovimentacaoCaixa,
    listarMovimentacoesCaixa,
} from '../../assets/js/core/api.js';
import {
    criarCelula,
    FORMATADOR_MOEDA,
    listaDe,
    mostrarErro,
    obterValor,
    validarValorPositivo,
} from './recursos.js';

export async function carregarMovimentacoes({
    documento = document,
    api = listarMovimentacoesCaixa,
} = {}) {
    const corpo = documento.getElementById('movimentacoes-caixa');
    const erro = documento.getElementById('erro-movimentacao');
    corpo.replaceChildren();
    const carregando = documento.createElement('tr');
    const celula = criarCelula(documento, 'Carregando movimentações...');
    celula.colSpan = 4;
    carregando.appendChild(celula);
    corpo.appendChild(carregando);
    try {
        const dados = await api();
        const movimentacoes = listaDe(dados, ['movimentacoes', 'itens']);
        corpo.replaceChildren();
        if (!movimentacoes.length) {
            const linha = documento.createElement('tr');
            const vazia = criarCelula(documento, 'Nenhuma movimentação registrada.');
            vazia.colSpan = 4;
            linha.appendChild(vazia);
            corpo.appendChild(linha);
            return;
        }
        for (const mov of movimentacoes) {
            const linha = documento.createElement('tr');
            linha.append(
                criarCelula(documento, obterValor(mov, ['data', 'criadoEm', 'dataHora'])),
                criarCelula(documento, obterValor(mov, ['tipo'])),
                criarCelula(documento, FORMATADOR_MOEDA.format(Number(obterValor(mov, ['valor'], 0)))),
                criarCelula(documento, obterValor(mov, ['motivo'])),
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