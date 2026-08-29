import { AdvisorChat } from "./AdvisorChat";
export default { title: "AdvisorChat", component: AdvisorChat };
export const Default = () => (
  <div style={{ height: 420, width: 340, border: "1px solid #eee" }}>
    <AdvisorChat
      onSend={() => {}}
      messages={[
        { id: "1", role: "assistant", content: "Montei 7 dias com foco em praia." },
        { id: "2", role: "user", content: "tira o dia de museu" },
        { id: "3", role: "assistant", content: "Feito — Dia 4 virou praia." }
      ]}
    />
  </div>
);
