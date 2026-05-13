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
});
