
export function formatarMoeda(valor) {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return '—';
    return numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
