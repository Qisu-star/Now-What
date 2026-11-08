export interface Health {
  status: 'ok'
  db: 'ok'
  time: string
}

export async function getHealth(): Promise<Health> {
  const response = await fetch('/api/v1/health')
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  return (await response.json()) as Health
}
