import { AppShell } from "./AppShell";
export default { title: "AppShell", component: AppShell };
export const Default = () => (
  <AppShell sidebar={<div style={{ padding: 20 }}>Sidebar</div>} rail={<div style={{ padding: 20 }}>Assessor</div>}>
    <div style={{ padding: 20 }}>Conteúdo</div>
  </AppShell>
);
