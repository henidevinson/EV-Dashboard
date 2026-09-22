import { useEffect, useRef, useState } from 'react';
import { ConnectionStatus, TelemetryPayload, WebSocketEnvelope } from '../types/telemetry';

const WS_URL = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws/telemetry';

export function useTelemetryWebSocket() {
  const [data, setData] = useState<TelemetryPayload | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('CONNECTING');
  const [isStale, setIsStale] = useState<boolean>(true);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number>();
  const pingIntervalRef = useRef<number>();

  useEffect(() => {
    let unmounted = false;

    function connect() {
      if (unmounted) return;
      setStatus('CONNECTING');

      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (unmounted) return;
        setWsConnected(true);
        // Start 5-second ping heartbeat
        pingIntervalRef.current = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send('ping');
          }
        }, 5000);
      };

      ws.onmessage = (event) => {
        if (unmounted) return;
        try {
          const envelope: WebSocketEnvelope = JSON.parse(event.data);
          if (envelope.type === 'telemetry') {
            const payload = envelope.data as TelemetryPayload;
            setData(payload);
            setStatus(payload.status);
            setIsStale(payload.is_stale);
          } else if (envelope.type === 'status') {
            const rawStatus = (envelope.data as Record<string, unknown>).status as ConnectionStatus;
            if (rawStatus) setStatus(rawStatus);
          }
        } catch (err) {
          console.error('[WS] Payload parse error:', err);
        }
      };

      ws.onclose = () => {
        if (unmounted) return;
        setWsConnected(false);
        setStatus('DISCONNECTED');
        setIsStale(true);
        window.clearInterval(pingIntervalRef.current);
        // Exponential backoff reconnect
        reconnectTimeoutRef.current = window.setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        if (ws.readyState === WebSocket.OPEN) ws.close();
      };
    }

    connect();

    return () => {
      unmounted = true;
      window.clearInterval(pingIntervalRef.current);
      window.clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  return { data, status, isStale, wsConnected };
}