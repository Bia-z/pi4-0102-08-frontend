import test from 'node:test';
import assert from 'node:assert/strict';
import {
    cpfValido,
    inicializarCadastroFuncionario,
    telefoneValido,
} from '../admin/js/funcionario-form.js';
import { cadastrarUsuario } from '../assets/js/core/api.js';

class ElementoFake {
    constructor(value = '') {
        this.value = value;
        this.type = '';
        this.textContent = '';
        this.disabled = false;
        this.attributes = {};
        this.children = [];
        this.classes = new Set();
        this.classList = {
            add: (...classes) => classes.forEach((classe) => this.classes.add(classe)),
            remove: (...classes) => classes.forEach((classe) => this.classes.delete(classe)),
            contains: (classe) => this.classes.has(classe),
        };
    }

    setAttribute(nome, valor) {
        this.attributes[nome] = valor;
    }

    removeAttribute(nome) {
        delete this.attributes[nome];
    }

    checkValidity() {
        return this.type !== 'email' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.value);
    }

    append(...elementos) {
        this.children.push(...elementos);
    }

    replaceChildren(...elementos) {
        this.children = elementos;
    }
}

function criarFormulario(valores = {}) {
    const campos = Object.fromEntries(
        ['nome', 'email', 'cpf', 'telefone', 'codigo', 'perfil', 'senha', 'confirmar-senha'].map((nome) => [
            nome,
            new ElementoFake(Object.hasOwn(valores, nome)
                ? valores[nome]
                : (nome === 'confirmar-senha' ? valores.senha ?? '' : '')),
        ]),
    );
    campos.email.type = 'email';
    const form = new ElementoFake();
    form.elements = { namedItem: (nome) => campos[nome] };
    form.addEventListener = (evento, callback) => {
        assert.equal(evento, 'submit');
        form.enviar = () => callback({ preventDefault() {} });
    };
    form.reset = () => Object.values(campos).forEach((campo) => { campo.value = ''; });

    const ids = new Map([
        ['cadastro-resumo', new ElementoFake()],
        ...Object.entries(campos),
        ...Object.keys(campos).map((nome) => [`${nome}-erro`, new ElementoFake()]),
    ]);
    globalThis.document = {
        getElementById: (id) => ids.get(id),
        createElement: () => new ElementoFake(),
    };

    const alerta = new ElementoFake();
    alerta.classList.add('d-none');
    const sucesso = new ElementoFake();
    sucesso.classList.add('d-none');
    const botao = new ElementoFake();
    inicializarCadastroFuncionario({ form, alerta, sucesso, botao, cadastrar: valores.cadastrar });

    return { campos, form, alerta, sucesso, botao, ids };
}

function respostaFuncionario(overrides = {}) {
    return {
        id: 12,
        nome: 'Joana Silva',
        email: 'joana@example.com',
        cpf: '529.982.247-25',
        telefone: '11999999999',
        codigo: 'FUNC012',
        perfil: 'garcom',
        ativo: true,
        ...overrides,
    };
}

test('envia os campos válidos e mostra os dados retornados sem a senha', async () => {
    let payload;
    const tela = criarFormulario({
        nome: ' Joana Silva ',
        cpf: '529.982.247-25',
        telefone: '11999999999',
        codigo: 'FUNC012',
        perfil: 'garcom',
        senha: 'senha-secreta',
        email: 'joana@example.com',
        cadastrar: async (usuario) => {
            assert.equal(tela.campos.senha.value, '');
            assert.equal(tela.campos['confirmar-senha'].value, '');
            payload = { ...usuario };
            return respostaFuncionario();
        },
    });

    await tela.form.enviar();

    assert.deepEqual(payload, {
        nome: 'Joana Silva',
        email: 'joana@example.com',
        cpf: '529.982.247-25',
        telefone: '11999999999',
        codigo: 'FUNC012',
        perfil: 'garcom',
        senha: 'senha-secreta',
    });
    assert.equal(tela.sucesso.classList.contains('d-none'), false);
    const resumo = document.getElementById('cadastro-resumo').children.map((el) => el.textContent).join(' ');
    assert.match(resumo, /FUNC012/);
    assert.match(resumo, /joana@example.com/);
    assert.equal(JSON.stringify(tela.sucesso).includes('senha-secreta'), false);
    assert.equal(tela.campos.senha.value, '');
});

test('omite código vazio para o backend gerar o código de funcionário', async () => {
    let payload;
    const tela = criarFormulario({
        nome: 'Joana Silva',
        cpf: '529.982.247-25',
        telefone: '11999999999',
        perfil: 'garcom',
        senha: 'senha-secreta',
        cadastrar: async (usuario) => {
            payload = usuario;
            return respostaFuncionario({ codigo: 'GERADO001' });
        },
    });

    await tela.form.enviar();

    assert.equal(Object.hasOwn(payload, 'codigo'), false);
    assert.equal(Object.hasOwn(payload, 'email'), false);
    assert.match(document.getElementById('cadastro-resumo').children.map((el) => el.textContent).join(' '), /GERADO001/);
});

test('não envia quando o e-mail opcional é inválido', async () => {
    let chamadas = 0;
    const tela = criarFormulario({
        nome: 'Joana Silva',
        email: 'email-invalido',
        cpf: '529.982.247-25',
        telefone: '11999999999',
        perfil: 'garcom',
        senha: 'senha-secreta',
        'confirmar-senha': 'senha-secreta',
        cadastrar: async () => { chamadas += 1; },
    });

    await tela.form.enviar();

    assert.equal(chamadas, 0);
    assert.equal(document.getElementById('email-erro').textContent, 'Informe um e-mail válido ou deixe o campo em branco.');
});

test('apresenta mensagem compreensível quando o código já está em uso', async () => {
    const tela = criarFormulario({
        nome: 'Joana Silva',
        cpf: '529.982.247-25',
        telefone: '11999999999',
        codigo: 'FUNC012',
        perfil: 'garcom',
        senha: 'senha-secreta',
        cadastrar: async () => {
            throw Object.assign(new Error('CODIGO_DUPLICADO'), { codigo: 'CODIGO_DUPLICADO', status: 409 });
        },
    });

    await tela.form.enviar();

    assert.equal(document.getElementById('codigo-erro').textContent, 'Este código já está cadastrado. Informe outro código ou deixe o campo em branco para gerar um.');
    assert.equal(tela.alerta.textContent.includes('CODIGO_DUPLICADO'), false);
    assert.equal(tela.botao.disabled, false);
    assert.equal(tela.campos.senha.value, '');
});

test('apresenta mensagem compreensível para acesso negado', async () => {
    const tela = criarFormulario({
        nome: 'Joana Silva',
        cpf: '529.982.247-25',
        telefone: '11999999999',
        perfil: 'garcom',
        senha: 'senha-secreta',
        cadastrar: async () => {
            throw Object.assign(new Error('ACESSO_NEGADO'), { codigo: 'ACESSO_NEGADO', status: 403 });
        },
    });

    await tela.form.enviar();

    assert.equal(tela.alerta.textContent, 'O servidor não reconheceu sua sessão como administrador. Saia e entre novamente com o código de um administrador.');
    assert.equal(tela.alerta.textContent.includes('ACESSO_NEGADO'), false);
});

test('envia apenas uma requisição quando o botão é acionado repetidamente', async () => {
    let liberarCadastro;
    let chamadas = 0;
    const tela = criarFormulario({
        nome: 'Joana Silva',
        cpf: '529.982.247-25',
        telefone: '11999999999',
        perfil: 'garcom',
        senha: 'senha-secreta',
        cadastrar: () => {
            chamadas += 1;
            return new Promise((resolve) => { liberarCadastro = resolve; });
        },
    });

    const primeiroEnvio = tela.form.enviar();
    const segundoEnvio = tela.form.enviar();
    assert.equal(chamadas, 1);
    liberarCadastro(respostaFuncionario());
    await Promise.all([primeiroEnvio, segundoEnvio]);
});

test('marca campos obrigatórios sem enviar a requisição', async () => {
    let chamadas = 0;
    const tela = criarFormulario({
        cadastrar: async () => { chamadas += 1; },
    });

    await tela.form.enviar();

    assert.equal(chamadas, 0);
    assert.equal(tela.campos.nome.attributes['aria-invalid'], 'true');
    assert.equal(document.getElementById('nome-erro').textContent, 'Este campo é obrigatório.');
});

test('não envia quando a confirmação de senha não coincide', async () => {
    let chamadas = 0;
    const tela = criarFormulario({
        nome: 'Joana Silva',
        cpf: '529.982.247-25',
        telefone: '11999999999',
        perfil: 'garcom',
        senha: 'senha-secreta',
        'confirmar-senha': 'senha-diferente',
        cadastrar: async () => { chamadas += 1; },
    });

    await tela.form.enviar();

    assert.equal(chamadas, 0);
    assert.equal(tela.campos['confirmar-senha'].attributes['aria-invalid'], 'true');
    assert.equal(document.getElementById('confirmar-senha-erro').textContent, 'As senhas não coincidem.');
});

test('exige confirmação de senha antes de enviar', async () => {
    let chamadas = 0;
    const tela = criarFormulario({
        nome: 'Joana Silva',
        cpf: '529.982.247-25',
        telefone: '11999999999',
        perfil: 'garcom',
        senha: 'senha-secreta',
        'confirmar-senha': '',
        cadastrar: async () => { chamadas += 1; },
    });

    await tela.form.enviar();

    assert.equal(chamadas, 0);
    assert.equal(document.getElementById('confirmar-senha-erro').textContent, 'Este campo é obrigatório.');
});

test('valida CPF com ou sem máscara e rejeita dígitos verificadores inválidos', () => {
    assert.equal(cpfValido('529.982.247-25'), true);
    assert.equal(cpfValido('52998224725'), true);
    assert.equal(cpfValido('529.982.247-24'), false);
    assert.equal(cpfValido('111.111.111-11'), false);
    assert.equal(cpfValido('529x982x247x25'), false);
});

test('valida telefone com DDD brasileiro e 10 ou 11 dígitos', () => {
    assert.equal(telefoneValido('(11) 3333-4444'), true);
    assert.equal(telefoneValido('(11) 98765-4321'), true);
    assert.equal(telefoneValido('0033334444'), false);
    assert.equal(telefoneValido('119999999'), false);
    assert.equal(telefoneValido('11abc3334444'), false);
});

test('impede envio de CPF, telefone ou perfil inválidos', async (context) => {
    const casos = [
        ['cpf', '529.982.247-24', 'Informe um CPF válido com 11 dígitos e verificadores corretos.'],
        ['telefone', '0033334444', 'Informe um telefone brasileiro com DDD e 10 ou 11 dígitos.'],
        ['perfil', 'supervisor', 'Selecione um dos perfis disponíveis.'],
    ];

    for (const [campo, valor, mensagem] of casos) {
        await context.test(campo, async () => {
            let chamadas = 0;
            const tela = criarFormulario({
                nome: 'Joana Silva',
                cpf: '529.982.247-25',
                telefone: '11999999999',
                perfil: 'garcom',
                senha: 'senha-secreta',
                cadastrar: async () => { chamadas += 1; },
                [campo]: valor,
            });

            await tela.form.enviar();

            assert.equal(chamadas, 0);
            assert.equal(document.getElementById(`${campo}-erro`).textContent, mensagem);
        });
    }
});

test('mostra erros de CPF, telefone, perfil e duplicidade junto ao campo', async (context) => {
    const casos = [
        ['CPF_INVALIDO', 'cpf', 'Informe um CPF válido com 11 dígitos.'],
        ['CPF_DUPLICADO', 'cpf', 'Este CPF já está cadastrado.'],
        ['TELEFONE_INVALIDO', 'telefone', 'Informe um telefone com DDD e 10 ou 11 dígitos.'],
        ['EMAIL_INVALIDO', 'email', 'Informe um endereço de e-mail válido.'],
        ['EMAIL_DUPLICADO', 'email', 'Este e-mail já está cadastrado.'],
        ['PERFIL_INVALIDO', 'perfil', 'Selecione um dos perfis disponíveis.'],
        ['CODIGO_DUPLICADO', 'codigo', 'Este código já está cadastrado. Informe outro código ou deixe o campo em branco para gerar um.'],
    ];

    for (const [codigo, campo, mensagem] of casos) {
        await context.test(codigo, async () => {
            const tela = criarFormulario({
                nome: 'Joana Silva',
                email: 'joana@example.com',
                cpf: '529.982.247-25',
                telefone: '11999999999',
                codigo: 'FUNC012',
                perfil: 'garcom',
                senha: 'senha-secreta',
                cadastrar: async () => {
                    const status = codigo.endsWith('_DUPLICADO') ? 409 : 400;
                    throw Object.assign(new Error(codigo), { codigo, status });
                },
            });

            await tela.form.enviar();

            assert.equal(document.getElementById(`${campo}-erro`).textContent, mensagem);
            assert.equal(tela.alerta.classList.contains('d-none'), true);
        });
    }
});

test('usa o token da sessão no cabeçalho Bearer ao cadastrar usuário', async () => {
    const requisicaoOriginal = globalThis.fetch;
    const storageOriginal = globalThis.localStorage;
    let requisicao;
    globalThis.localStorage = {
        getItem: () => JSON.stringify({ token: 'token-teste', perfil: 'admin' }),
    };
    globalThis.fetch = async (url, opcoes) => {
        requisicao = { url, opcoes };
        return { ok: true, json: async () => respostaFuncionario() };
    };

    try {
        await cadastrarUsuario({
            nome: 'Joana Silva',
            cpf: '123.456.789-00',
            telefone: '11999999999',
            perfil: 'garcom',
            senha: 'senha-secreta',
        });
        assert.equal(requisicao.url, '/api/usuarios');
        assert.equal(requisicao.opcoes.method, 'POST');
        assert.equal(requisicao.opcoes.headers.Authorization, 'Bearer token-teste');
    } finally {
        globalThis.fetch = requisicaoOriginal;
        globalThis.localStorage = storageOriginal;
    }
});

test('encerra a sessão e redireciona quando o backend rejeita o token', async () => {
    const fetchOriginal = globalThis.fetch;
    const storageOriginal = globalThis.localStorage;
    const windowOriginal = globalThis.window;
    let sessaoRemovida = false;
    globalThis.localStorage = {
        getItem: () => JSON.stringify({ token: 'token-expirado', perfil: 'admin' }),
        removeItem: (chave) => {
            assert.equal(chave, 'restmanager.sessao');
            sessaoRemovida = true;
        },
    };
    globalThis.window = { location: {} };
    globalThis.fetch = async () => ({
        ok: false,
        status: 401,
        json: async () => ({ erro: 'TOKEN_INVALIDO' }),
    });

    try {
        await assert.rejects(cadastrarUsuario({ nome: 'Joana Silva' }), { codigo: 'TOKEN_INVALIDO' });
        assert.equal(sessaoRemovida, true);
        assert.equal(globalThis.window.location.href, '/index.html');
    } finally {
        globalThis.fetch = fetchOriginal;
        globalThis.localStorage = storageOriginal;
        globalThis.window = windowOriginal;
    }
});
