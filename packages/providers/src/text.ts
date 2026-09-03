// Campo textual que a API devolve como "" quando não tem valor. Vira null, que
// é o que os DTOs entendem por ausente — "" reprovaria em `min(1)`.
export function nullIfEmpty(value: string | undefined | null): string | null {
  return value === undefined || value === null || value === "" ? null : value;
}
