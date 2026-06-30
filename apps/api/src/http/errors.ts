export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function notFound(message = "Not found"): never {
  throw new HttpError(404, message);
}

export function badRequest(message = "Bad request"): never {
  throw new HttpError(400, message);
}

export function unauthorized(message = "Unauthorized"): never {
  throw new HttpError(401, message);
}

export function forbidden(message = "Forbidden"): never {
  throw new HttpError(403, message);
}

export function serviceUnavailable(message = "Service unavailable"): never {
  throw new HttpError(503, message);
}
