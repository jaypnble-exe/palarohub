import { z } from "zod";
import type { createClient } from "@/lib/supabase/browser";

const clockRequest = z.object({ requestId: z.uuid() });
const clockReply = z.object({
  requestId: z.uuid(),
  receivedAt: z.number().finite(),
  repliedAt: z.number().finite(),
  eventId: z.uuid(),
});
export type ClockReply = z.output<typeof clockReply>;

/** Notifications only: the TV still reads official actions through tv_game. */
export function gameLiveChannel(
  supabase: ReturnType<typeof createClient>,
  gameId: string,
  handlers: {
    saved?: () => void;
    clockRequest?: (requestId: string, receivedAt: number) => void;
    clockReply?: (reply: ClockReply) => void;
    connected?: (ready: boolean) => void;
  },
) {
  const topic = `game-live:${gameId}`;
  const local =
    typeof BroadcastChannel === "undefined"
      ? undefined
      : new BroadcastChannel(topic);
  let ready = false;
  const receive = (event: string, payload: unknown) => {
    if (event === "saved") handlers.saved?.();
    else if (event === "clock_request") {
      const request = clockRequest.safeParse(payload);
      if (request.success)
        handlers.clockRequest?.(request.data.requestId, Date.now());
    } else if (event === "clock_reply") {
      const reply = clockReply.safeParse(payload);
      if (reply.success) handlers.clockReply?.(reply.data);
    }
  };
  if (local)
    local.onmessage = ({ data }) => {
      if (data && typeof data.event === "string")
        receive(data.event, data.payload);
    };
  const channel = supabase
    .channel(topic)
    .on("broadcast", { event: "saved" }, ({ payload }) =>
      receive("saved", payload),
    )
    .on("broadcast", { event: "clock_request" }, ({ payload }) =>
      receive("clock_request", payload),
    )
    .on("broadcast", { event: "clock_reply" }, ({ payload }) =>
      receive("clock_reply", payload),
    )
    .subscribe((status) => {
      ready = status === "SUBSCRIBED";
      handlers.connected?.(ready);
    });
  return {
    send(event: "saved" | "clock_request" | "clock_reply", payload: object) {
      // Notification failures must never prevent an official action from saving.
      try {
        local?.postMessage({ event, payload });
      } catch {
        /* Polling remains available. */
      }
      if (ready) {
        try {
          void channel
            .send({ type: "broadcast", event, payload })
            .catch(() => undefined);
        } catch {
          /* Polling remains available. */
        }
      }
    },
    close() {
      local?.close();
      void supabase.removeChannel(channel).catch(() => undefined);
    },
  };
}

/** NTP midpoint estimate: scorer time minus TV time, excluding reply processing. */
export function scorerTimeSample(
  sentAt: number,
  receivedAt: number,
  reply: ClockReply,
) {
  const processing = reply.repliedAt - reply.receivedAt;
  const roundTrip = receivedAt - sentAt - processing;
  if (processing < 0 || roundTrip < 0 || roundTrip > 2000) return null;
  return {
    roundTrip,
    offset: (reply.receivedAt - sentAt + (reply.repliedAt - receivedAt)) / 2,
  };
}
