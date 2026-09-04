import type { CorsOptions } from "@nestjs/common/interfaces/external/cors-options.interface";

/** Lista separada por vírgula → origens. Espaço e entrada vazia caem fora. */
export function parseOrigins(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin !== "");
}

/**
 * Política de CORS a partir da env.
 *
 * O padrão é fechado, e isso é de propósito: em produção a api e o web rodam no
 * mesmo processo e na mesma origem (SERVE_WEB=true, NEXT_PUBLIC_API_URL=/api),
 * então nenhuma requisição cross-origin é legítima. A lista existe para o
 * desenvolvimento, onde o web está em :3000 e a api em :3333.
 *
 * `credentials: false` sempre: a credencial viaja no header Authorization, não
 * em cookie. Aceitar cookie de outra origem seria abrir CSRF sem ganhar nada.
 */
export function corsOptions(raw: string | undefined): CorsOptions {
  const origins = parseOrigins(raw);
  if (origins.length === 0) {
    return { origin: false };
  }
  return { origin: origins, credentials: false };
}
