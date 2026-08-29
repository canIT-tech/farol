import { Chip } from "./Chip";

export default { title: "Chip", component: Chip };

export const Filters = () => (
  <div style={{ display: "flex", gap: 8 }}>
    <Chip selected onClick={() => {}}>Todos</Chip>
    <Chip onClick={() => {}}>Só nacional</Chip>
    <Chip onClick={() => {}}>Sem escala</Chip>
  </div>
);
export const Tastes = () => (
  <div style={{ display: "flex", gap: 8 }}>
    <Chip tone="taste" selected onClick={() => {}}>Praia</Chip>
    <Chip tone="taste" onClick={() => {}}>Cultura</Chip>
  </div>
);
export const Info = () => <Chip>Ritmo moderado</Chip>;
