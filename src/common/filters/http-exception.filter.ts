import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: any = 'Internal server error';
    let details: any = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const responsePayload = exception.getResponse();
      
      if (typeof responsePayload === 'string') {
        message = responsePayload;
      } else if (typeof responsePayload === 'object' && responsePayload !== null) {
        message = (responsePayload as any).message || message;
        details = (responsePayload as any).error || details;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    response
      .status(status)
      .json({
        success: false,
        statusCode: status,
        message: Array.isArray(message) ? message[0] : message,
        details: Array.isArray(message) ? message : details,
        timestamp: new Date().toISOString(),
        path: request.url,
      });
  }
}
