# Invoice Extractor API

API FastAPI para extração de transações de faturas de cartão de crédito em PDF com categorização inteligente via Supabase.

## Funcionalidades

- 📄 **Extração de PDF**: Usa `pdfplumber` para extrair texto de faturas
- 🤖 **Estruturação com IA**: OpenAI GPT-4o + Instructor para parsing estruturado
- 🏷️ **Categorização Inteligente**: Matching automático com regras do usuário no Supabase
- 🚫 **Filtro de Pagamentos**: Remove automaticamente pagamentos de fatura do retorno (mantém apenas gastos e estornos legítimos)
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

Extrai transações de uma fatura PDF e retorna objeto com metadados da fatura e lista categorizada.

> ⚠️ **Nota**: A API filtra automaticamente **pagamentos de fatura** do retorno. Apenas gastos e estornos legítimos são retornados. Transações com valor negativo e palavras-chave como "PAGAMENTO", "PAG FATURA", "PGTO", etc. são removidas automaticamente.

**Request:**
- Content-Type: `multipart/form-data`
- Campos:
  - `file`: Arquivo PDF da fatura
  - `user_uuid`: UUID do usuário (string)

**Response:**
```json
{
  "banco_emissor": "Nubank",
  "data_vencimento": "2024-07-15",
  "transacoes": [
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
}
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
resultado = response.json()

print(f"Banco: {resultado['banco_emissor']}")
print(f"Vencimento: {resultado['data_vencimento']}")
print(f"\nTransações:")
for t in resultado['transacoes']:
    print(f"{t['date']} - {t['description']}: R$ {t['amount']}")
```
```

## Deploy econômico no GCP (recomendado: Cloud Run)

O **Cloud Run** é a opção mais econômica para essa API porque:
- escala para **zero** quando não há tráfego (`min-instances=0`)
- cobra por **tempo de CPU/memória durante requisições**
- você só paga build/storage da imagem e uso real do serviço

### 1) Pré-requisitos

- Instale o `gcloud` e autentique:

```bash
gcloud auth login
gcloud auth application-default login
```

- Selecione o projeto e região (ex.: `southamerica-east1`):

```bash
gcloud config set project SEU_PROJECT_ID
gcloud config set run/region southamerica-east1
```

### 2) Criar repositório no Artifact Registry

```bash
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com
gcloud artifacts repositories create invoice-extractor \
  --repository-format=docker \
  --location=southamerica-east1
```

### 3) Build e push da imagem (Cloud Build)

Na raiz do repositório (onde existe a pasta `invoice-extractor/`):

```bash
gcloud builds submit ./invoice-extractor \
  --tag southamerica-east1-docker.pkg.dev/SEU_PROJECT_ID/invoice-extractor/api:latest
```

### 4) Guardar segredos (Secret Manager)

```bash
gcloud services enable secretmanager.googleapis.com

printf "%s" "SUA_OPENAI_KEY" | gcloud secrets create OPENAI_API_KEY --data-file=-
printf "%s" "SUA_SUPABASE_URL" | gcloud secrets create SUPABASE_URL --data-file=-
printf "%s" "SUA_SUPABASE_PUBLISHABLE_KEY" | gcloud secrets create SUPABASE_PUBLISHABLE_KEY --data-file=-
```

> Opcional/legado: se você realmente precisar (não recomendado em produção), crie também `SUPABASE_SERVICE_ROLE_KEY`.

### 5) Deploy no Cloud Run

```bash
gcloud run deploy invoice-extractor \
  --image southamerica-east1-docker.pkg.dev/SEU_PROJECT_ID/invoice-extractor/api:latest \
  --allow-unauthenticated \
  --port 8080 \
  --cpu 1 \
  --memory 1Gi \
  --concurrency 4 \
  --min-instances 0 \
  --max-instances 2 \
  --timeout 300 \
  --set-secrets OPENAI_API_KEY=OPENAI_API_KEY:latest,SUPABASE_URL=SUPABASE_URL:latest,SUPABASE_PUBLISHABLE_KEY=SUPABASE_PUBLISHABLE_KEY:latest
```

Depois disso, o Cloud Run vai imprimir a URL do serviço.

### 6) Dicas de custo (importante)

- **`min-instances=0`**: garante “escala para zero” (principal economia).
- **`max-instances` baixo**: evita explosão de custo em picos (ajuste depois).
- **Timeout**: se o OpenAI demorar, aumente; se quiser cortar custo, reduza.
- **Região**: use uma região próxima do seu Supabase/usuários para reduzir latência.

### 7) Saúde do serviço

O health check está em `GET /health`.

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
