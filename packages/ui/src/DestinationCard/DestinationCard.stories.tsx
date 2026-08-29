import { DestinationCard } from "./DestinationCard";

export default { title: "DestinationCard", component: DestinationCard };

export const Featured = () => (
  <div style={{ width: 340 }}>
    <DestinationCard
      city="Cartagena"
      country="Colômbia"
      matchValue={94}
      rationale="Praia e um centro histórico que é, ele mesmo, um roteiro gastronômico."
      featured
      stats={[
        { label: "Clima", value: "31°" },
        { label: "Voo", value: "5h direto" },
        { label: "Total", value: "R$ 4,1k" }
      ]}
      onSeeItinerary={() => {}}
      onToggleSave={() => {}}
    />
  </div>
);
