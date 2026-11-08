import test from 'node:test';
import assert from 'node:assert/strict';
import { inicializarFechamento } from '../caixa/js/fechamento.js';

class ElementoFalso {
    constructor() {
        this.listeners = {};
        this.hidden = false;
        this.disabled = false;
        this.textContent = '';
        this.value = '';
        this.className = '';
    }

    addEventListener(tipo, callback) {
        this.listeners[tipo] = callback;
    }
}

function criarDocumento() {
    const ids = [
        'form-fechamento',
        'erro-caixa',
        'status-caixa',
        'fechar-turno',
        'recarregar-fechamento',
        'resumo-vendas',
        'fechamento-total-dinheiro',
        'fechamento-total-credito',
        'fechamento-total-debito',
        'fechamento-total-pix',
        'fechamento-total-vale',
        'fechamento-total-recebido',
        'fechamento-quantidade-pagamentos',
        'valor-fechamento',
        'codigo-usuario',
        'senha-autorizacao',
        'valor-esperado',
        'valor-contado',
        'diferenca',
        'tipo-diferenca',
        'resultado-fechamento',
    ];
    const elementos = Object.fromEntries(ids.map((id) => [id, new ElementoFalso()]));
    return {
        elementos,
        getElementById: (id) => elementos[id],
    };
}

function relatorioExemplo() {
    return {
        totalRecebido: 150,
        totaisPorFormaPagamento: {
            totalDinheiro: 10,
            totalCredito: 20,
            totalDebito: 30,
            totalPix: 40,
            totalValeAlimentacao: 50,
        },
        quantidadePagamentos: 8,
    };
}

test('consulta o relatório da data atual antes de liberar o fechamento e exibe os totais', async () => {
    const documento = criarDocumento();
    const chamadas = [];
    await inicializarFechamento({
        documento,
        dataAtual: () => '2026-11-08',
        api: {
            obterCaixaAberto: async () => {
                chamadas.push('aberto');
                return { turno: 'TARDE' };
            },
            obterRelatorioCaixa: async (data) => {
                chamadas.push(`relatorio:${data}`);
                return relatorioExemplo();
            },
            fecharCaixa: async () => assert.fail('não deve fechar sem envio do formulário'),
        },
    });

    assert.deepEqual(chamadas, ['aberto', 'relatorio:2026-11-08']);
    assert.equal(documento.elementos['resumo-vendas'].hidden, false);
    assert.equal(documento.elementos['form-fechamento'].hidden, false);
    assert.match(documento.elementos['fechamento-total-recebido'].textContent, /150,00/);
    assert.match(documento.elementos['fechamento-total-dinheiro'].textContent, /10,00/);
    assert.match(documento.elementos['fechamento-total-credito'].textContent, /20,00/);
    assert.match(documento.elementos['fechamento-total-debito'].textContent, /30,00/);
    assert.match(documento.elementos['fechamento-total-pix'].textContent, /40,00/);
    assert.match(documento.elementos['fechamento-total-vale'].textContent, /50,00/);
    assert.equal(documento.elementos['fechamento-quantidade-pagamentos'].textContent, '8');
});

for (const [diferenca, classificacao, classe] of [
    [5.25, 'Sobra', 'text-success'],
    [-3.5, 'Falta', 'text-danger'],
    [0, 'Sem diferença', 'text-secondary'],
]) {
    test(`fecha o caixa e exibe a diferença ${classificacao} retornada pela API`, async () => {
        const documento = criarDocumento();
        const requisicoes = [];
        await inicializarFechamento({
            documento,
            dataAtual: () => '2026-11-08',
            api: {
                obterCaixaAberto: async () => ({ turno: 'NOITE' }),
                obterRelatorioCaixa: async () => relatorioExemplo(),
                fecharCaixa: async (corpo) => {
                    requisicoes.push(corpo);
                    return { valorEsperado: 100.25, valorFechamento: 105.5, diferenca };
                },
            },
        });

        documento.elementos['valor-fechamento'].value = '105,50';
        documento.elementos['codigo-usuario'].value = 'autorizador';
        documento.elementos['senha-autorizacao'].value = 'senha';
        await documento.elementos['form-fechamento'].listeners.submit({ preventDefault() {} });
        assert.deepEqual(requisicoes, [{
            valorFechamento: 105.5,
            codigoUsuario: 'autorizador',
            senha: 'senha',
        }]);
        assert.equal(documento.elementos['resultado-fechamento'].hidden, false);
        assert.equal(documento.elementos['form-fechamento'].hidden, true);
        assert.match(documento.elementos['valor-esperado'].textContent, /100,25/);
        assert.match(documento.elementos['valor-contado'].textContent, /105,50/);
        assert.match(documento.elementos.diferenca.textContent, new RegExp(
            diferenca < 0 ? '3,50' : `${diferenca.toFixed(2).replace('.', ',')}`,
        ));
        assert.equal(documento.elementos['tipo-diferenca'].textContent, classificacao);
        assert.ok(documento.elementos.diferenca.className.includes(classe));
        assert.equal(documento.elementos['senha-autorizacao'].value, '');
    });
}

test('mantém os dados do fechamento e explica credenciais inválidas sem confirmar', async () => {
    const documento = criarDocumento();
    await inicializarFechamento({
        documento,
        api: {
            obterCaixaAberto: async () => ({ turno: 'MANHA' }),
            obterRelatorioCaixa: async () => relatorioExemplo(),
            fecharCaixa: async () => {
                throw Object.assign(new Error('CREDENCIAIS_INVALIDAS'), { codigo: 'CREDENCIAIS_INVALIDAS' });
            },
        },
    });
    documento.elementos['valor-fechamento'].value = '10.00';
    documento.elementos['codigo-usuario'].value = 'caixa02';
    documento.elementos['senha-autorizacao'].value = 'senha-errada';
    await documento.elementos['form-fechamento'].listeners.submit({ preventDefault() {} });

    assert.equal(documento.elementos['resultado-fechamento'].hidden, true);
    assert.equal(documento.elementos['form-fechamento'].hidden, false);
    assert.equal(documento.elementos['fechar-turno'].disabled, false);
    assert.match(documento.elementos['erro-caixa'].textContent, /Código\/senha incorretos|perfil informado/);
    assert.equal(documento.elementos['valor-fechamento'].value, '10.00');
    assert.equal(documento.elementos['codigo-usuario'].value, 'caixa02');
    assert.equal(documento.elementos['senha-autorizacao'].value, '');
});

test('erro de rede no fechamento não confirma e mantém o valor e código para nova tentativa', async () => {
    const documento = criarDocumento();
    await inicializarFechamento({
        documento,
        api: {
            obterCaixaAberto: async () => ({ turno: 'MANHA' }),
            obterRelatorioCaixa: async () => relatorioExemplo(),
            fecharCaixa: async () => { throw new TypeError('fetch failed'); },
        },
    });
    documento.elementos['valor-fechamento'].value = '10.00';
    documento.elementos['codigo-usuario'].value = 'caixa02';
    documento.elementos['senha-autorizacao'].value = 'senha';
    await documento.elementos['form-fechamento'].listeners.submit({ preventDefault() {} });

    assert.equal(documento.elementos['resultado-fechamento'].hidden, true);
    assert.equal(documento.elementos['form-fechamento'].hidden, false);
    assert.equal(documento.elementos['valor-fechamento'].value, '10.00');
    assert.equal(documento.elementos['codigo-usuario'].value, 'caixa02');
    assert.equal(documento.elementos['senha-autorizacao'].value, '');
    assert.match(documento.elementos['erro-caixa'].textContent, /Não foi possível conectar/);
});

test('mantém o fechamento bloqueado e oferece nova tentativa quando o relatório falha', async () => {
    const documento = criarDocumento();
    await inicializarFechamento({
        documento,
        api: {
            obterCaixaAberto: async () => ({ turno: 'MANHA' }),
            obterRelatorioCaixa: async () => { throw new TypeError('fetch failed'); },
            fecharCaixa: async () => assert.fail('não deve fechar sem resumo diário'),
        },
    });

    assert.equal(documento.elementos['resumo-vendas'].hidden, true);
    assert.equal(documento.elementos['form-fechamento'].hidden, true);
    assert.equal(documento.elementos['recarregar-fechamento'].hidden, false);
    assert.match(documento.elementos['erro-caixa'].textContent, /Não foi possível conectar/);
});
