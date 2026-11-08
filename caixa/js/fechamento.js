import { fecharCaixa, obterCaixaAberto } from '../../assets/js/core/api.js';
import { exibirValor, mostrarErro, obterValor, validarValorPositivo } from './recursos.js';

export async function inicializarFechamento({
    documento = document,
    api = { fecharCaixa, obterCaixaAberto },
} = {}) {
    const form = documento.getElementById('form-fechamento');
    const erro = documento.getElementById('erro-caixa');
    const status = documento.getElementById('status-caixa');
    const botao = documento.getElementById('fechar-turno');
    form.hidden = true;
    try {
        status.textContent = 'Consultando turno aberto...';
        const dados = await api.obterCaixaAberto();
        const caixa = dados.caixa ?? dados;
        status.textContent = `Turno aberto: ${obterValor(caixa, ['turno'])}`;
        form.hidden = false;
    } catch (falha) {
        mostrarErro(erro, falha);
        status.textContent = '';
        return;
    }

    form.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        erro.hidden = true;
        const valorFechamento = documento.getElementById('valor-fechamento').value;
        if (!validarValorPositivo(valorFechamento)) {
            mostrarErro(erro, { codigo: 'VALOR_INVALIDO' });
            return;
        }
        botao.disabled = true;
        try {
            const resultado = await api.fecharCaixa({ valorFechamento: Number(valorFechamento) });
            const caixa = resultado.caixa ?? resultado;
            exibirValor(documento.getElementById('valor-esperado'), obterValor(caixa, [
                'valorEsperado', 'valorCalculado', 'valorAberturaEsperado',
            ]));
            exibirValor(documento.getElementById('valor-contado'), obterValor(caixa, [
                'valorContado', 'valorFechamento',
            ], valorFechamento));
            exibirValor(documento.getElementById('diferenca'), obterValor(caixa, [
                'diferenca', 'valorDiferenca',
            ]));
            documento.getElementById('resultado-fechamento').hidden = false;
            form.hidden = true;
            status.textContent = 'Turno fechado.';
        } catch (falha) {
            mostrarErro(erro, falha);
        } finally {
            botao.disabled = false;
        }
    });
}