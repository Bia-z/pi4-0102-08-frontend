import { obterHistoricoCaixa } from '../../assets/js/core/api.js';
import { criarCelula, listaDe, mostrarErro, obterValor } from './recursos.js';

export async function carregarHistorico({
    documento = document,
    api = obterHistoricoCaixa,
} = {}) {
    const corpo = documento.getElementById('historico-caixa');
    const erro = documento.getElementById('erro-caixa');
    corpo.replaceChildren();
    const carregando = documento.createElement('tr');
    const mensagem = criarCelula(documento, 'Carregando histórico...');
    mensagem.colSpan = 5;
    carregando.appendChild(mensagem);
    corpo.appendChild(carregando);
    try {
        const dados = await api();
        const historico = listaDe(dados, ['historico', 'turnos', 'caixas']);
        corpo.replaceChildren();
        if (!historico.length) {
            const linha = documento.createElement('tr');
            const celula = criarCelula(documento, 'Nenhum turno encontrado.');
            celula.colSpan = 5;
            linha.appendChild(celula);
            corpo.appendChild(linha);
            return;
        }
        for (const caixa of historico) {
            const linha = documento.createElement('tr');
            linha.append(
                criarCelula(documento, obterValor(caixa, ['turno'])),
                criarCelula(documento, obterValor(caixa, ['abertoEm', 'dataAbertura', 'inicio'])),
                criarCelula(documento, obterValor(caixa, ['fechadoEm', 'dataFechamento', 'fim'])),
                criarCelula(documento, obterValor(caixa, ['valorAbertura'])),
                criarCelula(documento, obterValor(caixa, ['valorFechamento', 'valorContado'])),
            );
            corpo.appendChild(linha);
        }
    } catch (falha) {
        corpo.replaceChildren();
        mostrarErro(erro, falha);
    }
}