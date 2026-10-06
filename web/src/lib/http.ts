import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError } from "@/lib/api";

export class HttpError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

export function route(handler: Handler) {
  return async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
    try {
      return await handler(req, ctx);
    } catch (error) {
      if (error instanceof HttpError) return fail(error.message, error.status);
      // The API's own answer (wrong password, expired token, not found...) -
      // pass it through instead of masking it as a crash.
      if (error instanceof ApiError) {
        return fail(error.message, error.status >= 200 && error.status <= 599 ? error.status : 503);
      }
      if (error instanceof ZodError) return fail(error.issues[0]?.message || "Please check your details.", 400);
      console.error(error);
      return fail("Something went wrong. Please try again.", 500);
    }
  };
}

export async function readJson<T = unknown>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError("Please check your details.", 400);
  }
}
