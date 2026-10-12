"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/browser";
import {
  parseGameEvents,
  scorerSetupSchema,
  type ScorerSetup,
} from "@/lib/game-events";
import { isNetworkError } from "@/lib/offline/network";
import { reconcileEvents, type Reconciled } from "@/lib/offline/reconcile";
import {
  createMemoryScorebookStore,
  createScorebookStore,
  type ScorebookStore,
} from "@/lib/offline/scorebook-store";
import { getSportModule } from "@/lib/sports/registry";
import type { BasketballEvent } from "@/lib/sports/basketball";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BasketballScorebook } from "./basketball/board";

type Stage =
  | { kind: "loading" }
  | { kind: "pin"; message?: string; staff: boolean }
  | {
      kind: "ready";
      setup: ScorerSetup;
      log: Reconciled<BasketballEvent>;
      /** Opened from this device's copy because the server could not be reached. */
      offline: boolean;
    }
  | { kind: "error"; message: string };

function openStore(): ScorebookStore {
  return typeof indexedDB === "undefined"
    ? createMemoryScorebookStore()
    : createScorebookStore();
}

/**
 * Unlocks one game's scorebook on this device and hands it to the sport's
 * scorer screen. No account is needed: the device signs in anonymously and
 * the game PIN makes it the official scorer device. Without a connection it
 * opens from the copy saved on this device.
 */
export function Scorebook({ gameId }: { gameId: string }) {
  const t = useTranslations("Scorer");
  const supabase = useMemo(() => createClient(), []);
  const store = useMemo(() => openStore(), []);
  const [stage, setStage] = useState<Stage>({ kind: "loading" });
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  /** Merges server events with unsent actions saved on this device. */
  const ready = useCallback(
    async (
      setup: ScorerSetup,
      server: readonly BasketballEvent[],
      offline: boolean,
    ): Promise<Stage> => {
      const { eventSchema } = getSportModule(setup.sport);
      let local: Awaited<ReturnType<ScorebookStore["loadEvents"]>> = [];
      try {
        local = await store.loadEvents(gameId);
      } catch {
        /* No device storage: only the server's events are available. */
      }
      const log = reconcileEvents(server, local, (value) => {
        const parsed = eventSchema.safeParse(value);
        return parsed.success ? (parsed.data as BasketballEvent) : null;
      });
      if (log.alreadySaved.length)
        await store.markSynced(log.alreadySaved).catch(() => undefined);
      return { kind: "ready", setup, log, offline };
    },
    [store, gameId],
  );

  const fromDevice = useCallback(async (): Promise<Stage | null> => {
    try {
      const parsed = scorerSetupSchema.safeParse(await store.loadSetup(gameId));
      if (!parsed.success) return null;
      const { eventSchema } = getSportModule(parsed.data.sport);
      const saved = (await store.loadEvents(gameId)).flatMap((row) => {
        const event = eventSchema.safeParse(row.event);
        return row.state === "synced" && event.success
          ? [event.data as BasketballEvent]
          : [];
      });
      return ready(parsed.data, saved, true);
    } catch {
      return null;
    }
  }, [store, gameId, ready]);

  /** null: this device is not the scorer yet. "offline": no connection. */
  const fromServer = useCallback(async (): Promise<
    Stage | "offline" | null
  > => {
    const setup = await supabase.rpc("scorer_game_setup", {
      p_game_id: gameId,
    });
    if (setup.error) return isNetworkError(setup.error) ? "offline" : null;
    const parsed = scorerSetupSchema.safeParse(setup.data);
    if (!parsed.success) return { kind: "error", message: "setupFailed" };
    const rows = await supabase
      .from("game_events")
      .select("id,sequence,type,payload,clock_ms,occurred_at")
      .eq("game_id", gameId)
      .order("sequence");
    if (rows.error)
      return isNetworkError(rows.error)
        ? "offline"
        : { kind: "error", message: "setupFailed" };
    const { events } = parseGameEvents(parsed.data.sport, rows.data);
    try {
      await store.saveSetup(gameId, setup.data);
      await store.saveServerEvents(gameId, events);
    } catch {
      /* Without device storage the game still works online. */
    }
    return ready(parsed.data, events as BasketballEvent[], false);
  }, [supabase, gameId, store, ready]);

  const claim = useCallback(
    async (code: string | null) => {
      const { data, error } = await supabase.rpc("claim_scorer_access", {
        p_game_id: gameId,
        p_pin: code ?? undefined,
      });
      if (error) return isNetworkError(error) ? "offlineClaim" : "claimFailed";
      if (data !== "granted") return `claim.${data}`;
      return null;
    },
    [supabase, gameId],
  );

  useEffect(() => {
    let cancelled = false;
    const show = (next: Stage) => {
      if (!cancelled) setStage(next);
    };
    async function offline() {
      show((await fromDevice()) ?? { kind: "error", message: "offlineNoCopy" });
    }
    async function start() {
      // A PIN in the QR link's #fragment never reaches the server; remove it from view.
      const fromLink = /^#pin=(\d{6})$/.exec(window.location.hash)?.[1];
      if (fromLink)
        window.history.replaceState(null, "", window.location.pathname);
      if (!navigator.onLine) return offline();
      const session = await supabase.auth.getSession();
      let user = session.data.session?.user;
      if (!user) {
        const anonymous = await supabase.auth.signInAnonymously();
        if (anonymous.error || !anonymous.data.user) {
          if (anonymous.error && isNetworkError(anonymous.error))
            return offline();
          return show({ kind: "error", message: "anonymousUnavailable" });
        }
        user = anonymous.data.user;
      }
      const first = await fromServer();
      if (first === "offline") return offline();
      if (first) return show(first);
      if (fromLink) {
        const problem = await claim(fromLink);
        const unlocked = problem ? null : await fromServer();
        if (unlocked && unlocked !== "offline") return show(unlocked);
        return show({
          kind: "pin",
          message:
            problem ??
            (unlocked === "offline" ? "offlineClaim" : "setupFailed"),
          staff: !user.is_anonymous,
        });
      }
      show({ kind: "pin", staff: !user.is_anonymous });
    }
    void start();
    return () => {
      cancelled = true;
    };
  }, [supabase, fromServer, fromDevice, claim]);

  async function unlock(code: string | null) {
    setBusy(true);
    const problem = await claim(code);
    const loaded = problem ? null : await fromServer();
    setBusy(false);
    if (loaded && loaded !== "offline") setStage(loaded);
    else
      setStage({
        kind: "pin",
        message:
          problem ?? (loaded === "offline" ? "offlineClaim" : "setupFailed"),
        staff: stage.kind === "pin" && stage.staff,
      });
  }

  if (stage.kind === "loading")
    return (
      <p role="status" className="p-8 text-center text-lg">
        {t("opening")}
      </p>
    );
  if (stage.kind === "error")
    return (
      <div className="mx-auto max-w-md space-y-4 p-8 text-center">
        <p role="alert" className="text-lg font-semibold">
          {t(stage.message)}
        </p>
        <Button type="button" onClick={() => window.location.reload()}>
          {t("tryAgain")}
        </Button>
      </div>
    );
  if (stage.kind === "pin")
    return (
      <form
        className="mx-auto max-w-sm space-y-5 p-8"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void unlock(pin);
        }}
      >
        <h1 className="font-display text-3xl font-semibold">
          {t("enterPinTitle")}
        </h1>
        <p className="text-muted-foreground">{t("enterPinHelp")}</p>
        <label htmlFor="scorer-pin" className="sr-only">
          {t("pinLabel")}
        </label>
        <Input
          id="scorer-pin"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={pin}
          onChange={(event) =>
            setPin(event.target.value.replace(/\D/g, "").slice(0, 6))
          }
          className="text-center font-display text-4xl tracking-[0.4em]"
        />
        {stage.message && (
          <p role="alert" className="text-sm text-destructive">
            {t(stage.message)}
          </p>
        )}
        <Button className="w-full" disabled={busy || pin.length !== 6}>
          {t("unlock")}
        </Button>
        {stage.staff && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={busy}
            onClick={() => void unlock(null)}
          >
            {t("scoreHere")}
          </Button>
        )}
        <p className="text-sm text-muted-foreground">{t("takeOverNote")}</p>
      </form>
    );
  if (stage.setup.sport === "basketball")
    return (
      <BasketballScorebook
        supabase={supabase}
        store={store}
        setup={stage.setup}
        log={stage.log}
        openedOffline={stage.offline}
      />
    );
  return null;
}
