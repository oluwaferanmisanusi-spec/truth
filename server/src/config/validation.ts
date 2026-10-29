// Turns schema failures on @Body/@Query/@Param({ schema }) into one 400 response with a
// message per field, e.g. { message: 'Check the form', fieldErrors: { email: 'Enter an email' } },
// so the website can show each message under its field.
import {
  BadRequestException,
  StandardSchemaValidationPipe,
} from '@nestjs/common';
import { z } from 'zod';

type Issue = {
  message: string;
  path?: readonly (PropertyKey | { key: PropertyKey })[];
};

function toException(issues: readonly Issue[]) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const field =
      issue.path
        ?.map((p) => String(typeof p === 'object' ? p.key : p))
        .join('.') || '_';
    fieldErrors[field] ??= issue.message;
  }
  return new BadRequestException({ message: 'Check the form', fieldErrors });
}

export const validationPipe = new StandardSchemaValidationPipe({
  exceptionFactory: toException,
});

/** Validates inside a service, for input that only needs checking in some cases. */
export function parseOrThrow<T extends z.ZodType>(
  schema: T,
  value: unknown,
): z.output<T> {
  const result = schema.safeParse(value);
  if (!result.success) throw toException(result.error.issues);
  return result.data;
}

/** Database ids. guid, not uuid: the seed data's ids aren't random version-4 uuids. */
export const Id = z.guid('Not a valid id');
/** "YYYY-MM-DD" */
export const IsoDate = z.iso.date('Use a date like 2026-10-24');

/** A person's name, with runs of spaces squeezed to one. */
export const FullName = z
  .string('Enter your full name')
  .trim()
  .transform((s) => s.replace(/\s+/g, ' '))
  .pipe(
    z
      .string()
      .min(1, 'Enter your full name')
      .max(100, 'Enter a name of 100 characters or fewer'),
  );

export const Email = z
  .string('Enter an email address like name@example.com')
  .trim()
  .toLowerCase()
  .regex(
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    'Enter an email address like name@example.com',
  );

/** 72 is the most bcrypt (Supabase's password hashing) reads. */
export const NewPassword = z
  .string('Enter a password')
  .min(8, 'Use at least 8 characters')
  .max(72, 'Use 72 characters or fewer');

/** The secret part of an emailed link (32 random bytes, base64url). */
export const LinkToken = z
  .string()
  .regex(/^[\w-]{20,100}$/, 'Not a valid link');
