"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import {
  sides,
  shotClockApplies,
  type BasketballGameState,
  type BasketballRules,
  type Side,
} from "@/lib/sports/basketball";
import { Button } from "@/components/ui/button";
import type { RecordEvent } from "./board";

const subscribeToClient = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

/** Shot clock left now: it runs and stops with the game clock. */
export function useShotClock(state: BasketballGameState) {
  const [now, setNow] = useState(() => Date.now());
  const running = state.clock.running;
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 50);
    return () => window.clearInterval(timer);
  }, [running]);
  if (!running || !state.clock.asOf) return state.shotClock.remainingMs;
  const elapsed = Math.max(0, now - Date.parse(state.clock.asOf));
  return Math.max(0, state.shotClock.remainingMs - elapsed);
}

/** A short buzzer from the device speaker, when the browser allows sound. */
function buzz() {
  try {
    const AudioContext =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof window.AudioContext })
        .webkitAudioContext;
    if (!AudioContext) return;
    const context = new AudioContext();
    const tone = context.createOscillator();
    const volume = context.createGain();
    tone.type = "square";
    tone.frequency.value = 440;
    volume.gain.value = 0.15;
    tone.connect(volume).connect(context.destination);
    tone.start();
    tone.stop(context.currentTime + 0.9);
    tone.onended = () => void context.close();
  } catch {
    /* No sound on this device; the screen still shows the violation. */
  }
}

/**
 * Reset buttons, and the check at zero: the game clock stops and the scorer
 * confirms the violation, because only the referee can see if the ball hit
 * the rim or was already in the air.
 */
export function ShotClockControls({
  state,
  rules,
  remainingMs,
  gameClockMs,
  teamNames,
  record,
  disabled,
}: {
  state: BasketballGameState;
  rules: BasketballRules;
  remainingMs: number;
  gameClockMs: number;
  teamNames: Record<Side, string>;
  record: RecordEvent;
  disabled: boolean;
}) {
  const t = useTranslations("Scorer");
  const isClient = useSyncExternalStore(
    subscribeToClient,
    clientSnapshot,
    serverSnapshot,
  );
  const fired = useRef<string | null>(null);
  const enabled = state.phase === "live" && shotClockApplies(gameClockMs);
  const expired = enabled && state.clock.running && remainingMs <= 0;
  useEffect(() => {
    // Once per run of the shot clock (it resets with a new asOf or value).
    const run = `${state.clock.asOf}-${state.shotClock.remainingMs}`;
    if (!expired || fired.current === run || disabled) return;
    fired.current = run;
    record("clock_stop", {});
    buzz();
  }, [
    expired,
    disabled,
    record,
    state.clock.asOf,
    state.shotClock.remainingMs,
  ]);
  // At zero the scorer decides; a violation or a reset closes the question.
  const asking =
    enabled && !state.clock.running && state.shotClock.remainingMs <= 0;

  if (!enabled) return null;
  return (
    <>
      <div className="flex shrink-0 gap-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-14 px-3"
          disabled={disabled}
          onClick={() =>
            record("shot_clock", { seconds: rules.shotClock.seconds })
          }
        >
          {t("resetShotClock", { seconds: rules.shotClock.seconds })}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-14 px-3"
          disabled={disabled}
          onClick={() =>
            record("shot_clock", { seconds: rules.shotClock.resetSeconds })
          }
        >
          {t("resetShotClock", { seconds: rules.shotClock.resetSeconds })}
        </Button>
      </div>
      {/* Escape the sticky footer's backdrop-filter containing block. */}
      {asking &&
        isClient &&
        createPortal(
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
            role="alertdialog"
            aria-modal="true"
            aria-label={t("shotClockExpired")}
          >
            <div className="w-full max-w-lg space-y-4 rounded-3xl border-4 border-primary bg-background p-5 shadow-2xl">
              <h2 className="font-display text-3xl font-semibold tracking-wide uppercase">
                {t("shotClockExpired")}
              </h2>
              <p className="text-muted-foreground">
                {t("shotClockExpiredHelp")}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {sides.map((side) => (
                  <Button
                    key={side}
                    type="button"
                    className="min-h-16 text-lg"
                    onClick={() =>
                      record("shot_clock_violation", { team: side })
                    }
                  >
                    {t("violationBy", { team: teamNames[side] })}
                  </Button>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                className="min-h-14 w-full"
                onClick={() =>
                  record("shot_clock", { seconds: rules.shotClock.seconds })
                }
              >
                {t("noViolation")}
              </Button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
