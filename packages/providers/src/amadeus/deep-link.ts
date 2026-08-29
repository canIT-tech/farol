// Substitui {placeholders} de um template de deep link. Chave desconhecida vira "".
export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_whole, key: string) => values[key] ?? "");
}
