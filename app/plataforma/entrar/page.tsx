import { LoginAdmin } from "@/components/admin/login";

export default function EntrarPlataformaPage() {
  return <LoginAdmin redirectTo="/plataforma" titulo="Acesso master" descricao="Entre para administrar restaurantes e a plataforma PedeAI." />;
}
