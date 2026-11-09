// Textos de erro mostrados para o usuário.
const MENSAGENS = {
    CREDENCIAIS_INVALIDAS: 'Código ou senha incorretos.',
    USUARIO_INATIVO: 'Este usuário está inativo. Fale com o administrador.',
    MESA_EM_PAGAMENTO: 'Esta mesa está em pagamento no caixa. Só é possível lançar novos itens se o pagamento for cancelado.',
    MESA_NAO_ENCONTRADA: 'A mesa não foi encontrada. Atualize a lista de mesas.',
    PRODUTO_NAO_ENCONTRADO: 'Um dos produtos não está mais disponível. Atualize o cardápio e tente de novo.',
    QUANTIDADE_INVALIDA: 'A quantidade de cada item deve ser de pelo menos 1.',
    ITENS_PEDIDO_OBRIGATORIOS: 'Adicione pelo menos um item ao pedido.',
    USUARIO_NAO_ENCONTRADO: 'Não foi possível identificar o garçom. Saia e entre novamente.',
    ACESSO_NEGADO: 'Você não tem permissão para fazer isso.',
};

export function mensagemDeErro(erro) {
    // fetch lança TypeError quando não consegue falar com o servidor
    if (erro instanceof TypeError) {
        return 'Não foi possível conectar ao servidor. Tente de novo.';
    }
    return MENSAGENS[erro.codigo] || 'Algo deu errado. Tente de novo.';
}