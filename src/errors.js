export class MpaiError extends Error {
  constructor(message, { code = "MPAI_ERROR", status = 500, cause } = {}) {
    super(message, { cause });
    this.name = "MpaiError";
    this.code = code;
    this.status = status;
  }
}

export function errorPayload(error) {
  return {
    error: {
      code: error?.code || "INTERNAL_ERROR",
      message: error?.message || "Unexpected error",
    },
  };
}
