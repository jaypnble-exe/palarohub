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
import { Icon } from "@/components/ui/icon";

/** The calm full-screen frame for the scorebook's first screens. */
function Frame({ children }: { children: React.ReactNode }) {
  const t = useTranslations("Scorer");
  return (
    <div className="flex min-h-full flex-col bg-navy text-on-dark">
      <div className="flex items-center gap-2.5 px-5 py-4">
        <span
          aria-hidden="true"
          className="grid size-9 place-items-center rounded-xl bg-primary text-white"
        >
          <Icon name="games" className="size-5" />
        </span>
        <span className="font-display text-2xl font-bold tracking-wide uppercase">
          {t("pageTitle")}
        </span>
      </div>
      <div className="flex flex-1 items-start justify-center px-4 pb-10 sm:items-center">
        <div className="w-full max-w-md rounded-3xl bg-background p-6 text-foreground shadow-2xl sm:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
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
      reopenComment: string | null;
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
  /** Signed in with an account (league staff), not an anonymous scorer device. */
  const [staff, setStaff] = useState(false);

  /** Merges server events with unsent actions saved on this device. */
  const ready = useCallback(
    async (
      setup: ScorerSetup,
      server: readonly BasketballEvent[],
      offline: boolean,
      reopenComment: string | null = null,
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
      return { kind: "ready", setup, log, offline, reopenComment };
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
    // A reopened game tells the scorer what to fix.
    const reopened =
      parsed.data.status === "in_progress"
        ? await supabase
            .from("game_reviews")
            .select("action,comment")
            .eq("game_id", gameId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : null;
    const reopenComment =
      reopened?.data?.action === "reopened" ? reopened.data.comment : null;
    try {
      await store.saveSetup(gameId, setup.data);
      await store.saveServerEvents(gameId, events);
    } catch {
      /* Without device storage the game still works online. */
    }
    return ready(
      parsed.data,
      events as BasketballEvent[],
      false,
      reopenComment,
    );
  }, [supabase, gameId, store, ready]);

  /** Whether this device is the game's official scorer right now. */
  const isScorer = useCallback(
    async (userId: string) => {
      const { data, error } = await supabase
        .from("game_scorers")
        .select("user_id")
        .eq("game_id", gameId)
        .eq("user_id", userId)
        .is("revoked_at", null)
        .maybeSingle();
      return !error && Boolean(data);
    },
    [supabase, gameId],
  );

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
      setStaff(!user.is_anonymous);
      const first = await fromServer();
      if (first === "offline") return offline();
      // Staff can open any game, but only the official scorer device records.
      // A game still open for scoring asks first, so opening it never takes
      // over from the scorer at the table by accident.
      if (
        first?.kind === "ready" &&
        !user.is_anonymous &&
        ["scheduled", "in_progress"].includes(first.setup.status) &&
        !(await isScorer(user.id))
      )
        return show({ kind: "pin", staff: true, message: "staffNotScorer" });
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
  }, [supabase, fromServer, fromDevice, claim, isScorer]);

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
        staff: stage.kind === "pin" ? stage.staff : staff,
      });
  }

  /** After another device took over: staff take it back, a scorer needs a new PIN. */
  function takeOver() {
    setPin("");
    if (staff) void unlock(null);
    else setStage({ kind: "pin", staff: false, message: "replacedNeedPin" });
  }

  if (stage.kind === "loading")
    return (
      <Frame>
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <span className="grid size-16 animate-pulse place-items-center rounded-full bg-orange-soft text-orange-dark motion-reduce:animate-none">
            <Icon name="games" className="size-8" />
          </span>
          <p role="status" className="text-lg font-semibold">
            {t("opening")}
          </p>
        </div>
      </Frame>
    );
  if (stage.kind === "error")
    return (
      <Frame>
        <div className="space-y-5 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-destructive-soft text-destructive">
            <Icon name="alert" className="size-7" />
          </span>
          <p role="alert" className="text-lg font-semibold">
            {t(stage.message)}
          </p>
          <Button
            type="button"
            className="w-full"
            onClick={() => window.location.reload()}
          >
            {t("tryAgain")}
          </Button>
        </div>
      </Frame>
    );
  if (stage.kind === "pin")
    return (
      <Frame>
        <form
          className="space-y-5"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void unlock(pin);
          }}
        >
          <div className="space-y-2 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-orange-soft text-orange-dark">
              <Icon name={stage.staff ? "games" : "lock"} className="size-7" />
            </span>
            <h1 className="font-display text-3xl font-semibold tracking-wide uppercase">
              {t(stage.staff ? "staffTitle" : "enterPinTitle")}
            </h1>
            {!stage.staff && (
              <p className="text-muted-foreground">{t("enterPinHelp")}</p>
            )}
          </div>
          {stage.message && (
            <p
              role={stage.message === "staffNotScorer" ? undefined : "alert"}
              className={
                stage.message === "staffNotScorer"
                  ? "rounded-xl bg-accent p-3 text-sm font-semibold"
                  : "rounded-xl bg-destructive-soft p-3 text-sm font-semibold text-destructive"
              }
            >
              {t(stage.message)}
            </p>
          )}
          {/* League staff score with their account; the PIN is for scorer devices. */}
          {stage.staff && (
            <>
              <Button
                type="button"
                className="min-h-14 w-full text-lg"
                disabled={busy}
                onClick={() => void unlock(null)}
              >
                {t(busy ? "checkingPin" : "scoreHere")}
              </Button>
              <p className="border-t pt-4 text-center text-sm font-semibold text-muted-foreground">
                {t("orEnterPin")}
              </p>
            </>
          )}
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
            placeholder="••••••"
            autoFocus={!stage.staff}
            className="min-h-20 text-center font-display text-5xl tracking-[0.35em] placeholder:text-border"
          />
          <Button
            variant={stage.staff ? "outline" : "default"}
            className="min-h-14 w-full text-lg"
            disabled={busy || pin.length !== 6}
          >
            {t(busy && !stage.staff ? "checkingPin" : "unlock")}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {t("takeOverNote")}
          </p>
        </form>
      </Frame>
    );
  if (stage.setup.sport === "basketball")
    return (
      <BasketballScorebook
        supabase={supabase}
        store={store}
        setup={stage.setup}
        log={stage.log}
        openedOffline={stage.offline}
        reopenComment={stage.reopenComment}
        onTakeOver={takeOver}
      />
    );
  return null;
}
