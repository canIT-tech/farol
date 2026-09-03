import type { HotelOffer, ItineraryItem } from "@farol/shared";

const EARTH_RADIUS_M = 6_371_000;
/** Acima disto não é "a pé", e prometer caminhada seria mentira. */
export const WALKABLE_METERS = 1200;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// Haversine. Distância em linha reta serve aqui: a promessa do cartão é
// "perto do roteiro", não um tempo de caminhada exato.
export function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

// "4 paradas a pé" — quantas paradas do roteiro ficam a distância caminhável do
// hotel. Sem coordenada no hotel ou no roteiro, devolve null e o cartão omite a
// linha; nenhum número é inventado.
export function walkingNote(offer: HotelOffer, items: ItineraryItem[]): string | null {
  if (offer.lat === null || offer.lng === null) {
    return null;
  }
  const hotel = { lat: offer.lat, lng: offer.lng };
  const near = items.filter(
    (item) =>
      item.lat !== null &&
      item.lng !== null &&
      distanceMeters(hotel, { lat: item.lat, lng: item.lng }) <= WALKABLE_METERS
  );
  if (near.length === 0) {
    return null;
  }
  return near.length === 1 ? "1 parada a pé" : `${near.length} paradas a pé`;
}
