import { type ArgumentsHost, Catch, type ExceptionFilter, HttpStatus } from "@nestjs/common";
import { DomainError } from "@farol/shared";

// Mapeia os erros de domínio (@farol/shared) para status HTTP.
// Os demais erros seguem para o filtro padrão do Nest.
const STATUS_BY_CODE: Record<string, number> = {
  not_found: HttpStatus.NOT_FOUND,
  forbidden: HttpStatus.FORBIDDEN,
  validation: HttpStatus.BAD_REQUEST,
  no_destinations_in_budget: HttpStatus.UNPROCESSABLE_ENTITY,
  no_destination_chosen: HttpStatus.UNPROCESSABLE_ENTITY,
  llm_invalid_output: HttpStatus.BAD_GATEWAY
};

interface ResponseLike {
  status: (code: number) => { json: (body: unknown) => void };
}

@Catch(DomainError)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainError, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<ResponseLike>();
    const status = STATUS_BY_CODE[exception.code] ?? HttpStatus.BAD_REQUEST;
    res.status(status).json({ statusCode: status, code: exception.code, message: exception.message });
  }
}
