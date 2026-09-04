import { SetMetadata } from "@nestjs/common";

/** Chave de metadado lida pelo AuthGuard. */
export const IS_PUBLIC = "farol:public";

/**
 * Abre uma rota (ou um controller inteiro) para quem não está autenticado.
 *
 * O AuthGuard é global: sem este decorator, toda rota exige credencial. É a
 * inversão do arranjo anterior, em que cada controller precisava lembrar do
 * @UseGuards — e esquecer publicava a rota em silêncio. Agora abrir é uma linha
 * explícita, que aparece no diff e no code review.
 */
export const Public = () => SetMetadata(IS_PUBLIC, true);
