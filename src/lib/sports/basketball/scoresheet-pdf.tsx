import "server-only";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { GameRecord } from "@/lib/game-record";
import { sides, type FoulKind, type Side } from "./events";
import { boxScore, timeoutGroup } from "./reducer";
import { scoresheetMarks } from "./scoresheet-data";

type Translate = (
  key: string,
  values?: Record<string, string | number>,
) => string;

const foulLetter: Record<FoulKind, string> = {
  personal: "P",
  technical: "T",
  unsportsmanlike: "U",
  disqualifying: "D",
};

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 8, fontFamily: "Helvetica", color: "#14213d" },
  title: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  muted: { color: "#555" },
  row: { flexDirection: "row" },
  header: {
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  final: { fontSize: 18, fontFamily: "Helvetica-Bold", textAlign: "right" },
  team: { marginTop: 8, borderWidth: 1, borderColor: "#14213d", padding: 6 },
  teamTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  th: {
    fontFamily: "Helvetica-Bold",
    borderBottomWidth: 1,
    borderColor: "#14213d",
    paddingBottom: 2,
  },
  cell: { paddingVertical: 1.5 },
  box: {
    width: 12,
    height: 11,
    borderWidth: 0.75,
    borderColor: "#14213d",
    marginRight: 1.5,
    textAlign: "center",
    fontSize: 7,
    paddingTop: 1.5,
  },
  section: { marginTop: 8 },
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
    marginTop: 18,
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
  name: { width: "30%" },
  starter: { width: "6%", textAlign: "center" as const },
  fouls: { width: "28%" },
  minutes: { width: "6%", textAlign: "right" as const },
  points: { width: "8%", textAlign: "right" as const },
  shots: { width: "16%", textAlign: "right" as const },
};

function TeamPanel({
  record,
  side,
  label,
  fouls,
  t,
}: {
  record: GameRecord;
  side: Side;
  label: string;
  fouls: ReturnType<typeof scoresheetMarks>["fouls"][Side];
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
              {row.disqualified ? ` (${t(row.disqualified)})` : ""}
            </Text>
            <Text style={col.starter}>{row.starter ? "X" : ""}</Text>
            <View style={[col.fouls, styles.row]}>
              {Array.from(
                { length: Math.max(rules.foulOut, marks.length) },
                (_, i) => (
                  <Text key={i} style={styles.box}>
                    {marks[i]
                      ? `${foulLetter[marks[i].kind]}${marks[i].period}`
                      : ""}
                  </Text>
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
      <Text style={styles.muted}>
        {t("totals", {
          points: totals.points,
          fouls: totals.fouls,
          bench: team.benchTechnicals,
        })}
        {team.coachEjected ? ` · ${t("coachEjected")}` : ""}
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
}: {
  record: GameRecord;
  when: string;
  approvedAt: string;
  t: Translate;
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
                {marks.running[side].map((mark, index) => (
                  <Text key={index} style={styles.runningCell}>
                    {mark.total} #{mark.jersey}
                  </Text>
                ))}
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
            {officials?.timekeeper || "—"}
          </Text>
          <Text style={[styles.muted, { marginTop: 4 }]}>
            {t("approved", { date: approvedAt })} · {t("legend")}
          </Text>
        </View>

        <View style={styles.signatures} wrap={false}>
          <Text style={styles.signature}>{t("refereeSignature")}</Text>
          <Text style={styles.signature}>
            {t("captainSignature", { team: teamNames.home })}
          </Text>
          <Text style={styles.signature}>
            {t("captainSignature", { team: teamNames.away })}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
