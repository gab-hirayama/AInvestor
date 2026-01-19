# AInvestor

Gestão Inteligente de Finanças com IA - Aplicação estilo Organizze para importação e categorização automática de faturas.

## 🚀 Funcionalidades

- **Importação de Faturas**: Upload de PDFs com análise automática por IA via webhook n8n
- **Categorização Inteligente**: Sistema de IA que aprende com suas correções
- **Sub-categorias**: Crie sub-categorias por categoria (ex: Transporte → Gasolina, IPVA) e use em lançamentos e regras
- **Lançamentos**: Visualização e gerenciamento de transações com filtros avançados
- **Relatórios**: Gráficos e análises detalhadas por categoria e período
- **Categorias Personalizadas**: Crie e gerencie suas próprias categorias
- **Regras de Aprendizado**: Configure regras para categorização automática

## 🏗️ Tecnologias

- **Frontend**: React 18 + TypeScript + Vite
- **UI**: Tailwind CSS + Lucide Icons
- **Backend**: Supabase (Auth + Postgres + RLS)
- **Análise de Faturas**: n8n Webhook
- **Deploy**: Docker + Docker Compose

## 📋 Pré-requisitos

- Docker e Docker Compose
- Conta no Supabase (https://supabase.com)
- Webhook n8n configurado para análise de faturas

## 🔧 Configuração

### 1. Clone o repositório

```bash
git clone <repository-url>
cd AInvestor
```

### 2. Configure o Supabase

Execute o SQL de migração no Supabase SQL Editor:

```bash
# Arquivo: supabase/migrations/001_initial_schema.sql
# Arquivo: supabase/migrations/002_subcategories.sql
```

Este script cria:
- Tabelas `categories`, `user_categories`, `transactions`, `user_rules`
- Políticas RLS para segurança
- Categorias padrão

O script `002_subcategories.sql` adiciona:
- Coluna `transactions.subcategory_name`
- Coluna `user_rules.fixed_subcategory`
- Tabela `user_subcategories`

### 3. Configure as variáveis de ambiente

```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas credenciais:

```env
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua-chave-anon
N8N_IMPORT_WEBHOOK_URL=https://n8n.hirayama-tech.com/webhook/import-faturas
```

### 4. Execute com Docker Compose

```bash
docker-compose up -d
```

A aplicação estará disponível em: http://localhost:3000

## 🐳 Deploy em Produção

### Build da imagem

```bash
docker-compose build
```

### Executar em background

```bash
docker-compose up -d
```

### Ver logs

```bash
docker-compose logs -f web
```

### Parar os containers

```bash
docker-compose down
```

## 📁 Estrutura do Projeto

```
AInvestor/
├── frontend/                 # Aplicação React
│   ├── src/
│   │   ├── components/      # Componentes reutilizáveis
│   │   ├── contexts/        # Context providers (Auth)
│   │   ├── lib/            # Supabase e n8n clients
│   │   ├── pages/          # Páginas da aplicação
│   │   └── main.tsx        # Entry point
│   ├── public/
│   ├── Dockerfile
│   ├── nginx.conf
│   └── docker-entrypoint.sh
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
├── docker-compose.yml
├── .env.example
└── README.md
```

## 🔐 Segurança

- Autenticação via Supabase Auth
- Row Level Security (RLS) no Postgres
- Políticas de acesso por usuário
- Headers de segurança no Nginx

## 📊 Banco de Dados

### Tabelas Principais

- **categories**: Categorias globais (leitura pública)
- **user_categories**: Categorias personalizadas por usuário
- **transactions**: Transações financeiras com RLS
- **user_rules**: Regras de categorização automática

### Políticas RLS

Todas as tabelas têm políticas RLS que garantem:
- Usuários só acessam seus próprios dados
- Categorias globais são visíveis para todos
- Operações INSERT/UPDATE/DELETE restritas ao dono

## 🔄 Fluxo de Importação

1. Usuário faz upload de PDF
2. Frontend envia para webhook n8n
3. n8n processa e retorna JSON com transações
4. Frontend salva automaticamente no Supabase
5. Regras de aprendizado são aplicadas (categoria e sub-categoria, quando configuradas)

## 🤖 Sistema de Aprendizado

Quando você corrige a categoria de uma transação e marca "Salvar regra":
- O sistema extrai termos-chave da descrição
- Cria uma regra em `user_rules`
- Futuras transações similares são categorizadas automaticamente

## 🛠️ Desenvolvimento Local

### Sem Docker

```bash
cd frontend
npm install
npm run dev
```

Configure as variáveis em `frontend/.env`:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_N8N_IMPORT_WEBHOOK_URL=...
```

## 📝 Webhook n8n

O webhook espera receber:
- `data`: Arquivo PDF (multipart/form-data)
- `user_id`: UUID do usuário
- `file_name`: Nome da fatura

Retorna:
```json
{
  "output": [
    {
      "date": "2025-11-24",
      "description": "Amazon",
      "amount": 196.16,
      "category": "Lazer"
    }
  ]
}
```

## 📄 Licença

Este projeto é privado e proprietário.

## 🤝 Suporte

Para dúvidas ou suporte, entre em contato com o desenvolvedor.
