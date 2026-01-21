# Invoice Extractor API

API FastAPI para extração de transações de faturas de cartão de crédito em PDF com categorização inteligente via Supabase.

## Funcionalidades

- 📄 **Extração de PDF**: Usa `pdfplumber` para extrair texto de faturas
- 🤖 **Estruturação com IA**: OpenAI GPT-4o + Instructor para parsing estruturado
- 🏷️ **Categorização Inteligente**: Matching automático com regras do usuário no Supabase
- 🐳 **Deploy com Docker**: Container pronto para produção

## Estrutura do Projeto

```
invoice-extractor/
├── main.py                 # FastAPI app e endpoints
├── schemas.py              # Modelos Pydantic
├── services.py             # Lógica de extração e categorização
├── requirements.txt        # Dependências Python
├── Dockerfile              # Imagem Docker
├── docker-compose.yml      # Orquestração
└── README.md               # Este arquivo
```

## Pré-requisitos

- Docker e Docker Compose instalados
- Chave da API OpenAI
- Projeto Supabase configurado com as tabelas:
  - `transactions_category_rules`
  - `expanse_category_template`
  - `expense_subcategory_template`

## Configuração

1. **Clone o repositório e entre na pasta:**

```bash
cd invoice-extractor
```

2. **Configure as variáveis de ambiente:**

Crie um arquivo `.env` na raiz do projeto:

```bash
OPENAI_API_KEY=sk-your-openai-key-here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-publishable-key-here
```

> ⚠️ **Importante**: usando `SUPABASE_PUBLISHABLE_KEY`, seu projeto/tabelas precisam estar com as políticas (RLS) adequadas para permitir o acesso necessário.  
> Se você estiver usando a chave antiga, a API ainda aceita `SUPABASE_SERVICE_ROLE_KEY` como fallback.

## Deploy com Docker

### Subir a aplicação:

```bash
docker compose up --build
```

A API estará disponível em: `http://localhost:8080`

### Parar a aplicação:

```bash
docker compose down
```

## Uso da API

### Endpoint: `POST /extrair`

Extrai transações de uma fatura PDF e retorna lista categorizada.

**Request:**
- Content-Type: `multipart/form-data`
- Campos:
  - `file`: Arquivo PDF da fatura
  - `user_uuid`: UUID do usuário (string)

**Response:**
```json
[
  {
    "date": "2024-06-01",
    "description": "Restaurante Casa Verde",
    "amount": 75.9,
    "category_name": "Alimentação",
    "category_id": "7d9623ea-ea98-43ab-bf55-4cba9ff86c69",
    "subcategory_name": "Restaurantes",
    "subcategory_id": "5507f132-735d-4a01-878c-f395aea1364b"
  }
]
```

### Exemplo com cURL:

```bash
curl -X POST "http://localhost:8080/extrair" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@/caminho/para/sua/fatura.pdf" \
  -F "user_uuid=7c8a7459-971e-469d-a117-334578df57bf"
```

### Exemplo com Python (requests):

```python
import requests

url = "http://localhost:8080/extrair"
files = {"file": open("fatura.pdf", "rb")}
data = {"user_uuid": "7c8a7459-971e-469d-a117-334578df57bf"}

response = requests.post(url, files=files, data=data)
transacoes = response.json()

for t in transacoes:
    print(f"{t['date']} - {t['description']}: R$ {t['amount']}")
```

### Health Check:

```bash
curl http://localhost:8080/health
```

## Algoritmo de Categorização

Para cada transação extraída:

1. **Normalização**: Converte descrição para lowercase e remove espaços extras
2. **Matching**: Busca regras onde `normalized_pattern` está contido na descrição
3. **Priorização**: Ordena regras por:
   - `confirmed_count` (descendente)
   - `usage_count` (descendente)
   - Tamanho do pattern (descendente - mais específico)
4. **Fallback**: Se não houver regra, usa categoria "Outros" e subcategoria "sem categoria"

## Desenvolvimento Local (sem Docker)

### Instalar dependências:

```bash
pip install -r requirements.txt
```

### Configurar variáveis de ambiente:

```bash
export OPENAI_API_KEY="sk-..."
export SUPABASE_URL="https://..."
export SUPABASE_PUBLISHABLE_KEY="..."
```

### Rodar a aplicação:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Acesse: `http://localhost:8000/docs` para ver a documentação interativa (Swagger).

## Limitações Conhecidas

- **PDFs scaneados**: Arquivos sem camada de texto (imagens/scans) não funcionam. Considere usar OCR ou GPT-4 Vision para esses casos.
- **Custo de tokens**: Faturas grandes podem consumir muitos tokens. Considere usar `gpt-4o-mini` para testes.

## Estrutura das Tabelas Supabase

### `transactions_category_rules`
```sql
{
  "id": "uuid",
  "description_pattern": "text",
  "normalized_pattern": "text",
  "category_template_id": "uuid",
  "subcategory_template_id": "uuid | null",
  "usage_count": "integer",
  "confirmed_count": "integer",
  "created_by": "uuid",
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

### `expanse_category_template`
```sql
{
  "id": "uuid",
  "name": "text",
  "type": "text", // "expense" ou "income"
  "color": "text",
  "icon": "text",
  "order_index": "integer",
  "is_active": "boolean"
}
```

### `expense_subcategory_template`
```sql
{
  "id": "uuid",
  "category_template_id": "uuid",
  "name": "text",
  "order_index": "integer"
}
```

## Troubleshooting

### Erro: "Não foi possível ler texto do PDF"
- O PDF pode ser uma imagem scaneada sem camada de texto
- Solução: Use ferramentas de OCR ou converta para PDF com texto

### Erro: "OPENAI_API_KEY não configurada"
- Verifique se o arquivo `.env` existe e está no formato correto
- Certifique-se de que o Docker Compose está carregando as variáveis

### Erro: "Configuração do Supabase incompleta"
- Verifique se `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` estão definidas
- Se estiver usando `SUPABASE_SERVICE_ROLE_KEY` (legado), confirme que ela está definida corretamente

## Licença

Este projeto é privado e de uso interno.
