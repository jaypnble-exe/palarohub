import "server-only";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { GameRecord } from "@/lib/game-record";
import { sides, type FoulKind, type Side } from "./events";
import { boxScore, timeoutGroup } from "./reducer";
import { scoresheetMarks, type FoulMark } from "./scoresheet-data";
import { formatClock } from "./live-score";

type Translate = (
  key: string,
  values?: Record<string, string | number>,
) => string;

const foulLetter: Record<FoulKind, string> = {
  personal: "P",
  technical: "T",
  unsportsmanlike: "U",
  disqualifying: "D",
  fighting: "F",
};

/** "P2" with the quarter under it, as written in a foul box. */
function FoulBox({ mark, letter }: { mark?: FoulMark; letter?: string }) {
  return (
    <View style={styles.box}>
      <Text style={{ fontSize: 7 }}>
        {mark
          ? `${letter ?? foulLetter[mark.kind]}${mark.freeThrows || ""}`
          : ""}
      </Text>
      <Text style={{ fontSize: 4.5, color: "#555" }}>
        {mark ? `Q${mark.period}` : ""}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    padding: 20,
    fontSize: 7.5,
    fontFamily: "Helvetica",
    color: "#14213d",
  },
  title: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  muted: { color: "#555" },
  row: { flexDirection: "row" },
  header: {
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  final: { fontSize: 18, fontFamily: "Helvetica-Bold", textAlign: "right" },
  team: { marginTop: 5, borderWidth: 1, borderColor: "#14213d", padding: 5 },
  teamTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  th: {
    fontFamily: "Helvetica-Bold",
    borderBottomWidth: 1,
    borderColor: "#14213d",
    paddingBottom: 2,
  },
  cell: { paddingVertical: 0.5 },
  box: {
    width: 15,
    height: 13,
    borderWidth: 0.75,
    borderColor: "#14213d",
    marginRight: 1.5,
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
  },
  section: { marginTop: 5 },
  sectionTitle: { fontFamily: "Helvetica-Bold", fontSize: 9, marginBottom: 3 },
  runningCell: {
    width: 26,
    borderWidth: 0.5,
    borderColor: "#999",
    padding: 1.5,
    marginRight: 1,
    marginBottom: 1,
    fontSize: 6.5,
  },
  signatures: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  signature: {
    width: "30%",
    borderTopWidth: 0.75,
    borderColor: "#14213d",
    paddingTop: 3,
  },
});

const col = {
  jersey: { width: "6%" },
  name: { width: "28%" },
  starter: { width: "6%", textAlign: "center" as const },
  fouls: { width: "30%" },
  minutes: { width: "6%", textAlign: "right" as const },
  points: { width: "8%", textAlign: "right" as const },
  shots: { width: "16%", textAlign: "right" as const },
};

function TeamPanel({
  record,
  side,
  label,
  fouls,
  benchFouls,
  t,
}: {
  record: GameRecord;
  side: Side;
  label: string;
  fouls: ReturnType<typeof scoresheetMarks>["fouls"][Side];
  benchFouls: ReturnType<typeof scoresheetMarks>["bench"][Side];
  t: Translate;
}) {
  const { rules, state } = record;
  const team = state.teams[side];
  const { rows, totals } = boxScore(state, side);
  const foulPeriods = Array.from({ length: rules.quarters }, (_, i) => i + 1);
  const timeoutGroups = [
    ...new Set(
      Array.from({ length: Math.max(state.period, rules.quarters) }, (_, i) =>
        timeoutGroup(i + 1, rules),
      ),
    ),
  ];
  return (
    <View style={styles.team} wrap={false}>
      <Text style={styles.teamTitle}>
        {label}: {record.teamNames[side]} — {team.score}
      </Text>
      <Text style={[styles.muted, { marginBottom: 3 }]}>
        {t("coach")}: {team.coach || "—"} · {t("assistantCoach")}:{" "}
        {team.assistantCoach || "—"}
      </Text>
      <View style={[styles.row, styles.th]}>
        <Text style={col.jersey}>{t("no")}</Text>
        <Text style={col.name}>{t("player")}</Text>
        <Text style={col.starter}>{t("starter")}</Text>
        <Text style={col.fouls}>{t("fouls")}</Text>
        <Text style={col.minutes}>{t("minutes")}</Text>
        <Text style={col.points}>{t("points")}</Text>
        <Text style={col.shots}>{t("shots")}</Text>
      </View>
      {rows.map((row) => {
        const marks = fouls[row.playerId] ?? [];
        return (
          <View key={row.playerId} style={[styles.row, styles.cell]}>
            <Text style={col.jersey}>{row.jersey}</Text>
            <Text style={col.name}>
              {row.name}
              {team.captainId === row.playerId ? ` (${t("captainShort")})` : ""}
              {row.disqualified ? ` (${t(row.disqualified)})` : ""}
            </Text>
            {/* X: started. x: came in later. */}
            <Text style={col.starter}>
              {row.starter
                ? "X"
                : team.players[row.playerId]?.entered
                  ? "x"
                  : ""}
            </Text>
            <View style={[col.fouls, styles.row]}>
              {Array.from(
                { length: Math.max(rules.foulOut, marks.length) },
                (_, i) => (
                  <FoulBox key={i} mark={marks[i]} />
                ),
              )}
            </View>
            <Text style={col.minutes}>{row.minutes}</Text>
            <Text style={col.points}>{row.points}</Text>
            <Text style={col.shots}>
              {row.fieldGoals.made}/{row.fieldGoals.attempted} ·{" "}
              {row.threePointers.made}/{row.threePointers.attempted} ·{" "}
              {row.freeThrows.made}/{row.freeThrows.attempted}
            </Text>
          </View>
        );
      })}
      <View style={[styles.row, { marginTop: 4 }]}>
        <Text style={{ width: "50%" }}>
          {t("teamFouls")}:{" "}
          {foulPeriods
            .map((period) => `Q${period} ${team.teamFouls[period] ?? 0}`)
            .join("  ")}
        </Text>
        <Text style={{ width: "50%", textAlign: "right" }}>
          {t("timeouts")}:{" "}
          {timeoutGroups
            .map(
              (group) =>
                `${t(group.startsWith("overtime") ? "overtimeShort" : group)} ${team.timeoutsUsed[group] ?? 0}`,
            )
            .join("  ")}
        </Text>
      </View>
      {team.timeouts.length > 0 && (
        <Text style={styles.muted}>
          {t("timeoutTimes")}:{" "}
          {team.timeouts
            .map(
              (timeout) =>
                `${timeout.period <= rules.quarters ? `Q${timeout.period}` : `OT${timeout.period - rules.quarters}`} ${formatClock(timeout.clockMs)}`,
            )
            .join(" · ")}
        </Text>
      )}
      <View style={[styles.row, { marginTop: 3, alignItems: "center" }]}>
        <Text style={{ width: "28%" }}>{t("coachFouls")}</Text>
        <View style={styles.row}>
          {Array.from({ length: Math.max(3, benchFouls.length) }, (_, i) => {
            const mark = benchFouls[i];
            return (
              <FoulBox
                key={i}
                mark={mark}
                letter={
                  mark
                    ? mark.kind === "technical"
                      ? mark.offender === "coach"
                        ? "C"
                        : "B"
                      : foulLetter[mark.kind]
                    : undefined
                }
              />
            );
          })}
        </View>
      </View>
      <Text style={styles.muted}>
        {t("totals", {
          points: totals.points,
          fouls: totals.fouls,
          bench: team.benchTechnicals,
        })}
        {team.coachEjected ? ` · ${t("coachEjected")}` : ""}
        {team.shotClockViolations
          ? ` · ${t("shotClockViolations", { count: team.shotClockViolations })}`
          : ""}
      </Text>
    </View>
  );
}

/** The official scoresheet in the familiar paper layout, built from approved events. */
export function BasketballScoresheet({
  record,
  when,
  approvedAt,
  t,
  time = (iso) => iso.slice(11, 16),
}: {
  record: GameRecord;
  when: string;
  approvedAt: string;
  t: Translate;
  /** Clock time of day, e.g. "7:02 PM", in the league's time zone. */
  time?: (iso: string) => string;
}) {
  const { state, rules, teamNames } = record;
  const marks = scoresheetMarks(state, record.events);
  const periods = Array.from(
    { length: Math.max(state.period, rules.quarters) },
    (_, i) => i + 1,
  );
  const periodLabel = (period: number) =>
    period <= rules.quarters ? `Q${period}` : `OT${period - rules.quarters}`;
  const officials = state.officials;
  const winner = state.winner ? teamNames[state.winner] : "";
  return (
    <Document title={t("documentTitle", teamNames)} author={record.leagueName}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{record.leagueName}</Text>
            <Text>{t("heading")}</Text>
            <Text style={styles.muted}>
              {record.seasonName} · {record.divisionName}
            </Text>
            <Text style={styles.muted}>
              {when}
              {record.game.venue ? ` · ${record.game.venue}` : ""}
            </Text>
            <Text style={styles.muted}>
              {t("startEnd", {
                start: state.startedAt ? time(state.startedAt) : "—",
                end: state.endedAt ? time(state.endedAt) : "—",
              })}
            </Text>
          </View>
          <View>
            <Text style={styles.final}>
              {state.teams.home.score} – {state.teams.away.score}
            </Text>
            <Text style={{ textAlign: "right" }}>
              {t("winner", { team: winner })}
            </Text>
          </View>
        </View>

        {sides.map((side) => (
          <TeamPanel
            key={side}
            record={record}
            side={side}
            label={t(side === "home" ? "teamA" : "teamB")}
            fouls={marks.fouls[side]}
            benchFouls={marks.bench[side]}
            t={t}
          />
        ))}

        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>{t("scoreByPeriod")}</Text>
          <View style={[styles.row, styles.th]}>
            <Text style={{ width: "30%" }}>{t("team")}</Text>
            {periods.map((period) => (
              <Text
                key={period}
                style={{ width: `${60 / periods.length}%`, textAlign: "right" }}
              >
                {periodLabel(period)}
              </Text>
            ))}
            <Text style={{ width: "10%", textAlign: "right" }}>
              {t("final")}
            </Text>
          </View>
          {sides.map((side) => (
            <View key={side} style={[styles.row, styles.cell]}>
              <Text style={{ width: "30%" }}>{teamNames[side]}</Text>
              {periods.map((period) => (
                <Text
                  key={period}
                  style={{
                    width: `${60 / periods.length}%`,
                    textAlign: "right",
                  }}
                >
                  {state.teams[side].pointsByPeriod[period] ?? 0}
                </Text>
              ))}
              <Text
                style={{
                  width: "10%",
                  textAlign: "right",
                  fontFamily: "Helvetica-Bold",
                }}
              >
                {state.teams[side].score}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("runningScore")}</Text>
          {sides.map((side) => (
            <View key={side} style={{ marginBottom: 4 }}>
              <Text style={styles.muted}>{teamNames[side]}</Text>
              <View style={[styles.row, { flexWrap: "wrap" }]}>
                {marks.running[side].map((mark, index) => {
                  const next = marks.running[side][index + 1];
                  // Each period's last score is underlined, as on paper.
                  const last = !next || next.period !== mark.period;
                  return (
                    <Text
                      key={index}
                      style={[
                        styles.runningCell,
                        last
                          ? { borderBottomWidth: 2, borderColor: "#14213d" }
                          : {},
                      ]}
                    >
                      {mark.total} {mark.points === 1 ? "•" : ""}
                      {mark.points === 3 ? "(" : ""}
                      {mark.jersey}
                      {mark.points === 3 ? ")" : ""}
                    </Text>
                  );
                })}
              </View>
            </View>
          ))}
        </View>

        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>{t("officials")}</Text>
          <Text>
            {t("referees")}: {officials?.referees.join(", ") || "—"}
          </Text>
          <Text>
            {t("scorer")}: {officials?.scorer || "—"} · {t("timekeeper")}:{" "}
            {officials?.timekeeper || "—"} · {t("shotClockOperator")}:{" "}
            {officials?.shotClockOperator || "—"}
          </Text>
          <Text>
            {t("arrowAtEnd", {
              team: state.possession ? teamNames[state.possession] : "—",
            })}
          </Text>
          <Text style={[styles.muted, { marginTop: 4 }]}>
            {t("approved", { date: approvedAt })} · {t("legend")}
          </Text>
        </View>

        <View style={styles.signatures} wrap={false}>
          {(
            [
              ["referee", t("refereeSignature")],
              ["homeCaptain", t("captainSignature", { team: teamNames.home })],
              ["awayCaptain", t("captainSignature", { team: teamNames.away })],
            ] as const
          ).map(([role, label]) => {
            const confirmed = state.confirmations.find(
              (entry) => entry.role === role,
            );
            return (
              <View key={role} style={styles.signature}>
                <Text>{label}</Text>
                {confirmed && (
                  <Text style={styles.muted}>
                    {t("confirmedDigitally", {
                      name: confirmed.name,
                      time: time(confirmed.at),
                    })}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
        {state.protests.map((protest, index) => (
          <Text
            key={index}
            style={{ marginTop: 6, fontFamily: "Helvetica-Bold" }}
          >
            {t("underProtest", { team: teamNames[protest.team] })}
            {protest.note ? `: ${protest.note}` : ""}
          </Text>
        ))}
      </Page>
    </Document>
  );
}
