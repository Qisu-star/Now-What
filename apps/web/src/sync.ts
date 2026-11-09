const CHANNEL_NAME = 'nowwhat-sync'

let channel: BroadcastChannel | null = null

function getChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return null
  if (!channel) channel = new BroadcastChannel(CHANNEL_NAME)
  return channel
}

/** 写操作成功后广播，其他标签页据此刷新 */
export function notifyChange(): void {
  getChannel()?.postMessage({ type: 'changed', at: Date.now() })
}

export function onRemoteChange(handler: () => void): () => void {
  const current = getChannel()
  if (!current) return () => {}

  const listener = (event: MessageEvent<{ type?: string }>): void => {
    if (event.data?.type === 'changed') handler()
  }

  current.addEventListener('message', listener)
  return () => current.removeEventListener('message', listener)
}
