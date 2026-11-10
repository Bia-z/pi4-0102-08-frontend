import test from 'node:test';
import assert from 'node:assert/strict';
import { inicializarPainelGarcom } from '../garcom/js/index.js';

test('carrega cardápio e mesas ao abrir, ao atualizar e a cada aviso em tempo real', async () => {
    let aoClicar;
    let recarregarEmTempoReal;
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
        acompanhar: ({ recarregar }) => { recarregarEmTempoReal = recarregar; },
    });

    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(chamadasCardapio, 1);
    assert.equal(chamadasMesas, 1);

    await aoClicar();
    assert.equal(chamadasCardapio, 2);
    assert.equal(chamadasMesas, 2);

    await recarregarEmTempoReal();
    assert.equal(chamadasCardapio, 2);
    assert.equal(chamadasMesas, 3);
});
