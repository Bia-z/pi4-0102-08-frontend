// Janela que pede o código e a senha de quem autoriza uma ação sensível (por exemplo,
// o administrador cancelando um pedido já pago). Como o confirmar.js, usa só as classes
// de modal do Bootstrap (o projeto carrega o CSS, não o JS).
//
// A validação das credenciais é do backend: `aoConfirmar` recebe { codigoUsuario, senha }
// e deve lançar erro se a ação for recusada. Nesse caso a janela continua aberta, mostra a
// mensagem e limpa a senha, para a pessoa tentar de novo sem perder o contexto.
// Devolve uma Promise: true se `aoConfirmar` terminou sem erro, false se a pessoa cancelou,
// apertou Esc ou clicou fora da janela.

let contador = 0;

function criar(doc, tag, classe, texto) {
    const elemento = doc.createElement(tag);
    if (classe) elemento.className = classe;
    if (texto !== undefined) elemento.textContent = texto;
    return elemento;
}

function campo(doc, id, rotulo, tipo) {
    const grupo = criar(doc, 'div', 'mb-3');
    const label = criar(doc, 'label', 'form-label', rotulo);
    label.setAttribute('for', id);
    const entrada = criar(doc, 'input', 'form-control');
    entrada.id = id;
    entrada.type = tipo;
    entrada.autocomplete = 'off';
    grupo.append(label, entrada);
    return { grupo, entrada };
}

export function solicitarAutorizacao({
    titulo = 'Autorização necessária',
    mensagem = '',
    textoConfirmar = 'Confirmar',
    textoCancelar = 'Voltar',
    perigo = true,
    aoConfirmar = async () => {},
    mensagemErro = (erro) => erro?.message || 'Não foi possível concluir a operação.',
} = {}, doc = document) {
    return new Promise((resolve) => {
        const numero = ++contador;
        const idTitulo = `rm-autorizacao-titulo-${numero}`;
        const anterior = doc.activeElement;

        const fundo = criar(doc, 'div', 'modal-backdrop fade show');
        const modal = criar(doc, 'div', 'modal fade show d-block rm-confirmacao');
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', idTitulo);
        modal.tabIndex = -1;

        const caixa = criar(doc, 'div', 'modal-dialog modal-dialog-centered');
        const conteudo = criar(doc, 'div', 'modal-content border-0 shadow');
        const formulario = criar(doc, 'form', '');
        formulario.noValidate = true;

        const corpo = criar(doc, 'div', 'modal-body px-4 pt-4 pb-2');
        const tituloEl = criar(doc, 'h2', 'h5 mb-2', titulo);
        tituloEl.id = idTitulo;
        const codigo = campo(doc, `rm-autorizacao-codigo-${numero}`, 'Código do administrador', 'text');
        const senha = campo(doc, `rm-autorizacao-senha-${numero}`, 'Senha do administrador', 'password');
        const aviso = criar(doc, 'p', 'alert alert-danger py-2 small mb-2');
        aviso.setAttribute('role', 'alert');
        aviso.hidden = true;
        corpo.append(tituloEl, criar(doc, 'p', 'text-secondary', mensagem), codigo.grupo, senha.grupo, aviso);

        const rodape = criar(doc, 'div', 'modal-footer border-0 justify-content-end gap-2 pb-4');
        const cancelar = criar(doc, 'button', 'btn btn-outline-secondary px-4', textoCancelar);
        const confirmarBotao = criar(doc, 'button', `btn ${perigo ? 'btn-danger' : 'btn-primary'} px-4`, textoConfirmar);
        cancelar.type = 'button';
        confirmarBotao.type = 'submit';
        cancelar.dataset.acao = 'cancelar';
        confirmarBotao.dataset.acao = 'confirmar';
        rodape.append(cancelar, confirmarBotao);

        formulario.append(corpo, rodape);
        conteudo.append(formulario);
        caixa.append(conteudo);
        modal.append(caixa);

        const focaveis = [codigo.entrada, senha.entrada, cancelar, confirmarBotao];
        let enviando = false;

        function fechar(resultado) {
            doc.removeEventListener('keydown', teclado);
            modal.remove();
            fundo.remove();
            doc.body.classList.remove('modal-open');
            anterior?.focus?.();
            resolve(resultado);
        }

        function mostrarAviso(texto) {
            aviso.textContent = texto;
            aviso.hidden = false;
        }

        function teclado(evento) {
            if (evento.key === 'Escape') {
                evento.preventDefault();
                if (!enviando) fechar(false);
            } else if (evento.key === 'Tab') {
                // Mantém o foco dentro da janela
                evento.preventDefault();
                const posicao = focaveis.indexOf(doc.activeElement);
                const passo = evento.shiftKey ? -1 : 1;
                focaveis[(posicao + passo + focaveis.length) % focaveis.length].focus();
            }
        }

        async function enviar(evento) {
            evento?.preventDefault?.();
            if (enviando) return;
            const codigoUsuario = codigo.entrada.value.trim();
            const senhaInformada = senha.entrada.value;
            if (!codigoUsuario || !senhaInformada) {
                mostrarAviso('Informe o código e a senha do administrador.');
                (codigoUsuario ? senha.entrada : codigo.entrada).focus();
                return;
            }
            enviando = true;
            aviso.hidden = true;
            cancelar.disabled = true;
            confirmarBotao.disabled = true;
            try {
                await aoConfirmar({ codigoUsuario, senha: senhaInformada });
                enviando = false;
                fechar(true);
            } catch (falha) {
                enviando = false;
                mostrarAviso(mensagemErro(falha));
                senha.entrada.value = '';
                cancelar.disabled = false;
                confirmarBotao.disabled = false;
                senha.entrada.focus();
            }
        }

        formulario.addEventListener('submit', enviar);
        cancelar.addEventListener('click', () => fechar(false));
        modal.addEventListener('click', (evento) => {
            if (evento.target === modal && !enviando) fechar(false);
        });
        doc.addEventListener('keydown', teclado);

        doc.body.classList.add('modal-open');
        doc.body.append(fundo, modal);
        codigo.entrada.focus();
    });
}
