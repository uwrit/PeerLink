import { useEffect, useRef, useCallback } from 'react'

export type WSEvent =
  | { type: 'started'; job_id: number }
  | { type: 'progress'; institution: string; status: string; count?: number; error?: string }
  | { type: 'log'; institution: string; message: string }
  | { type: 'done'; job_id: number }

export function useMatchingWS(jobId: number | null, onEvent: (e: WSEvent) => void) {
  const wsRef = useRef<WebSocket | null>(null)
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  const connect = useCallback((id: number) => {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws/matching/${id}`)
    wsRef.current = ws

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as WSEvent
        onEventRef.current(data)
      } catch {
        // ignore malformed frames
      }
    }

    ws.onerror = () => ws.close()

    return ws
  }, [])

  useEffect(() => {
    if (jobId === null) return
    const ws = connect(jobId)
    return () => ws.close()
  }, [jobId, connect])
}
