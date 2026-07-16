export type Produto = {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  disponivel: boolean;
  categoria: string | null;
  imagem_url?: string | null;
};

export type ItemCarrinho = Produto & { quantidade: number };

export type Loja = {
  id: string;
  nome: string;
  slug: string;
  whatsapp: string | null;
};
