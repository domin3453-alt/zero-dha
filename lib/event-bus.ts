type Sender = (payload: string) => void;
const clients = new Map<number, Sender>();
let nextId = 1;

export function addSseClient(sender: Sender) {
  const id = nextId++;
  clients.set(id, sender);
  return id;
}

export function removeSseClient(id: number) {
  clients.delete(id);
}

export function broadcastEvent(data: unknown) {
  const payload = typeof data === "string" ? data : JSON.stringify(data);
  for (const sender of Array.from(clients.values())) {
    try {
      sender(payload);
    } catch (err) {
      // ignore individual client failures
    }
  }
}

export function clientCount() {
  return clients.size;
}
