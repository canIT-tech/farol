import { MatchBadge, MatchBar } from "./Match";

export default { title: "Match", component: MatchBadge };

export const Badge = () => <MatchBadge value={94} />;
export const Bar = () => (
  <div style={{ width: 240 }}>
    <MatchBar value={85} />
  </div>
);
