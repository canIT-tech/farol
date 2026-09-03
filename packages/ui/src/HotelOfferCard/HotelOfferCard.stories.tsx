import { HotelOfferCard } from "./HotelOfferCard";

export default { title: "HotelOfferCard", component: HotelOfferCard };

export const Grade = () => (
  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 260px)", gap: 16 }}>
    <HotelOfferCard
      name="Casa del Arzobispado"
      region="Centro Histórico"
      walkingNote="4 paradas a pé"
      photoUrl="https://static.cupid.travel/hotels/1.jpg"
      rating={4.7}
      pricePerNight="R$ 320"
      deepLink="https://parceiro.example.com/1"
      onSelect={() => {}}
    />
    <HotelOfferCard
      name="Hotel Getsemaní 24"
      region="Getsemaní"
      rating={4.5}
      pricePerNight="R$ 240"
      deepLink="https://parceiro.example.com/2"
      onSelect={() => {}}
    />
    <HotelOfferCard
      name="Bocagrande Mar"
      rating={null}
      pricePerNight="R$ 280"
      deepLink="https://parceiro.example.com/3"
      onSelect={() => {}}
    />
  </div>
);
