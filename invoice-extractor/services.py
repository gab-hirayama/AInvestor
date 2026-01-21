import io
from typing import List
import pdfplumber
import instructor
from openai import OpenAI
from supabase import create_client, Client
from schemas import ResultadoFatura, Transacao, TransacaoCategorizada, CategorizacaoLLM, TransacaoParaCategorizar, ResultadoCategorizacaoBatch


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
    supabase_key: str,
    openai_api_key: str
) -> List[TransacaoCategorizada]:
    """
    Categoriza as transações usando regras do usuário e LLM como fallback.
    
    Fluxo:
    1. Busca regras do usuário (transaction_category_rules)
    2. Busca categorias disponíveis (expense_category_templates)
    3. Busca subcategorias disponíveis (expense_subcategory_templates)
    4. Para cada transação:
       a) Tenta aplicar regra do usuário (prioridade máxima)
       b) Se não houver regra, usa LLM para categorizar com base nas categorias disponíveis
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
    categories_response = supabase.table("expense_category_templates")\
        .select("*")\
        .execute()
    categories = categories_response.data
    
    # Query 3: Subcategorias (templates)
    subcategories_response = supabase.table("expense_subcategory_templates")\
        .select("*")\
        .execute()
    subcategories = subcategories_response.data
    
    # Construir lookups para acesso rápido
    category_by_id = {cat["id"]: cat for cat in categories}
    subcategory_by_id = {sub["id"]: sub for sub in subcategories}
    
    # Construir lookup por nome (case-insensitive)
    category_by_name = {cat["name"].lower(): cat for cat in categories}
    subcategory_by_name = {sub["name"].lower(): sub for sub in subcategories}
    
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
    
    # Inicializa cliente OpenAI para categorização LLM
    openai_client = instructor.from_openai(OpenAI(api_key=openai_api_key))
    
    # OTIMIZAÇÃO: Separar transações que precisam de LLM vs regras
    transacoes_com_regra = []
    transacoes_sem_regra = []
    
    for idx, transacao in enumerate(transacoes):
        descricao_normalizada = _normalizar_texto(transacao.descricao)
        
        # Verificar se existe regra do usuário
        tem_regra = False
        for rule in rules:
            pattern = rule.get("normalized_pattern", "")
            if pattern and pattern in descricao_normalizada:
                tem_regra = True
                break
        
        if tem_regra:
            transacoes_com_regra.append((idx, transacao))
        else:
            transacoes_sem_regra.append((idx, transacao))
    
    # Categorizar todas as transações SEM regra de uma vez (BATCH)
    categorizacoes_llm = {}
    if transacoes_sem_regra:
        try:
            batch_result = _categorizar_batch_com_llm(
                transacoes=[t for _, t in transacoes_sem_regra],
                categories=categories,
                subcategories=subcategories,
                openai_client=openai_client
            )
            # Mapear resultado por índice original
            for idx, transacao in transacoes_sem_regra:
                # Procurar categorização correspondente
                for cat in batch_result.transacoes:
                    # O índice no batch corresponde à posição na lista transacoes_sem_regra
                    if cat.index == transacoes_sem_regra.index((idx, transacao)):
                        categorizacoes_llm[idx] = cat
                        break
        except Exception as e:
            print(f"Erro ao categorizar batch com LLM: {e}")
    
    # Processar cada transação (agora muito mais rápido)
    resultado = []
    for idx, transacao in enumerate(transacoes):
        categorizada = _categorizar_transacao_individual(
            transacao=transacao,
            transacao_idx=idx,
            rules=rules,
            category_by_id=category_by_id,
            subcategory_by_id=subcategory_by_id,
            category_by_name=category_by_name,
            subcategory_by_name=subcategory_by_name,
            default_category=default_category,
            default_subcategory=default_subcategory,
            categorizacoes_llm=categorizacoes_llm,
            subcategories=subcategories
        )
        resultado.append(categorizada)
    
    return resultado


def _normalizar_texto(texto: str) -> str:
    """Normaliza texto para matching (lowercase, trim, espaços únicos)."""
    return " ".join(texto.lower().strip().split())


def _categorizar_batch_com_llm(
    transacoes: List[Transacao],
    categories: list,
    subcategories: list,
    openai_client
) -> ResultadoCategorizacaoBatch:
    """
    Usa o LLM para categorizar MÚLTIPLAS transações de uma vez (muito mais rápido).
    
    Args:
        transacoes: Lista de transações a serem categorizadas
        categories: Lista de categorias disponíveis
        subcategories: Lista de subcategorias disponíveis
        openai_client: Cliente OpenAI com instructor
    
    Returns:
        ResultadoCategorizacaoBatch com todas as categorizações
    """
    
    # Construir lista de categorias para o prompt
    categorias_texto = "\n".join([
        f"- {cat['name']}" for cat in categories if cat.get('type') == 'expense'
    ])
    
    # Agrupar subcategorias por categoria
    subcats_por_categoria = {}
    for subcat in subcategories:
        cat_id = subcat.get("category_template_id")
        if cat_id not in subcats_por_categoria:
            subcats_por_categoria[cat_id] = []
        subcats_por_categoria[cat_id].append(subcat["name"])
    
    # Construir texto de subcategorias
    subcategorias_texto = ""
    for cat in categories:
        if cat.get('type') == 'expense' and cat['id'] in subcats_por_categoria:
            subcats = subcats_por_categoria[cat['id']]
            subcategorias_texto += f"\n{cat['name']}: {', '.join(subcats)}"
    
    # Construir lista de transações para o prompt
    transacoes_texto = ""
    for idx, transacao in enumerate(transacoes):
        transacoes_texto += f"\n{idx}. {transacao.descricao} (R$ {transacao.valor:.2f})"
    
    prompt_sistema = f"""
Você é um especialista em categorização de despesas financeiras.

Sua tarefa é categorizar TODAS as transações fornecidas usando APENAS as categorias e subcategorias disponíveis abaixo.

CATEGORIAS DISPONÍVEIS:
{categorias_texto}

SUBCATEGORIAS DISPONÍVEIS (por categoria):
{subcategorias_texto}

REGRAS IMPORTANTES:
1. Use EXATAMENTE o nome da categoria como está na lista
2. Se houver subcategoria apropriada, use-a; caso contrário, deixe null
3. A subcategoria DEVE pertencer à categoria escolhida
4. Analise o estabelecimento/descrição de cada transação
5. Retorne a categorização para TODAS as transações na ordem fornecida
"""

    prompt_usuario = f"""
Categorize estas transações:
{transacoes_texto}

Retorne a categoria e subcategoria para cada transação usando o índice (0, 1, 2, etc).
"""

    resultado = openai_client.chat.completions.create(
        model="gpt-4o-mini",  # Mais barato e rápido
        response_model=ResultadoCategorizacaoBatch,
        messages=[
            {"role": "system", "content": prompt_sistema},
            {"role": "user", "content": prompt_usuario}
        ],
        temperature=0  # Determinístico
    )
    return resultado


def _categorizar_transacao_individual(
    transacao: Transacao,
    transacao_idx: int,
    rules: list,
    category_by_id: dict,
    subcategory_by_id: dict,
    category_by_name: dict,
    subcategory_by_name: dict,
    default_category: dict,
    default_subcategory: dict,
    categorizacoes_llm: dict,
    subcategories: list
) -> TransacaoCategorizada:
    """
    Aplica o algoritmo de matching para uma única transação.
    
    Algoritmo:
    1. Normaliza a descrição da transação
    2. Tenta aplicar regra do usuário (PRIORIDADE MÁXIMA):
       - Encontra todas as regras que fazem match (normalized_pattern in descrição)
       - Ordena por: confirmed_count desc, usage_count desc, len(pattern) desc
       - Usa a primeira regra encontrada
    3. Se não houver regra, usa categorização do LLM (batch) se disponível
    4. Se LLM não categorizou, usa defaults (Outros / sem categoria)
    """
    
    descricao_normalizada = _normalizar_texto(transacao.descricao)
    
    # PASSO 1: Tentar aplicar regra do usuário (PRIORIDADE)
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
    
    # Se encontrou regra do usuário, aplicar (TEM PRIORIDADE)
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
        # PASSO 2: Não há regra do usuário, usar categorização do LLM (batch)
        if transacao_idx in categorizacoes_llm:
            categoria_llm = categorizacoes_llm[transacao_idx]
            
            # Aplicar resultado do LLM
            if categoria_llm and categoria_llm.categoria:
                cat_nome_lower = categoria_llm.categoria.lower()
                if cat_nome_lower in category_by_name:
                    category = category_by_name[cat_nome_lower]
                    category_id = category["id"]
                    category_name = category["name"]
                    
                    # Tentar aplicar subcategoria se fornecida
                    if categoria_llm.subcategoria:
                        subcat_nome_lower = categoria_llm.subcategoria.lower()
                        # Filtrar subcategorias dessa categoria
                        subcats_da_categoria = [
                            sub for sub in subcategories 
                            if sub.get("category_template_id") == category_id
                        ]
                        # Procurar subcategoria por nome
                        matching_subcat = next(
                            (sub for sub in subcats_da_categoria 
                             if sub.get("name", "").lower() == subcat_nome_lower),
                            None
                        )
                        if matching_subcat:
                            subcategory_id = matching_subcat["id"]
                            subcategory_name = matching_subcat["name"]
        
        # PASSO 3: Se LLM não categorizou, usar fallback
        if not category_id and default_category:
            category_id = default_category["id"]
            category_name = default_category["name"]
        
        if not subcategory_id and default_subcategory:
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
