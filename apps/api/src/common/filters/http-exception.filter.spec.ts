import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { AllExceptionsFilter } from './http-exception.filter';

function makeFilter(isProd: boolean) {
  const filter = new AllExceptionsFilter();
  jest.spyOn(filter as any, 'isProd', 'get').mockReturnValue(isProd);
  return filter;
}

function makeCtx(statusFn = jest.fn(), jsonFn = jest.fn()) {
  return {
    switchToHttp: () => ({
      getResponse: () => ({ status: statusFn, json: jsonFn }),
      getRequest: () => ({ method: 'GET', url: '/test' }),
    }),
  } as any;
}

describe('AllExceptionsFilter', () => {
  beforeEach(() => jest.spyOn(Logger.prototype, 'error').mockImplementation());
  afterEach(() => jest.restoreAllMocks());

  describe('in production', () => {
    it('returns sanitized message for HttpException 4xx', () => {
      const filter = makeFilter(true);
      const statusFn = jest.fn().mockReturnThis();
      const jsonFn = jest.fn();
      const ctx = makeCtx(statusFn, jsonFn);
      filter.catch(new HttpException('Email already registered', HttpStatus.CONFLICT), ctx);
      expect(statusFn).toHaveBeenCalledWith(409);
      expect(jsonFn).toHaveBeenCalledWith({ statusCode: 409, message: 'Email already registered' });
    });

    it('returns generic message for unexpected 5xx errors', () => {
      const filter = makeFilter(true);
      const statusFn = jest.fn().mockReturnThis();
      const jsonFn = jest.fn();
      const ctx = makeCtx(statusFn, jsonFn);
      filter.catch(new Error('DB connection failed'), ctx);
      expect(statusFn).toHaveBeenCalledWith(500);
      expect(jsonFn).toHaveBeenCalledWith({ statusCode: 500, message: 'Internal server error' });
    });

    it('hides internal message for HttpException 5xx', () => {
      const filter = makeFilter(true);
      const statusFn = jest.fn().mockReturnThis();
      const jsonFn = jest.fn();
      const ctx = makeCtx(statusFn, jsonFn);
      filter.catch(new HttpException('DB error details', HttpStatus.INTERNAL_SERVER_ERROR), ctx);
      expect(statusFn).toHaveBeenCalledWith(500);
      expect(jsonFn).toHaveBeenCalledWith({ statusCode: 500, message: 'Internal server error' });
    });

    it('returns first message from validation array', () => {
      const filter = makeFilter(true);
      const statusFn = jest.fn().mockReturnThis();
      const jsonFn = jest.fn();
      const ctx = makeCtx(statusFn, jsonFn);
      const exc = new HttpException({ message: ['field is required', 'must be a string'], error: 'Bad Request' }, HttpStatus.BAD_REQUEST);
      filter.catch(exc, ctx);
      expect(statusFn).toHaveBeenCalledWith(400);
      expect(jsonFn).toHaveBeenCalledWith({ statusCode: 400, message: 'field is required' });
    });
  });

  describe('in development', () => {
    it('includes stack trace for unexpected errors', () => {
      const filter = makeFilter(false);
      const statusFn = jest.fn().mockReturnThis();
      const jsonFn = jest.fn();
      const ctx = makeCtx(statusFn, jsonFn);
      const err = new Error('something broke');
      filter.catch(err, ctx);
      expect(statusFn).toHaveBeenCalledWith(500);
      const call = jsonFn.mock.calls[0][0] as Record<string, unknown>;
      expect(call).toHaveProperty('stack');
    });
  });

  describe('logger behavior', () => {
    it('calls logger.error for 5xx', () => {
      const filter = makeFilter(false);
      const logSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      const statusFn = jest.fn().mockReturnThis();
      const ctx = makeCtx(statusFn, jest.fn());
      filter.catch(new Error('boom'), ctx);
      expect(logSpy).toHaveBeenCalledTimes(1);
      logSpy.mockRestore();
    });

    it('does not call logger.error for 4xx', () => {
      const filter = makeFilter(false);
      const logSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      const statusFn = jest.fn().mockReturnThis();
      const ctx = makeCtx(statusFn, jest.fn());
      filter.catch(new HttpException('not found', HttpStatus.NOT_FOUND), ctx);
      expect(logSpy).not.toHaveBeenCalled();
      logSpy.mockRestore();
    });
  });
});
