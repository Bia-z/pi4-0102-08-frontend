// Janela de confirmação no meio da tela, no lugar do window.confirm() do navegador.
// Usa só as classes de modal do Bootstrap (o projeto carrega o CSS, não o JS).
// Devolve uma Promise: true se a pessoa confirmou, false se cancelou, apertou Esc
// ou clicou fora da janela.

const ICONE_ALERTA = '<svg width="24" height="24" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">'
    + '<path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 '
    + '1.438-.99.98-1.767zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5m.002 '
    + '6a1 1 0 1 1 0 2 1 1 0 0 1 0-2"/></svg>';

let contador = 0;

function criar(doc, tag, classe, texto) {
    const elemento = doc.createElement(tag);
    if (classe) elemento.className = classe;
    if (texto !== undefined) elemento.textContent = texto;
    return elemento;
}

export function confirmar({
    titulo = 'Confirmar ação',
    mensagem = '',
    textoConfirmar = 'Confirmar',
    textoCancelar = 'Cancelar',
    perigo = true,
} = {}, doc = document) {
    return new Promise((resolve) => {
        const idTitulo = `rm-confirmacao-titulo-${++contador}`;
        const anterior = doc.activeElement;

        const fundo = criar(doc, 'div', 'modal-backdrop fade show');
        const modal = criar(doc, 'div', 'modal fade show d-block rm-confirmacao');
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', idTitulo);
        modal.tabIndex = -1;

        const caixa = criar(doc, 'div', 'modal-dialog modal-dialog-centered');
        const conteudo = criar(doc, 'div', 'modal-content border-0 shadow');

        const corpo = criar(doc, 'div', 'modal-body text-center px-4 pt-4 pb-2');
        const icone = criar(doc, 'div', `rm-confirmacao-icone mx-auto mb-3 ${perigo ? 'perigo' : ''}`.trim());
        icone.innerHTML = ICONE_ALERTA;
        const tituloEl = criar(doc, 'h2', 'h5 mb-2', titulo);
        tituloEl.id = idTitulo;
        corpo.append(icone, tituloEl, criar(doc, 'p', 'text-secondary mb-0', mensagem));

        const rodape = criar(doc, 'div', 'modal-footer border-0 justify-content-center gap-2 pb-4');
        const cancelar = criar(doc, 'button', 'btn btn-outline-secondary px-4', textoCancelar);
        const confirmarBotao = criar(doc, 'button', `btn ${perigo ? 'btn-danger' : 'btn-primary'} px-4`, textoConfirmar);
        cancelar.type = 'button';
        confirmarBotao.type = 'button';
        cancelar.dataset.acao = 'cancelar';
        confirmarBotao.dataset.acao = 'confirmar';
        rodape.append(cancelar, confirmarBotao);

        conteudo.append(corpo, rodape);
        caixa.append(conteudo);
        modal.append(caixa);

        function fechar(resultado) {
            doc.removeEventListener('keydown', teclado);
            modal.remove();
            fundo.remove();
            doc.body.classList.remove('modal-open');
            anterior?.focus?.();
            resolve(resultado);
        }

        function teclado(evento) {
            if (evento.key === 'Escape') {
                evento.preventDefault();
                fechar(false);
            } else if (evento.key === 'Tab') {
                // Mantém o foco dentro da janela, alternando entre os dois botões
                evento.preventDefault();
                (doc.activeElement === cancelar ? confirmarBotao : cancelar).focus();
            }
        }

        cancelar.addEventListener('click', () => fechar(false));
        confirmarBotao.addEventListener('click', () => fechar(true));
        modal.addEventListener('click', (evento) => {
            if (evento.target === modal) fechar(false);
        });
        doc.addEventListener('keydown', teclado);

        doc.body.classList.add('modal-open');
        doc.body.append(fundo, modal);
        // Foco no "Cancelar": Enter sem querer não apaga nada
        cancelar.focus();
    });
}
