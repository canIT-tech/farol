import { Injectable, type PipeTransform } from "@nestjs/common";
import type { ZodSchema } from "zod";
import { ValidationError } from "@farol/shared";

// Valida o body contra um schema zod e devolve o valor já tipado.
// Falha vira ValidationError (→ 400 no DomainExceptionFilter).
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const detail = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      throw new ValidationError(`payload inválido: ${detail}`);
    }
    return result.data;
  }
}
