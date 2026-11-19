import { abrirCaixa, obterCaixaAberto, obterRelatorioCaixa } from '../../assets/js/core/api.js';
import { exibirValor, mostrarErro, obterValor, validarValorPositivo } from './recursos.js';

export function converterValorAbertura(valor) {
    const texto = String(valor).trim();
    if (!/^\d+(?:[.,]\d{1,2})?$/.test(texto)) return null;
    const numero = Number(texto.replace(',', '.'));
    return Number.isFinite(numero) && numero >= 0 ? numero : null;
}

export function obterTurnoAtual(data = new Date()) {
    const hora = data.getHours();
    if (hora >= 6 && hora < 12) return 'MANHA';
    if (hora >= 12 && hora < 18) return 'TARDE';
    return 'NOITE';
}

export function dataDiaAnterior(data = new Date()) {
    const ontem = new Date(data.getFullYear(), data.getMonth(), data.getDate() - 1);
    const mes = String(ontem.getMonth() + 1).padStart(2, '0');
    const dia = String(ontem.getDate()).padStart(2, '0');
    return `${ontem.getFullYear()}-${mes}-${dia}`;
}

const CAMPOS_RESUMO_ANTERIOR = [
    ['anterior-total-recebido', 'totalRecebido'],
    ['anterior-total-dinheiro', 'totalDinheiro'],
    ['anterior-total-credito', 'totalCredito'],
    ['anterior-total-debito', 'totalDebito'],
    ['anterior-total-pix', 'totalPix'],
    ['anterior-total-vale', 'totalVale'],
];

export async function inicializarAbertura({
                                              documento = document,
                                              api = { abrirCaixa, obterCaixaAberto, obterRelatorioCaixa },
                                              fluxoLogin = false,
                                              redirecionarAposAbertura = fluxoLogin,
                                              navegar = (url) => window.location.assign(url),
                                              agora = () => new Date(),
                                          } = {}) {
    const form = documento.getElementById('form-abertura');
    const status = documento.getElementById('status-caixa');
    const erro = documento.getElementById('erro-caixa');
    const sucesso = documento.getElementById('sucesso-caixa');
    const campoValor = documento.getElementById('valor-abertura');
    const campoTurno = documento.getElementById('turno');
    const botao = documento.getElementById('abrir-turno');
    const tentarNovamente = documento.getElementById('tentar-novamente');
    const resumoAnterior = documento.getElementById('resumo-dia-anterior');
    const botaoContinuar = documento.getElementById('continuar-caixa');
    const irParaCaixa = () => navegar('/caixa/index.html');
    form.hidden = true;
    botaoContinuar?.addEventListener('click', irParaCaixa);

    // No login do CAIXA o turno já está aberto: mostra as vendas de ontem e deixa
    // a pessoa seguir para o caixa quando quiser. Falha no resumo não bloqueia o acesso.
    const exibirResumoAnterior = async () => {
        const dataAnterior = dataDiaAnterior(agora());
        try {
            const dados = await api.obterRelatorioCaixa(dataAnterior);
            const relatorio = dados?.relatorio ?? dados;
            for (const [id, chave] of CAMPOS_RESUMO_ANTERIOR) {
                exibirValor(documento.getElementById(id), obterValor(relatorio, [chave], 0));
            }
            documento.getElementById('anterior-quantidade-pagamentos').textContent = String(
                obterValor(relatorio, ['quantidadePagamentos'], 0),
            );
            documento.getElementById('anterior-data').textContent = dataAnterior.split('-').reverse().join('/');
            resumoAnterior.hidden = false;
        } catch {
            erro.textContent = 'Turno aberto, mas não foi possível carregar o resumo das vendas de ontem.';
            erro.hidden = false;
        }
        botaoContinuar.hidden = false;
    };

    const seguirAposAbertura = async () => {
        if (fluxoLogin) await exibirResumoAnterior();
        else irParaCaixa();
    };

    const exibirTurnoAberto = async (caixa) => {
        status.textContent = `Turno aberto: ${obterValor(caixa, ['turno'])} · Valor de abertura: ${
            obterValor(caixa, ['valorAbertura'])}`;
        form.hidden = true;
        if (redirecionarAposAbertura) await seguirAposAbertura();
    };

    const consultarTurno = async () => {
        erro.hidden = true;
        sucesso.hidden = true;
        tentarNovamente.hidden = true;
        status.textContent = 'Consultando turno aberto...';
        try {
            const dados = await api.obterCaixaAberto();
            const caixa = dados?.caixa ?? dados;
            await exibirTurnoAberto(caixa);
            return true;
        } catch (falha) {
            if (falha.codigo === 'CAIXA_NAO_ABERTO' || falha.status === 404) {
                if (fluxoLogin) {
                    status.textContent = 'Abrindo turno automaticamente...';
                    try {
                        await api.abrirCaixa({ valorAbertura: 0, turno: obterTurnoAtual(agora()) });
                        sucesso.textContent = 'Turno aberto automaticamente com valor inicial de R$ 0,00.';
                        sucesso.hidden = false;
                        status.textContent = 'Turno aberto.';
                        await seguirAposAbertura();
                        return true;
                    } catch (falhaAbertura) {
                        if (falhaAbertura.codigo === 'CAIXA_JA_ABERTO') {
                            try {
                                const dados = await api.obterCaixaAberto();
                                await exibirTurnoAberto(dados?.caixa ?? dados);
                                return true;
                            } catch (falhaConsulta) {
                                mostrarErro(erro, falhaConsulta);
                            }
                        } else {
                            mostrarErro(erro, falhaAbertura);
                        }
                        status.textContent = '';
                        tentarNovamente.hidden = false;
                        return null;
                    }
                }
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
            if (redirecionarAposAbertura) irParaCaixa();
        } catch (falha) {
            if (falha.codigo === 'CAIXA_JA_ABERTO' && redirecionarAposAbertura) {
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