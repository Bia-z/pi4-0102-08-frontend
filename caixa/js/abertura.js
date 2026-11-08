import { abrirCaixa, obterCaixaAberto } from '../../assets/js/core/api.js';
import { mostrarErro, obterValor, validarValorPositivo } from './recursos.js';

export async function inicializarAbertura({
    documento = document,
    api = { abrirCaixa, obterCaixaAberto },
} = {}) {
    const form = documento.getElementById('form-abertura');
    const status = documento.getElementById('status-caixa');
    const erro = documento.getElementById('erro-caixa');
    const sucesso = documento.getElementById('sucesso-caixa');
    const campoValor = documento.getElementById('valor-abertura');
    const campoTurno = documento.getElementById('turno');
    const botao = documento.getElementById('abrir-turno');
    form.hidden = true;

    try {
        status.textContent = 'Consultando turno aberto...';
        const dados = await api.obterCaixaAberto();
        const caixa = dados.caixa ?? dados;
        status.textContent = `Turno aberto: ${obterValor(caixa, ['turno'])} · Valor de abertura: ${
            obterValor(caixa, ['valorAbertura'])}`;
        return;
    } catch (falha) {
        if (falha.codigo !== 'CAIXA_NAO_ABERTO' && falha.status !== 404) {
            mostrarErro(erro, falha);
            status.textContent = '';
            return;
        }
    }

    status.textContent = 'Nenhum turno aberto.';
    form.hidden = false;
    form.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        erro.hidden = true;
        sucesso.hidden = true;
        const valorAbertura = Number(campoValor.value);
        if (!validarValorPositivo(campoValor.value)) {
            mostrarErro(erro, { codigo: 'VALOR_INVALIDO' });
            return;
        }

        botao.disabled = true;
        try {
            await api.abrirCaixa({ valorAbertura, turno: campoTurno.value });
            sucesso.textContent = 'Turno aberto com sucesso.';
            sucesso.hidden = false;
            status.textContent = `Turno aberto: ${campoTurno.value} · Valor de abertura: ${campoValor.value}`;
            form.hidden = true;
        } catch (falha) {
            mostrarErro(erro, falha);
        } finally {
            botao.disabled = false;
        }
    });
}