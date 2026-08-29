// Usuário autenticado, injetado pela api na camada de serviço (design §5.3 — autorização por userId).
export type CurrentUser = { id: string; email: string };
