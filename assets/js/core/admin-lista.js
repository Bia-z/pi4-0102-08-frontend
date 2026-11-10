// Peças comuns das telas de listagem do administrador (funcionários e itens).

export function criarElemento(tag, { texto, classe, atributos } = {}) {
    const elemento = document.createElement(tag);
    if (texto !== undefined) elemento.textContent = texto;
    if (classe) elemento.className = classe;
    Object.entries(atributos || {}).forEach(([nome, valor]) => elemento.setAttribute(nome, valor));
    return elemento;
}

export function celula(conteudo, classe) {
    const td = criarElemento('td', { classe });
    if (typeof conteudo === 'string') {
        td.textContent = conteudo;
    } else if (conteudo) {
        td.append(...[].concat(conteudo));
    }
    return td;
}

export function badgeStatus(ativo) {
    return criarElemento('span', {
        texto: ativo ? 'Ativo' : 'Inativo',
        classe: ativo ? 'badge text-bg-success' : 'badge text-bg-secondary',
    });
}

export function linkAcao(texto, href) {
    return criarElemento('a', {
        texto,
        classe: 'btn btn-sm btn-outline-primary',
        atributos: { href },
    });
}

export function botaoAcao(texto, classe, aoClicar, { desabilitado = false, titulo } = {}) {
    const botao = criarElemento('button', {
        texto,
        classe: `btn btn-sm ${classe}`,
        atributos: { type: 'button' },
    });
    botao.disabled = desabilitado;
    if (titulo) botao.setAttribute('title', titulo);
    botao.addEventListener('click', aoClicar);
    return botao;
}

export function mostrarAlerta(alerta, mensagem, tipo = 'danger') {
    if (!alerta) return;
    alerta.textContent = mensagem;
    alerta.classList.remove('alert-danger', 'alert-success', 'alert-warning', 'd-none');
    alerta.classList.add(`alert-${tipo}`);
}

export function esconderAlerta(alerta) {
    if (!alerta) return;
    alerta.textContent = '';
    alerta.classList.add('d-none');
}

export function linhaVazia(colunas, mensagem) {
    const tr = criarElemento('tr');
    const td = criarElemento('td', { texto: mensagem, classe: 'text-center text-secondary py-4' });
    td.setAttribute('colspan', String(colunas));
    tr.append(td);
    return tr;
}
