import { atualizarUsuario, cadastrarUsuario, listarUsuarios } from '../../assets/js/core/api.js';
import { iniciarPagina } from '../../assets/js/core/guard.js';

const PERFIS = ['admin', 'garcom', 'cozinha', 'caixa'];
const CAMPOS_OBRIGATORIOS = ['nome', 'cpf', 'telefone', 'perfil', 'senha'];
const DDD_VALIDOS = new Set([
    '11', '12', '13', '14', '15', '16', '17', '18', '19',
    '21', '22', '24', '27', '28',
    '31', '32', '33', '34', '35', '37', '38',
    '41', '42', '43', '44', '45', '46', '47', '48', '49',
    '51', '53', '54', '55', '61', '62', '63', '64', '65', '66', '67', '68', '69',
    '71', '73', '74', '75', '77', '79',
    '81', '82', '83', '84', '85', '86', '87', '88', '89',
    '91', '92', '93', '94', '95', '96', '97', '98', '99',
]);
const FORMATO_NUMERICO = /^[\d.\-()\s]+$/;
const ROTULOS_RESPOSTA = {
    id: 'ID',
    nome: 'Nome',
    email: 'E-mail',
    cpf: 'CPF',
    telefone: 'Telefone',
    codigo: 'Código',
    perfil: 'Perfil',
    ativo: 'Ativo',
};
const MENSAGENS_ERRO = {
    ACESSO_NEGADO: 'O servidor não reconheceu sua sessão como administrador. Saia e entre novamente com o código de um administrador.',
    PERFIL_INVALIDO: 'Selecione um dos perfis disponíveis.',
    TOKEN_AUSENTE: 'Sua sessão expirou. Entre novamente para continuar.',
    TOKEN_INVALIDO: 'Sua sessão expirou. Entre novamente para continuar.',
    USUARIO_NAO_ENCONTRADO: 'Funcionário não encontrado. Volte para a lista e tente de novo.',
    ADMINISTRADOR_NAO_PODE_SE_DESATIVAR: 'Você não pode desativar a sua própria conta.',
    ULTIMO_ADMINISTRADOR_ATIVO: 'Não é possível desativar ou trocar o perfil do último administrador ativo.',
};
const ERROS_POR_CAMPO = {
    CPF_INVALIDO: ['cpf', 'Informe um CPF válido com 11 dígitos.'],
    CPF_DUPLICADO: ['cpf', 'Este CPF já está cadastrado.'],
    TELEFONE_INVALIDO: ['telefone', 'Informe um telefone com DDD e 10 ou 11 dígitos.'],
    EMAIL_INVALIDO: ['email', 'Informe um endereço de e-mail válido.'],
    EMAIL_DUPLICADO: ['email', 'Este e-mail já está cadastrado.'],
    PERFIL_INVALIDO: ['perfil', 'Selecione um dos perfis disponíveis.'],
    CODIGO_DUPLICADO: ['codigo', 'Este código já está cadastrado. Informe outro código ou deixe o campo em branco para gerar um.'],
};

function marcarErroCampo(campo, mensagem) {
    const input = document.getElementById(campo);
    const erro = document.getElementById(`${campo}-erro`);
    input.classList.add('is-invalid');
    input.setAttribute('aria-invalid', 'true');
    erro.textContent = mensagem;
}

function limparErros(campos) {
    Object.keys(campos).forEach((nome) => {
        campos[nome].classList.remove('is-invalid');
        campos[nome].removeAttribute('aria-invalid');
        const erro = document.getElementById(`${nome}-erro`);
        if (erro) erro.textContent = '';
    });
}

function digitosNumericos(valor) {
    if (!FORMATO_NUMERICO.test(valor)) return null;
    return valor.replace(/\D/g, '');
}

export function cpfValido(valor) {
    const digitos = digitosNumericos(valor);
    if (!digitos || digitos.length !== 11 || /^(\d)\1{10}$/.test(digitos)) return false;

    for (let indice = 9; indice < 11; indice += 1) {
        let soma = 0;
        for (let posicao = 0; posicao < indice; posicao += 1) {
            soma += Number(digitos[posicao]) * (indice + 1 - posicao);
        }
        const resto = (soma * 10) % 11;
        const verificador = resto === 10 ? 0 : resto;
        if (verificador !== Number(digitos[indice])) return false;
    }
    return true;
}

export function telefoneValido(valor) {
    const digitos = digitosNumericos(valor);
    return Boolean(
        digitos
        && (digitos.length === 10 || digitos.length === 11)
        && DDD_VALIDOS.has(digitos.slice(0, 2)),
    );
}

export function mostrarResumo(container, dados) {
    const resumo = document.getElementById('cadastro-resumo');
    resumo.replaceChildren();

    Object.entries(ROTULOS_RESPOSTA).forEach(([campo, rotulo]) => {
        const termo = document.createElement('dt');
        termo.className = 'col-sm-3';
        termo.textContent = rotulo;

        const definicao = document.createElement('dd');
        definicao.className = 'col-sm-9';
        definicao.textContent = campo === 'ativo'
            ? (dados.ativo ? 'Sim' : 'Não')
            : String(dados[campo] ?? '');

        resumo.append(termo, definicao);
    });

    container.classList.remove('d-none');
}

export function inicializarCadastroFuncionario({
                                                   form = document.getElementById('form-funcionario'),
                                                   alerta = document.getElementById('cadastro-alerta'),
                                                   sucesso = document.getElementById('cadastro-sucesso'),
                                                   botao = document.getElementById('btn-cadastrar'),
                                                   cadastrar = cadastrarUsuario,
                                                   usuarioId = null,
                                                   atualizar = atualizarUsuario,
                                                   listar = listarUsuarios,
                                               } = {}) {
    if (!form) return;

    const edicao = usuarioId !== null && usuarioId !== undefined;
    const rotuloBotao = edicao ? 'Salvar alterações' : 'Cadastrar funcionário';
    let enviando = false;
    const nomesCampos = ['nome', 'email', 'cpf', 'telefone', 'codigo', 'perfil', 'senha', 'confirmar-senha'];
    if (edicao) nomesCampos.push('ativo');
    const campos = Object.fromEntries(
        nomesCampos.map((nome) => [nome, form.elements.namedItem(nome)]),
    );
    const obrigatorios = edicao
        ? ['nome', 'cpf', 'telefone', 'perfil', 'codigo']
        : CAMPOS_OBRIGATORIOS;

    const preencher = (usuario) => {
        campos.nome.value = usuario.nome ?? '';
        campos.email.value = usuario.email ?? '';
        campos.cpf.value = usuario.cpf ?? '';
        campos.telefone.value = usuario.telefone ?? '';
        campos.codigo.value = usuario.codigo ?? '';
        campos.perfil.value = usuario.perfil ?? '';
        campos.ativo.checked = Boolean(usuario.ativo);
    };

    const mostrarAlertaErro = (mensagem) => {
        alerta.textContent = mensagem;
        alerta.classList.remove('d-none');
    };

    const carregarFuncionario = async () => {
        botao.disabled = true;
        try {
            const lista = await listar();
            const usuario = Array.isArray(lista)
                ? lista.find((item) => String(item.id) === String(usuarioId))
                : null;
            if (!usuario) {
                mostrarAlertaErro(MENSAGENS_ERRO.USUARIO_NAO_ENCONTRADO);
                return;
            }
            preencher(usuario);
            botao.disabled = false;
        } catch (erro) {
            mostrarAlertaErro(MENSAGENS_ERRO[erro.codigo]
                || 'Não foi possível carregar os dados do funcionário.');
        }
    };

    form.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        if (enviando) return;

        alerta.textContent = '';
        alerta.classList.add('d-none');
        sucesso.classList.add('d-none');

        limparErros(campos);
        let valido = true;
        obrigatorios.forEach((nome) => {
            const campo = campos[nome];
            if (!campo.value.trim()) {
                marcarErroCampo(nome, 'Este campo é obrigatório.');
                valido = false;
            } else if (nome === 'perfil' && !PERFIS.includes(campo.value)) {
                marcarErroCampo(nome, 'Selecione um dos perfis disponíveis.');
                valido = false;
            }
        });

        if (campos.cpf.value.trim() && !cpfValido(campos.cpf.value)) {
            marcarErroCampo('cpf', 'Informe um CPF válido com 11 dígitos e verificadores corretos.');
            valido = false;
        }
        if (campos.telefone.value.trim() && !telefoneValido(campos.telefone.value)) {
            marcarErroCampo('telefone', 'Informe um telefone brasileiro com DDD e 10 ou 11 dígitos.');
            valido = false;
        }
        if (campos.email.value.trim() && !campos.email.checkValidity()) {
            marcarErroCampo('email', 'Informe um e-mail válido ou deixe o campo em branco.');
            valido = false;
        }
        const erroConfirmacao = document.getElementById('confirmar-senha-erro');
        campos['confirmar-senha'].classList.remove('is-invalid');
        campos['confirmar-senha'].removeAttribute('aria-invalid');
        erroConfirmacao.textContent = '';
        const senhaPreenchida = campos.senha.value.trim() || campos['confirmar-senha'].value.trim();
        if (edicao && !senhaPreenchida) {
        } else if (!campos['confirmar-senha'].value.trim()) {
            campos['confirmar-senha'].classList.add('is-invalid');
            campos['confirmar-senha'].setAttribute('aria-invalid', 'true');
            erroConfirmacao.textContent = 'Este campo é obrigatório.';
            valido = false;
        } else if (campos['confirmar-senha'].value !== campos.senha.value) {
            campos['confirmar-senha'].classList.add('is-invalid');
            campos['confirmar-senha'].setAttribute('aria-invalid', 'true');
            erroConfirmacao.textContent = 'As senhas não coincidem.';
            valido = false;
        }
        if (!valido) return;

        const usuario = {
            nome: campos.nome.value.trim(),
            cpf: campos.cpf.value.trim(),
            telefone: campos.telefone.value.trim(),
            perfil: campos.perfil.value,
        };
        if (!edicao || campos.senha.value.trim()) {
            usuario.senha = campos.senha.value;
        }
        if (edicao) {
            usuario.codigo = campos.codigo.value.trim();
            usuario.ativo = campos.ativo.checked;
        }
        if (campos.email.value.trim()) {
            usuario.email = campos.email.value.trim();
        }
        if (campos.codigo.value.trim()) {
            usuario.codigo = campos.codigo.value.trim();
        }

        enviando = true;
        botao.disabled = true;
        botao.textContent = edicao ? 'Salvando...' : 'Cadastrando...';
        campos.senha.value = '';
        campos['confirmar-senha'].value = '';
        try {
            const requisicao = edicao ? atualizar(usuarioId, usuario) : cadastrar(usuario);
            delete usuario.senha;
            const dados = await requisicao;
            if (edicao) {
                preencher(dados);
            } else {
                form.reset();
            }
            mostrarResumo(sucesso, dados);
        } catch (erro) {
            const erroCampo = ERROS_POR_CAMPO[erro.codigo];
            if (erroCampo) {
                marcarErroCampo(...erroCampo);
            } else {
                alerta.textContent = MENSAGENS_ERRO[erro.codigo]
                    || (edicao
                        ? 'Não foi possível salvar as alterações. Tente novamente.'
                        : 'Não foi possível cadastrar o funcionário. Tente novamente.');
                alerta.classList.remove('d-none');
            }
        } finally {
            enviando = false;
            botao.disabled = false;
            botao.textContent = rotuloBotao;
        }
    });

    return edicao ? carregarFuncionario() : undefined;
}

function prepararTelaEdicao() {
    document.title = 'RestManager | Editar funcionário';
    document.getElementById('titulo-pagina').textContent = 'Editar funcionário';
    document.getElementById('sucesso-titulo').textContent = 'Funcionário atualizado com sucesso';
    document.getElementById('btn-cadastrar').textContent = 'Salvar alterações';
    document.getElementById('codigo-opcional').classList.add('d-none');
    document.getElementById('codigo-ajuda').textContent = 'O código é usado para entrar no sistema.';
    document.getElementById('senha-ajuda-edicao').classList.remove('d-none');
    document.getElementById('grupo-ativo').classList.remove('d-none');
}

if (typeof document !== 'undefined') {
    const form = document.getElementById('form-funcionario');
    if (form && iniciarPagina('admin')) {
        const id = new URLSearchParams(window.location.search).get('id');
        if (id) prepararTelaEdicao();
        inicializarCadastroFuncionario({ form, usuarioId: id });
    }
}