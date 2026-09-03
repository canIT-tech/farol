import { FlightOfferCard } from "./FlightOfferCard";

export default { title: "FlightOfferCard", component: FlightOfferCard };

const base = {
  departAt: "2026-05-10T08:15:00-05:00",
  arriveAt: "2026-05-10T13:40:00-05:00",
  originIata: "GRU",
  originName: "São Paulo",
  destinationIata: "CTG",
  destinationName: "Cartagena",
  priceNote: "ida e volta / pessoa",
  deepLink: "https://www.aviasales.com/search/GRU1005CTG17052?marker=555",
  partnerName: "Aviasales",
  onSelect: () => {}
};

export const Recomendado = () => (
  <div style={{ width: 780, display: "grid", gap: 12 }}>
    <FlightOfferCard
      {...base}
      best
      carrier="AV"
      carrierName="Avianca"
      durationMinutes={325}
      stops={0}
      price="R$ 2.140"
    />
    <FlightOfferCard
      {...base}
      carrier="LA"
      carrierName="LATAM Airlines Group"
      arriveAt="2026-05-10T18:05:00-05:00"
      departAt="2026-05-10T10:50:00-05:00"
      durationMinutes={435}
      stops={1}
      price="R$ 1.980"
    />
    <FlightOfferCard
      {...base}
      carrier="CM"
      carrierName={null}
      departAt="2026-05-10T23:40:00-05:00"
      arriveAt="2026-05-11T07:20:00-05:00"
      durationMinutes={0}
      stops={1}
      price="R$ 1.760"
    />
  </div>
);
