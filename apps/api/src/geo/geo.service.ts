import { Inject, Injectable } from "@nestjs/common";
import type { GeoProvider } from "@farol/providers";
import {
  NotFoundError,
  type Airline,
  type Airport,
  type City,
  type GeoLocation
} from "@farol/shared";
import { GEO_PROVIDER } from "../providers/providers.module";

const DEFAULT_AIRPORT_LIMIT = 10;

@Injectable()
export class GeoService {
  constructor(@Inject(GEO_PROVIDER) private readonly provider: GeoProvider) {}

  // O /whereami só pré-preenche a origem no onboarding. Falhar ali não pode
  // travar a tela: IP desconhecido e provider fora do ar dão o mesmo null.
  async whereami(ip: string): Promise<GeoLocation | null> {
    try {
      return await this.provider.whereami(ip);
    } catch (err) {
      console.error(
        JSON.stringify({ event: "geo_whereami_failed", message: (err as Error).message })
      );
      return null;
    }
  }

  searchAirports(term: string, limit = DEFAULT_AIRPORT_LIMIT): Promise<Airport[]> {
    return this.provider.searchAirports(term, limit);
  }

  /** Igual a airport(), mas devolve null em vez de lançar — para enriquecimento. */
  findAirport(iata: string): Promise<Airport | null> {
    return this.provider.airport(iata);
  }

  /** Igual a airline(), mas devolve null em vez de lançar — para enriquecimento. */
  findAirline(code: string): Promise<Airline | null> {
    return this.provider.airline(code);
  }

  /** Cidade do IATA do destino: país e coordenada de centro para a busca de hotel. */
  findCity(iata: string): Promise<City | null> {
    return this.provider.city(iata);
  }

  async airport(iata: string): Promise<Airport> {
    const found = await this.findAirport(iata);
    if (found === null) {
      throw new NotFoundError(`aeroporto ${iata} não encontrado`);
    }
    return found;
  }

  async airline(code: string): Promise<Airline> {
    const found = await this.findAirline(code);
    if (found === null) {
      throw new NotFoundError(`companhia ${code} não encontrada`);
    }
    return found;
  }
}
