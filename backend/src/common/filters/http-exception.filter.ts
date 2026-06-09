import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_ERROR';
    let details: unknown = undefined;

    // Handle different exception types
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const responseObj = exceptionResponse as Record<string, unknown>;
        message = (responseObj.message as string) || message;
        code = (responseObj.code as string) || this.getCodeFromStatus(status);
        details = responseObj.details;
      }
    } else if (exception instanceof ZodError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Validation error';
      code = 'VALIDATION_ERROR';
      details = exception.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message,
      }));
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      status = this.handlePrismaError(exception);
      message = this.getPrismaMessage(exception);
      code = 'DATABASE_ERROR';
    } else if (exception instanceof Error) {
      // Log unexpected errors
      this.logger.error(
        `Unexpected error: ${exception.message}`,
        exception.stack,
        {
          path: request.url,
          method: request.method,
        },
      );
      message = process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : exception.message;
    }

    const errorResponse: Record<string, unknown> = {
      success: false,
      error: {
        code,
        message,
      },
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (details) {
      errorResponse.error = { ...errorResponse.error, details };
    }

    response.status(status).json(errorResponse);
  }

  private getCodeFromStatus(status: number): string {
    const statusCodeMap: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'VALIDATION_ERROR',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_ERROR',
    };
    return statusCodeMap[status] || 'UNKNOWN_ERROR';
  }

  private handlePrismaError(exception: Prisma.PrismaClientKnownRequestError): number {
    // P2002 = Unique constraint violation
    if (exception.code === 'P2002') return HttpStatus.CONFLICT;
    // P2025 = Record not found
    if (exception.code === 'P2025') return HttpStatus.NOT_FOUND;
    return HttpStatus.BAD_REQUEST;
  }

  private getPrismaMessage(exception: Prisma.PrismaClientKnownRequestError): string {
    if (exception.code === 'P2002') {
      return 'A record with this value already exists';
    }
    if (exception.code === 'P2025') {
      return 'The requested record was not found';
    }
    return 'Database operation failed';
  }
}
