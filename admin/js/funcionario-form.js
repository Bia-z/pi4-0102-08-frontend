import { cadastrarUsuario } from '../../assets/js/core/api.js';
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

function mostrarResumo(container, dados) {
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
} = {}) {
    if (!form) return;

    let enviando = false;
    const campos = Object.fromEntries(
        ['nome', 'email', 'cpf', 'telefone', 'codigo', 'perfil', 'senha', 'confirmar-senha'].map((nome) => [
            nome,
            form.elements.namedItem(nome),
        ]),
    );

    form.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        if (enviando) return;

        alerta.textContent = '';
        alerta.classList.add('d-none');
        sucesso.classList.add('d-none');

        limparErros(campos);
        let valido = true;
        CAMPOS_OBRIGATORIOS.forEach((nome) => {
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
        if (!campos['confirmar-senha'].value.trim()) {
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
            senha: campos.senha.value,
        };
        if (campos.email.value.trim()) {
            usuario.email = campos.email.value.trim();
        }
        if (campos.codigo.value.trim()) {
            usuario.codigo = campos.codigo.value.trim();
        }

        enviando = true;
        botao.disabled = true;
        botao.textContent = 'Cadastrando...';
        campos.senha.value = '';
        campos['confirmar-senha'].value = '';
        try {
            const requisicao = cadastrar(usuario);
            delete usuario.senha;
            const dados = await requisicao;
            form.reset();
            mostrarResumo(sucesso, dados);
        } catch (erro) {
            const erroCampo = ERROS_POR_CAMPO[erro.codigo];
            if (erroCampo) {
                marcarErroCampo(...erroCampo);
            } else {
                alerta.textContent = MENSAGENS_ERRO[erro.codigo]
                    || 'Não foi possível cadastrar o funcionário. Tente novamente.';
                alerta.classList.remove('d-none');
            }
        } finally {
            enviando = false;
            botao.disabled = false;
            botao.textContent = 'Cadastrar funcionário';
        }
    });
}

if (typeof document !== 'undefined') {
    const form = document.getElementById('form-funcionario');
    if (form && iniciarPagina('admin')) {
        inicializarCadastroFuncionario({ form });
    }
}