import { useEffect, useState, useCallback, useRef } from "react";

export type WsCandle = {
  o: number;
  h: number;
  l: number;
  c: number;
  time?: number;
};

export type BrokerEvent = { name?: string; msg?: unknown; [key: string]: unknown };

function parseCandle(message: Record<string, unknown>): WsCandle | null {
  const o = Number(message["open"] ?? message["o"]);
  const h = Number(message["max"] ?? message["high"] ?? message["h"]);
  const l = Number(message["min"] ?? message["low"] ?? message["l"]);
  const c = Number(message["close"] ?? message["c"]);
  if (![o, h, l, c].every(Number.isFinite)) return null;
  const rawTime = message["at"] ?? message["time"];
  const time = rawTime === undefined ? undefined : Number(rawTime);
  return { o, h, l, c, ...(time === undefined ? {} : { time }) };
}

function getBackendWebSocketUrl() {
  const isLocal =
    window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  if (isLocal) return "ws://127.0.0.1:4000/ws";

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}

export function useIqWebSocket(
  onCandle?: (candle: WsCandle) => void,
  onHistory?: (candles: WsCandle[]) => void,
  onBrokerEvent?: (event: BrokerEvent) => void,
) {
  const [wsStatus, setWsStatus] = useState<"disconnected" | "connecting" | "connected">(
    "disconnected",
  );
  const wsRef = useRef<WebSocket | null>(null);
  const onCandleRef = useRef(onCandle);
  const onHistoryRef = useRef(onHistory);
  const onBrokerEventRef = useRef(onBrokerEvent);

  useEffect(() => {
    onCandleRef.current = onCandle;
    onHistoryRef.current = onHistory;
    onBrokerEventRef.current = onBrokerEvent;
  }, [onCandle, onHistory, onBrokerEvent]);

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    setWsStatus("connecting");
    const ws = new WebSocket(getBackendWebSocketUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus("connected");
      console.log("WebSocket conectado ao Backend Parafuso IQ Option.");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.name === "candle-history" && Array.isArray(data.msg?.candles)) {
          const history = data.msg.candles.map(parseCandle).filter(Boolean) as WsCandle[];
          onHistoryRef.current?.(history);
          return;
        }
        onBrokerEventRef.current?.(data as BrokerEvent);
        // Evento de candle gerado pela IQ Option
        if (data.name === "candle-generated" && data.msg) {
          const candle = parseCandle(data.msg);
          if (candle) onCandleRef.current?.(candle);
        }
      } catch (err) {
        console.error("Erro ao processar mensagem do WebSocket:", err);
      }
    };

    ws.onclose = () => {
      setWsStatus("disconnected");
      console.log("WebSocket desconectado. Tentando reconectar em 3s...");
      setTimeout(() => {
        connect();
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error("Erro no WebSocket:", error);
      ws.close();
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { wsStatus };
}
