// Textos de erro mostrados para o usuário.
const MENSAGENS = {
    CREDENCIAIS_INVALIDAS: 'Código ou senha incorretos.',
    USUARIO_INATIVO: 'Este usuário está inativo. Fale com o administrador.',
};

export function mensagemDeErro(erro) {
    // fetch lança TypeError quando não consegue falar com o servidor
    if (erro instanceof TypeError) {
        return 'Não foi possível conectar ao servidor. Tente de novo.';
    }
    return MENSAGENS[erro.codigo] || 'Algo deu errado. Tente de novo.';
}