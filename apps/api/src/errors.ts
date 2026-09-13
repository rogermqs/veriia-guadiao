export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function requireValue<T>(
  value: T,
  code = "RESOURCE_NOT_FOUND",
  message = "Recurso não encontrado neste espaço.",
): NonNullable<T> {
  if (value === null || value === undefined)
    throw new AppError(code, message, 404);
  return value as NonNullable<T>;
}
