import test from 'node:test';
import assert from 'node:assert/strict';
import { inicializarPainelGarcom } from '../garcom/js/index.js';

test('carrega cardápio e mesas ao abrir, atualizar manualmente e a cada 30 segundos', async () => {
    let aoClicar;
    let atualizacaoAgendada;
    let intervalo;
    let chamadasCardapio = 0;
    let chamadasMesas = 0;
    const botao = {
        addEventListener(evento, callback) {
            assert.equal(evento, 'click');
            aoClicar = callback;
        },
    };

    inicializarPainelGarcom({
        botao,
        carregarMenu: async () => { chamadasCardapio += 1; },
        carregarMesas: async () => { chamadasMesas += 1; },
        agendar(callback, milissegundos) {
            atualizacaoAgendada = callback;
            intervalo = milissegundos;
        },
    });

    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(chamadasCardapio, 1);
    assert.equal(chamadasMesas, 1);
    assert.equal(intervalo, 30_000);

    await aoClicar();
    assert.equal(chamadasCardapio, 2);
    assert.equal(chamadasMesas, 2);

    await atualizacaoAgendada();
    assert.equal(chamadasCardapio, 3);
    assert.equal(chamadasMesas, 3);
});
