"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/browser";
import {
  mergeEvents,
  tvFeedSchema,
  type TvEventRow,
  type TvGame,
} from "@/lib/tv-feed";
import { Icon } from "@/components/ui/icon";
import { BasketballTv } from "./basketball/board";

/** How often to ask for new actions: quickly during play, slowly otherwise. */
const LIVE_POLL_MS = 1500;
const IDLE_POLL_MS = 15000;

/**
 * The gym screen for one game. Anyone with the link can open it; it reads
 * the public feed, keeps up with new actions, keeps the screen awake, and
 * draws the game with its sport's TV layout.
 */
export function TvScreen({ gameId }: { gameId: string }) {
  const t = useTranslations("Tv");
  const supabase = useMemo(() => createClient(), []);
  const [game, setGame] = useState<TvGame>();
  const [rows, setRows] = useState<TvEventRow[]>([]);
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">(
    "loading",
  );
  const [offline, setOffline] = useState(false);
  const last = useRef(0);

  useEffect(() => {
    let stopped = false;
    let timer: number | undefined;
    async function poll() {
      const sent = Date.now();
      const { data, error } = await supabase.rpc("tv_game", {
        p_game_id: gameId,
        p_after: last.current,
      });
      if (stopped) return;
      let wait = IDLE_POLL_MS;
      if (error) setOffline(true);
      else if (data === null) setStatus("missing");
      else {
        const feed = tvFeedSchema.safeParse(data);
        if (feed.success) {
          setOffline(false);
          setGame(feed.data.game);
          // Server time minus this screen's time, halfway through the request.
          setOffset(
            Date.parse(feed.data.serverTime) - (sent + (Date.now() - sent) / 2),
          );
          if (feed.data.events.length) {
            last.current = feed.data.events.at(-1)!.sequence;
            setRows((current) => mergeEvents(current, feed.data.events));
          }
          setStatus("ready");
          if (["in_progress", "scheduled"].includes(feed.data.game.status))
            wait =
              feed.data.game.status === "in_progress" ? LIVE_POLL_MS : 5000;
        }
      }
      timer = window.setTimeout(poll, wait);
    }
    void poll();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [supabase, gameId]);

  // Keep the TV or laptop from sleeping while the scoreboard is up.
  useEffect(() => {
    let lock: WakeLockSentinel | undefined;
    const request = () =>
      navigator.wakeLock
        ?.request("screen")
        .then((sentinel) => (lock = sentinel))
        .catch(() => undefined);
    void request();
    const onVisible = () => {
      if (document.visibilityState === "visible") void request();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => undefined);
    };
  }, []);

  // Controls show when the mouse moves, then hide with the cursor.
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    let timer = window.setTimeout(() => setIdle(true), 3000);
    const wake = () => {
      setIdle(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setIdle(true), 3000);
    };
    window.addEventListener("pointermove", wake);
    return () => {
      window.removeEventListener("pointermove", wake);
      window.clearTimeout(timer);
    };
  }, []);

  if (status !== "ready" || !game)
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-[3vh] bg-navy text-center text-on-dark">
        <span className="font-display text-[5vw] font-bold tracking-[0.2em] uppercase">
          PALAROS
        </span>
        <p role="status" className="text-[2.2vw] text-on-dark-muted">
          {t(status === "missing" ? "notFound" : "loading")}
        </p>
      </div>
    );

  return (
    <div className={idle ? "cursor-none" : undefined}>
      {game.sport === "basketball" ? (
        <BasketballTv game={game} rows={rows} screenOffsetMs={offset} />
      ) : (
        <p className="p-8 text-center">{t("sportNotSupported")}</p>
      )}
      {offline && (
        <p
          role="status"
          className="fixed top-[2vh] left-1/2 -translate-x-1/2 rounded-full bg-orange-soft px-[1.5vw] py-[0.5vh] text-[1.4vw] font-semibold text-orange-dark"
        >
          {t("reconnecting")}
        </p>
      )}
      <button
        type="button"
        onClick={() =>
          document.fullscreenElement
            ? void document.exitFullscreen()
            : void document.documentElement.requestFullscreen?.()
        }
        className={`fixed right-4 bottom-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white/10 px-4 text-sm font-semibold text-on-dark backdrop-blur transition-opacity hover:bg-white/20 ${idle ? "pointer-events-none opacity-0" : "opacity-100"}`}
      >
        <Icon name="public" className="size-4" />
        {t("fullScreen")}
      </button>
    </div>
  );
}
