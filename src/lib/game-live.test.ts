import { afterEach, describe, expect, it, vi } from "vitest";
import {
  gameLiveChannel,
  scorerTimeSample,
  type ClockReply,
} from "./game-live";
import type { createClient } from "@/lib/supabase/browser";
import { remainingOnScreen } from "./tv-feed";

const reply: ClockReply = {
  requestId: "e0000000-0000-4000-8000-000000000001",
  eventId: "e0000000-0000-4000-8000-000000000002",
  receivedAt: 30_100,
  repliedAt: 30_120,
};
afterEach(() => vi.unstubAllGlobals());

it("delivers local and remote notifications, validates timing messages, and closes both transports", () => {
  const local = {
    onmessage: undefined as unknown as (message: { data: object }) => void,
    postMessage: vi.fn(),
    close: vi.fn(),
  };
  vi.stubGlobal(
    "BroadcastChannel",
    class {
      constructor() {
        return local;
      }
    },
  );
  const listeners = new Map<string, (message: { payload: object }) => void>();
  const remote = {
    on: vi.fn(
      (
        _kind: string,
        filter: { event: string },
        handler: (message: { payload: object }) => void,
      ) => {
        listeners.set(filter.event, handler);
        return remote;
      },
    ),
    subscribe: vi.fn((callback: (status: string) => void) => {
      callback("SUBSCRIBED");
      return remote;
    }),
    send: vi.fn().mockResolvedValue("ok"),
  };
  const client = {
    channel: vi.fn(() => remote),
    removeChannel: vi.fn().mockResolvedValue("ok"),
  };
  const saved = vi.fn();
  const request = vi.fn();
  const transport = gameLiveChannel(
    client as unknown as ReturnType<typeof createClient>,
    reply.eventId,
    {
      saved,
      clockRequest: request,
    },
  );
  local.onmessage({ data: { event: "saved", payload: {} } });
  listeners.get("saved")!({ payload: {} });
  expect(saved).toHaveBeenCalledTimes(2);
  listeners.get("clock_request")!({ payload: { requestId: "invalid" } });
  expect(request).not.toHaveBeenCalled();
  listeners.get("clock_request")!({ payload: { requestId: reply.requestId } });
  expect(request).toHaveBeenCalledWith(reply.requestId, expect.any(Number));
  transport.send("saved", {});
  expect(local.postMessage).toHaveBeenCalledWith({
    event: "saved",
    payload: {},
  });
  expect(remote.send).toHaveBeenCalledWith({
    type: "broadcast",
    event: "saved",
    payload: {},
  });
  local.postMessage.mockImplementationOnce(() => {
    throw new Error("closed");
  });
  expect(() => transport.send("saved", {})).not.toThrow();
  transport.close();
  expect(local.close).toHaveBeenCalledOnce();
  expect(client.removeChannel).toHaveBeenCalledWith(remote);
});

describe("live clock synchronization", () => {
  it("measures device clock skew without including reply processing or upload delay", () => {
    const sample = scorerTimeSample(0, 220, reply)!;
    expect(sample).toEqual({ roundTrip: 200, offset: 30_000 });
    // A clock-start action took 1.5 s to upload. That delay must not make
    // the TV show 1.5 s more time than the scorer after it receives the action.
    expect(
      remainingOnScreen({
        remainingMs: 300_000,
        running: true,
        asOf: new Date(30_000).toISOString(),
        now: 1500,
        screenOffsetMs: 10_000,
        scorerOffset: 10_000 - sample.offset,
      }),
    ).toBe(298_500);
  });

  it("rejects stale and impossible timing samples", () => {
    expect(scorerTimeSample(0, 5000, reply)).toBeNull();
    expect(scorerTimeSample(0, 10, reply)).toBeNull();
    expect(
      scorerTimeSample(0, 220, { ...reply, repliedAt: 30_000 }),
    ).toBeNull();
  });
});
