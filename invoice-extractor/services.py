import io
from typing import List
import pdfplumber
import instructor
from openai import OpenAI
from supabase import create_client, Client
from schemas import ResultadoFatura, Transacao, TransacaoCategorizada


def extrair_texto_pdf(file_bytes: bytes) -> str:
    """Converte bytes do PDF em uma string única de texto."""
    texto_completo = ""
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            # extract_text lida melhor com tabelas do que ler linhas cruas
            texto_completo += page.extract_text() or ""
            texto_completo += "\n"
    return texto_completo


def processar_fatura_com_gpt(texto_fatura: str, openai_api_key: str) -> ResultadoFatura:
    """Envia o texto para o GPT-4o e retorna o objeto estruturado."""
    
    # Inicializa o cliente com a chave passada
    client = instructor.from_openai(OpenAI(api_key=openai_api_key))

    prompt_sistema = """
    Você é um especialista financeiro. Sua tarefa é analisar o texto cru de uma fatura de cartão de crédito.
    1. Extraia todas as transações de compra, pagamentos e estornos.
    2. Ignore cabeçalhos repetitivos, juros de parcelamento futuro (apenas a parcela atual conta) e textos promocionais.
    3. Normalize datas para YYYY-MM-DD.
    4. Converta valores para float (ex: 1.250,00 vira 1250.00).
    """

    # Chamada à API
    return client.chat.completions.create(
        model="gpt-4o",  # Recomendado para precisão em documentos
        response_model=ResultadoFatura,
        messages=[
            {"role": "system", "content": prompt_sistema},
            {"role": "user", "content": f"Analise esta fatura:\n\n{texto_fatura}"}
        ],
        temperature=0  # Temperatura zero para máxima consistência
    )


def categorizar_transacoes(
    transacoes: List[Transacao],
    user_uuid: str,
    supabase_url: str,
    supabase_key: str
) -> List[TransacaoCategorizada]:
    """
    Categoriza as transações usando regras e templates do Supabase.
    
    Fluxo:
    1. Busca regras do usuário (transactions_category_rules)
    2. Busca categorias disponíveis (expanse_category_template)
    3. Busca subcategorias disponíveis (expense_subcategory_template)
    4. Para cada transação, aplica matching por normalized_pattern
    5. Retorna lista de transações categorizadas
    """
    
    # Inicializa cliente Supabase
    supabase: Client = create_client(supabase_url, supabase_key)
    
    # Query 1: Regras do usuário
    rules_response = supabase.table("transaction_category_rules")\
        .select("*")\
        .eq("created_by", user_uuid)\
        .execute()
    rules = rules_response.data
    
    # Query 2: Categorias (templates)
    categories_response = supabase.table("expense_category_template")\
        .select("*")\
        .execute()
    categories = categories_response.data
    
    # Query 3: Subcategorias (templates)
    subcategories_response = supabase.table("expense_subcategory_template")\
        .select("*")\
        .execute()
    subcategories = subcategories_response.data
    
    # Construir lookups para acesso rápido
    category_by_id = {cat["id"]: cat for cat in categories}
    subcategory_by_id = {sub["id"]: sub for sub in subcategories}
    
    # Encontrar categoria "Outros" (expense) para fallback
    default_category = next(
        (cat for cat in categories if cat.get("name") == "Outros" and cat.get("type") == "expense"),
        None
    )
    
    # Encontrar subcategoria "sem categoria" dentro da categoria default
    default_subcategory = None
    if default_category:
        default_subcategory = next(
            (sub for sub in subcategories 
             if sub.get("name") == "sem categoria" 
             and sub.get("category_template_id") == default_category["id"]),
            None
        )
    
    # Processar cada transação
    resultado = []
    for transacao in transacoes:
        categorizada = _categorizar_transacao_individual(
            transacao=transacao,
            rules=rules,
            category_by_id=category_by_id,
            subcategory_by_id=subcategory_by_id,
            default_category=default_category,
            default_subcategory=default_subcategory
        )
        resultado.append(categorizada)
    
    return resultado


def _normalizar_texto(texto: str) -> str:
    """Normaliza texto para matching (lowercase, trim, espaços únicos)."""
    return " ".join(texto.lower().strip().split())


def _categorizar_transacao_individual(
    transacao: Transacao,
    rules: list,
    category_by_id: dict,
    subcategory_by_id: dict,
    default_category: dict,
    default_subcategory: dict
) -> TransacaoCategorizada:
    """
    Aplica o algoritmo de matching para uma única transação.
    
    Algoritmo:
    1. Normaliza a descrição da transação
    2. Encontra todas as regras que fazem match (normalized_pattern in descrição)
    3. Ordena por: confirmed_count desc, usage_count desc, len(pattern) desc
    4. Usa a primeira regra encontrada
    5. Se não houver regra, usa defaults
    """
    
    descricao_normalizada = _normalizar_texto(transacao.descricao)
    
    # Encontrar regras que fazem match
    matching_rules = []
    for rule in rules:
        pattern = rule.get("normalized_pattern", "")
        if pattern and pattern in descricao_normalizada:
            matching_rules.append(rule)
    
    # Ordenar regras por prioridade
    matching_rules.sort(
        key=lambda r: (
            r.get("confirmed_count", 0),
            r.get("usage_count", 0),
            len(r.get("normalized_pattern", ""))
        ),
        reverse=True
    )
    
    # Inicializar valores
    category_name = None
    category_id = None
    subcategory_name = None
    subcategory_id = None
    
    # Se encontrou regra, aplicar
    if matching_rules:
        best_rule = matching_rules[0]
        cat_id = best_rule.get("category_template_id")
        subcat_id = best_rule.get("subcategory_template_id")
        
        if cat_id and cat_id in category_by_id:
            category = category_by_id[cat_id]
            category_id = category["id"]
            category_name = category["name"]
        
        if subcat_id and subcat_id in subcategory_by_id:
            subcategory = subcategory_by_id[subcat_id]
            subcategory_id = subcategory["id"]
            subcategory_name = subcategory["name"]
    else:
        # Fallback para categoria/subcategoria default
        if default_category:
            category_id = default_category["id"]
            category_name = default_category["name"]
        
        if default_subcategory:
            subcategory_id = default_subcategory["id"]
            subcategory_name = default_subcategory["name"]
    
    return TransacaoCategorizada(
        date=transacao.data,
        description=transacao.descricao,
        amount=transacao.valor,
        category_name=category_name,
        category_id=category_id,
        subcategory_name=subcategory_name,
        subcategory_id=subcategory_id
    )
