import { NextResponse } from "next/server";
import { addSseClient, removeSseClient } from "@/lib/event-bus";

export async function GET() {
  const encoder = new TextEncoder();
  let clientId = 0;

  const stream = new ReadableStream({
    start(controller) {
      // send a comment to open the stream
      controller.enqueue(encoder.encode(`: connected\n\n`));

      clientId = addSseClient((payload: string) => {
        try {
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
        } catch (err) {
          // ignore
        }
      });
    },
    cancel() {
      if (clientId) removeSseClient(clientId);
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
