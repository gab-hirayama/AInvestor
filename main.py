import os
import base64
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from typing import List
from services import extrair_texto_pdf, processar_fatura_com_gpt, categorizar_transacoes
from schemas import TransacaoCategorizada, ExtrairBase64Request

app = FastAPI(title="API Extrator de Faturas")


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


@app.post("/extrair", response_model=List[TransacaoCategorizada])
async def extrair_transacoes(
    file: UploadFile = File(...),
    user_uuid: str = Form(...)
):
    """
    Endpoint que recebe um PDF e o UUID do usuário.
    Retorna JSON com lista de transações já categorizadas via Supabase.
    """
    
    # 1. Validação básica
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="O arquivo deve ser um PDF.")
    
    # 2. Validar variáveis de ambiente necessárias
    openai_api_key = os.environ.get("OPENAI_API_KEY")
    supabase_url = os.environ.get("SUPABASE_URL")
    # Preferimos SUPABASE_PUBLISHABLE_KEY (chave pública do Supabase).
    # Mantemos fallback para SUPABASE_SERVICE_ROLE_KEY por compatibilidade com setups antigos.
    supabase_key = (
        os.environ.get("SUPABASE_PUBLISHABLE_KEY")
        or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    )
    
    if not openai_api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY não configurada.")
    
    if not supabase_url or not supabase_key:
        raise HTTPException(
            status_code=500,
            detail="Configuração do Supabase incompleta (SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY ou SUPABASE_SERVICE_ROLE_KEY)."
        )

    try:
        # 3. Ler o arquivo em memória
        file_content = await file.read()
        
        # 4. Extrair texto cru (OCR/Parsing)
        texto_pdf = extrair_texto_pdf(file_content)
        
        if len(texto_pdf) < 50:
            raise HTTPException(
                status_code=422,
                detail="Não foi possível ler texto do PDF. Ele pode ser uma imagem (scaneada)."
            )

        # 5. Processar com LLM
        resultado = processar_fatura_com_gpt(texto_pdf, openai_api_key)
        
        # 6. Categorizar transações via Supabase
        transacoes_categorizadas = categorizar_transacoes(
            transacoes=resultado.transacoes,
            user_uuid=user_uuid,
            supabase_url=supabase_url,
            supabase_key=supabase_key
        )
        
        return transacoes_categorizadas

    except HTTPException:
        raise
    except Exception as e:
        # Em produção, logar o erro real e retornar mensagem genérica
        raise HTTPException(status_code=500, detail=f"Erro no processamento: {str(e)}")


@app.post("/extrair_base64", response_model=List[TransacaoCategorizada])
async def extrair_transacoes_base64(payload: ExtrairBase64Request):
    """
    Endpoint alternativo para integrações que não suportam upload multipart.
    Recebe o PDF em base64 (JSON) e o UUID do usuário.
    """

    # 1) Validar variáveis de ambiente necessárias
    openai_api_key = os.environ.get("OPENAI_API_KEY")
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = (
        os.environ.get("SUPABASE_PUBLISHABLE_KEY")
        or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    )

    if not openai_api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY não configurada.")

    if not supabase_url or not supabase_key:
        raise HTTPException(
            status_code=500,
            detail="Configuração do Supabase incompleta (SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY ou SUPABASE_SERVICE_ROLE_KEY)."
        )

    # 2) Decodificar base64 (aceita também data URL: data:application/pdf;base64,...)
    b64 = payload.pdf_base64.strip()
    if "," in b64 and b64.lower().startswith("data:"):
        b64 = b64.split(",", 1)[1].strip()

    try:
        file_content = base64.b64decode(b64, validate=True)
    except Exception:
        raise HTTPException(status_code=400, detail="pdf_base64 inválido.")

    # 3) Validação básica de PDF
    if not file_content.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="O conteúdo enviado não parece ser um PDF válido.")

    try:
        # 4. Extrair texto cru
        texto_pdf = extrair_texto_pdf(file_content)

        if len(texto_pdf) < 50:
            raise HTTPException(
                status_code=422,
                detail="Não foi possível ler texto do PDF. Ele pode ser uma imagem (scaneada)."
            )

        # 5. Processar com LLM
        resultado = processar_fatura_com_gpt(texto_pdf, openai_api_key)

        # 6. Categorizar transações via Supabase
        transacoes_categorizadas = categorizar_transacoes(
            transacoes=resultado.transacoes,
            user_uuid=payload.user_uuid,
            supabase_url=supabase_url,
            supabase_key=supabase_key
        )

        return transacoes_categorizadas

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro no processamento: {str(e)}")
