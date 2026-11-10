import { obterHistoricoCaixa, obterResumoCaixa } from '../../assets/js/core/api.js';
import { imprimirDocumento, linhasResumoTurno } from './impressao.js';
import { criarCelula, mostrarErro, obterValor } from './recursos.js';

export async function carregarHistorico({
    documento = document,
    api = obterHistoricoCaixa,
    obterResumo = obterResumoCaixa,
    imprimir,
} = {}) {
    const corpo = documento.getElementById('historico-caixa');
    const erro = documento.getElementById('erro-caixa');
    const campoData = documento.getElementById('data-fechamento');
    const limparFiltro = documento.getElementById('limpar-filtro-data');
    erro.textContent = '';
    erro.hidden = true;
    corpo.replaceChildren();
    const carregando = documento.createElement('tr');
    const mensagem = criarCelula(documento, 'Carregando histórico...');
    mensagem.colSpan = 6;
    carregando.appendChild(mensagem);
    corpo.appendChild(carregando);

    let fechamentos = [];
    let carregado = false;
    const renderizar = () => {
        if (!carregado) return;
        const dataSelecionada = campoData.value;
        const filtrados = dataSelecionada
            ? fechamentos.filter((caixa) => String(caixa.fechadoEm ?? '').slice(0, 10) === dataSelecionada)
            : fechamentos;
        corpo.replaceChildren();
        if (!filtrados.length) {
            const linha = documento.createElement('tr');
            const mensagemVazia = fechamentos.length
                ? 'Nenhum turno fechado nesta data.'
                : 'Nenhum turno fechado.';
            const celula = criarCelula(documento, mensagemVazia);
            celula.colSpan = 6;
            linha.appendChild(celula);
            corpo.appendChild(linha);
            return;
        }
        for (const caixa of filtrados) {
            const linha = documento.createElement('tr');
            const acoes = documento.createElement('td');
            const botao = documento.createElement('button');
            botao.type = 'button';
            botao.className = 'btn btn-outline-primary btn-sm';
            botao.textContent = 'Imprimir';
            botao.addEventListener('click', async () => {
                botao.disabled = true;
                try {
                    imprimirDocumento({
                        titulo: 'Fechamento de turno',
                        linhas: linhasResumoTurno(await obterResumo(caixa.id)),
                        documento,
                        imprimir,
                    });
                } catch (falha) {
                    mostrarErro(erro, falha);
                } finally {
                    botao.disabled = false;
                }
            });
            acoes.appendChild(botao);
            linha.append(
                criarCelula(documento, obterValor(caixa, ['turno'])),
                criarCelula(documento, obterValor(caixa, ['abertoEm', 'dataAbertura', 'inicio'])),
                criarCelula(documento, obterValor(caixa, ['fechadoEm', 'dataFechamento', 'fim'])),
                criarCelula(documento, obterValor(caixa, ['valorAbertura'])),
                criarCelula(documento, obterValor(caixa, ['valorFechamento', 'valorContado'])),
                acoes,
            );
            corpo.appendChild(linha);
        }
    };
    campoData.addEventListener('change', renderizar);
    limparFiltro.addEventListener('click', () => {
        campoData.value = '';
        renderizar();
    });

    try {
        const dados = await api();
        if (!dados || typeof dados !== 'object' || !Array.isArray(dados.fechamentos)) {
            const falha = new Error('O servidor retornou uma resposta inesperada para o histórico de caixa.');
            falha.codigo = 'RESPOSTA_HISTORICO_CAIXA_INVALIDA';
            throw falha;
        }
        fechamentos = dados.fechamentos;
        carregado = true;
        renderizar();
    } catch (falha) {
        corpo.replaceChildren();
        mostrarErro(erro, falha);
    }
}