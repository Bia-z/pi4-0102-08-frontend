import {
    atualizarConfiguracaoCaixa,
    obterConfiguracaoCaixa,
} from '../../assets/js/core/api.js';
import { mostrarErro } from './recursos.js';

export function validarTaxaServico(valor) {
    const taxa = Number(valor);
    return Number.isFinite(taxa) && taxa >= 0 && taxa <= 100;
}

export async function inicializarConfiguracoes({
    perfil,
    documento = document,
    api = { obter: obterConfiguracaoCaixa, atualizar: atualizarConfiguracaoCaixa },
} = {}) {
    const form = documento.getElementById('form-configuracoes');
    const erro = documento.getElementById('erro-configuracoes');
    const sucesso = documento.getElementById('sucesso-configuracoes');
    const botao = documento.getElementById('salvar-configuracoes');
    const admin = String(perfil).toUpperCase() === 'ADMIN';
    form.hidden = true;
    try {
        const dados = await api.obter();
        const config = dados.configuracao ?? dados;
        documento.getElementById('nome-restaurante').value = config.nomeRestaurante ?? '';
        documento.getElementById('taxa-servico').value = config.taxaServicoPercentual ?? 0;
        documento.getElementById('taxa-servico-ativa').checked = config.taxaServicoAtiva !== false;
        documento.getElementById('imprimir-comanda').checked = Boolean(config.imprimirComandaAoAceitar);
        documento.getElementById('comanda-unica').checked = config.comandaUnica !== false;
        documento.getElementById('imprimir-comprovante').checked = Boolean(config.imprimirComprovanteAoFechar);
        for (const campo of form.querySelectorAll('input, button')) campo.disabled = !admin;
        form.hidden = false;
        if (!admin) {
            documento.getElementById('somente-consulta').hidden = false;
            return;
        }
    } catch (falha) {
        mostrarErro(erro, falha);
        return;
    }

    form.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        erro.hidden = true;
        sucesso.hidden = true;
        const taxa = documento.getElementById('taxa-servico').value;
        if (!validarTaxaServico(taxa)) {
            mostrarErro(erro, { codigo: 'TAXA_SERVICO_INVALIDA' });
            return;
        }
        botao.disabled = true;
        try {
            const atualizada = await api.atualizar({
                nomeRestaurante: documento.getElementById('nome-restaurante').value.trim(),
                taxaServicoPercentual: Number(taxa),
                taxaServicoAtiva: documento.getElementById('taxa-servico-ativa').checked,
                imprimirComandaAoAceitar: documento.getElementById('imprimir-comanda').checked,
                comandaUnica: documento.getElementById('comanda-unica').checked,
                imprimirComprovanteAoFechar: documento.getElementById('imprimir-comprovante').checked,
            });
            sucesso.textContent = 'Configurações salvas.';
            sucesso.hidden = false;
            const config = atualizada.configuracao ?? atualizada;
            documento.getElementById('nome-restaurante').value = config.nomeRestaurante
                ?? documento.getElementById('nome-restaurante').value;
        } catch (falha) {
            mostrarErro(erro, falha);
        } finally {
            botao.disabled = false;
        }
    });
}