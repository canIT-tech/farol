import { Icon } from "./Icon";
import { iconNames } from "./icons";
export default { title: "Icon", component: Icon };
export const All = () => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
    {iconNames.map((n) => (
      <div key={n} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: 72 }}>
        <Icon name={n} size={24} />
        <span style={{ fontSize: 10 }}>{n}</span>
      </div>
    ))}
  </div>
);
