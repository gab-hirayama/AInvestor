export const n8nWebhookUrl = window.ENV?.N8N_IMPORT_WEBHOOK_URL || 
  import.meta.env.VITE_N8N_IMPORT_WEBHOOK_URL || 
  'https://n8n.hirayama-tech.com/webhook/import-faturas'

export interface N8NImportResponse {
  output: Array<{
    date: string
    description: string
    amount: number
    category: string
    subcategory?: string | null
  }>
}

export async function importInvoice(
  file: File,
  userId: string,
  fileName: string
): Promise<N8NImportResponse> {
  const formData = new FormData()
  formData.append('data', file)
  formData.append('user_id', userId)
  formData.append('file_name', fileName)

  const response = await fetch(n8nWebhookUrl, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    throw new Error(`Failed to import invoice: ${response.statusText}`)
  }

  return response.json()
}

