from pydantic import BaseModel, Field
from typing import List, Optional


class ExtrairBase64Request(BaseModel):
    """Payload para envio de PDF em base64 (usado para integração via API Gateway / frontends)"""
    user_uuid: str = Field(..., description="UUID do usuário (string)")
    pdf_base64: str = Field(..., description="Conteúdo do PDF em base64 (sem prefixo data:...)")


class Transacao(BaseModel):
    """Transação extraída do PDF pela LLM"""
    data: str = Field(..., description="Data da transação no formato YYYY-MM-DD")
    descricao: str = Field(..., description="Nome do estabelecimento ou descrição da compra")
    valor: float = Field(..., description="Valor da transação. Use positivo para gastos e negativo para pagamentos/estornos")
    moeda: str = Field(default="BRL", description="Moeda da transação (BRL, USD, etc)")


class ResultadoFatura(BaseModel):
    """Resultado completo da extração via OpenAI"""
    banco_emissor: Optional[str] = Field(None, description="Nome do banco emissor da fatura")
    data_vencimento: Optional[str] = Field(None, description="Data de vencimento da fatura")
    total_fatura: Optional[float] = Field(None, description="Valor total para pagamento")
    transacoes: List[Transacao]


class TransacaoCategorizada(BaseModel):
    """Transação já enriquecida com dados de categoria/subcategoria do Supabase"""
    date: str = Field(..., description="Data da transação no formato YYYY-MM-DD")
    description: str = Field(..., description="Descrição da transação")
    amount: float = Field(..., description="Valor da transação")
    category_name: Optional[str] = Field(None, description="Nome da categoria")
    category_id: Optional[str] = Field(None, description="UUID da categoria")
    subcategory_name: Optional[str] = Field(None, description="Nome da subcategoria")
    subcategory_id: Optional[str] = Field(None, description="UUID da subcategoria")
