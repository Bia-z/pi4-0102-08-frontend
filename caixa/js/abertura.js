import { abrirCaixa, obterCaixaAberto } from '../../assets/js/core/api.js';
import { mostrarErro, obterValor, validarValorPositivo } from './recursos.js';

export function converterValorAbertura(valor) {
    const texto = String(valor).trim();
    if (!/^\d+(?:[.,]\d{1,2})?$/.test(texto)) return null;
    const numero = Number(texto.replace(',', '.'));
    return Number.isFinite(numero) && numero >= 0 ? numero : null;
}

export async function inicializarAbertura({
    documento = document,
    api = { abrirCaixa, obterCaixaAberto },
    fluxoLogin = false,
    navegar = (url) => window.location.assign(url),
} = {}) {
    const form = documento.getElementById('form-abertura');
    const status = documento.getElementById('status-caixa');
    const erro = documento.getElementById('erro-caixa');
    const sucesso = documento.getElementById('sucesso-caixa');
    const campoValor = documento.getElementById('valor-abertura');
    const campoTurno = documento.getElementById('turno');
    const botao = documento.getElementById('abrir-turno');
    const tentarNovamente = documento.getElementById('tentar-novamente');
    const irParaCaixa = () => navegar('/caixa/index.html');
    form.hidden = true;

    const consultarTurno = async () => {
        erro.hidden = true;
        sucesso.hidden = true;
        tentarNovamente.hidden = true;
        status.textContent = 'Consultando turno aberto...';
        try {
            const dados = await api.obterCaixaAberto();
            const caixa = dados?.caixa ?? dados;
            status.textContent = `Turno aberto: ${obterValor(caixa, ['turno'])} · Valor de abertura: ${
                obterValor(caixa, ['valorAbertura'])}`;
            form.hidden = true;
            if (fluxoLogin) irParaCaixa();
            return true;
        } catch (falha) {
            if (falha.codigo === 'CAIXA_NAO_ABERTO') {
                status.textContent = 'Nenhum turno aberto. Abra o caixa para continuar.';
                form.hidden = false;
                return false;
            }
            mostrarErro(erro, falha);
            status.textContent = '';
            tentarNovamente.hidden = false;
            form.hidden = true;
            return null;
        }
    };

    tentarNovamente?.addEventListener('click', consultarTurno);

    form.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        erro.hidden = true;
        sucesso.hidden = true;
        const valorAbertura = converterValorAbertura(campoValor.value);
        if (valorAbertura === null || !validarValorPositivo(valorAbertura)) {
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
            if (fluxoLogin) irParaCaixa();
        } catch (falha) {
            if (falha.codigo === 'CAIXA_JA_ABERTO' && fluxoLogin) {
                const turnoAberto = await consultarTurno();
                if (turnoAberto === true || turnoAberto === null) return;
            }
            mostrarErro(erro, falha);
        } finally {
            botao.disabled = false;
        }
    });

    if (fluxoLogin) return consultarTurno();

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
}