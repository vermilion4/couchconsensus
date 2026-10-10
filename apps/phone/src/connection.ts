// Socket to the session service: hello → welcome, then snapshots (ADR-0004).
import {ServerMessage, type ClientMessage} from '@couch/protocol';

export type ConnState = 'connecting' | 'open' | 'closed' | 'rejected';

export function connect(
  roomCode: string,
  seatToken: string,
  onState: (s: ConnState, detail?: string) => void,
  onMessage: (m: ServerMessage) => void,
): () => void {
  let ws: WebSocket | undefined;
  let stopped = false;
  let retry = 0;

  const open = () => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/ws`);
    onState('connecting');
    ws.onopen = () => {
      retry = 0;
      const hello: ClientMessage = {type: 'hello', roomCode, role: 'voter', token: seatToken};
      ws!.send(JSON.stringify(hello));
    };
    ws.onmessage = e => {
      const parsed = ServerMessage.safeParse(JSON.parse(String(e.data)));
      if (!parsed.success) return;
      const m = parsed.data;
      if (m.type === 'welcome') onState('open');
      if (m.type === 'error' && m.fatal) {
        stopped = true;
        onState('rejected', m.message);
      }
      onMessage(m);
    };
    ws.onclose = () => {
      if (stopped) return;
      onState('closed');
      // back off 0.5 s, 1 s, 2 s … capped at 5 s
      setTimeout(open, Math.min(5000, 500 * 2 ** retry++));
    };
  };

  open();
  return () => {
    stopped = true;
    ws?.close();
  };
}
