"use client";
import { useTranslations } from "next-intl";
import {
  boxScore,
  sides,
  type BasketballGameState,
  type ShotLine,
  type Side,
} from "@/lib/sports/basketball";

const shots = (line: ShotLine) => `${line.made}-${line.attempted}`;

export function BoxScores({
  state,
  teamNames,
}: {
  state: BasketballGameState;
  teamNames: Record<Side, string>;
}) {
  const t = useTranslations("Scorer");
  return (
    <div className="space-y-4">
      {sides.map((side) => {
        const { rows, totals } = boxScore(state, side);
        return (
          <div
            key={side}
            className="overflow-x-auto rounded-2xl border bg-card"
          >
            <table className="w-full min-w-[520px] text-sm">
              <caption className="p-3 text-left text-lg font-semibold">
                {teamNames[side]}
              </caption>
              <thead>
                <tr className="border-y text-left">
                  <th className="p-2">#</th>
                  <th className="p-2">{t("box.player")}</th>
                  <th className="p-2 text-right">{t("box.minutes")}</th>
                  <th className="p-2 text-right">{t("box.points")}</th>
                  <th className="p-2 text-right">{t("box.fieldGoals")}</th>
                  <th className="p-2 text-right">{t("box.threes")}</th>
                  <th className="p-2 text-right">{t("box.freeThrows")}</th>
                  <th className="p-2 text-right">{t("box.fouls")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.playerId} className="border-b">
                    <td className="p-2">{row.jersey}</td>
                    <td className="p-2">
                      {row.name}
                      {row.disqualified && (
                        <span className="ml-1 text-destructive">
                          ({t(`alert.short.${row.disqualified}`)})
                        </span>
                      )}
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {row.minutes}
                    </td>
                    <td className="p-2 text-right font-semibold tabular-nums">
                      {row.points}
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {shots(row.fieldGoals)}
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {shots(row.threePointers)}
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {shots(row.freeThrows)}
                    </td>
                    <td className="p-2 text-right tabular-nums">{row.fouls}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="p-2" />
                  <td className="p-2">{t("box.total")}</td>
                  <td className="p-2" />
                  <td className="p-2 text-right tabular-nums">
                    {totals.points}
                  </td>
                  <td className="p-2 text-right tabular-nums">
                    {shots(totals.fieldGoals)}
                  </td>
                  <td className="p-2 text-right tabular-nums">
                    {shots(totals.threePointers)}
                  </td>
                  <td className="p-2 text-right tabular-nums">
                    {shots(totals.freeThrows)}
                  </td>
                  <td className="p-2 text-right tabular-nums">
                    {totals.fouls}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
