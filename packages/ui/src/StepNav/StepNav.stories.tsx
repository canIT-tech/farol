import { StepNav } from "./StepNav";
export default { title: "StepNav", component: StepNav };
export const Default = () => (
  <div style={{ width: 220 }}>
    <StepNav
      onNavigate={() => {}}
      steps={[
        { id: "a", label: "Perfil de gosto", state: "done" },
        { id: "b", label: "Escolher destino", state: "current" },
        { id: "c", label: "Roteiro", state: "todo" },
        { id: "d", label: "Voo & hotel", state: "todo" }
      ]}
    />
  </div>
);
