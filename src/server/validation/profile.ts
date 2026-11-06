import { z } from 'zod'
import { currencyField, emailField, optionalText, requiredText } from './common'

/**
 * The settings page, and signing up.
 *
 * `invoiceNextNumber` is deliberately not among the settings fields. Only raising an
 * invoice moves that counter; accepting it here would let saving the settings page
 * re-issue a number that has already been used.
 */

export const updateProfileSchema = z.object({
  firstName: requiredText('a first name', 100),
  lastName: requiredText('a last name', 100),
  invoicePrefix: z
    .string({ required_error: 'Enter an invoice prefix, such as INV-.' })
    .trim()
    .max(20, 'That invoice prefix is too long.'),
  taxLabel: requiredText('a name for your tax, such as VAT', 60),
  defaultCurrency: currencyField,
  bankName: optionalText(200),
  bankAccountNumber: optionalText(60),
  bankSortCode: optionalText(30),
  paymentDetails: optionalText(2000),
})

export const registerSchema = z.object({
  email: emailField('your account'),
  password: z
    .string({ required_error: 'Choose a password.', invalid_type_error: 'Choose a password.' })
    .min(8, 'A password needs to be at least 8 characters.')
    .max(200, 'That password is too long.'),
  firstName: requiredText('a first name', 100),
  lastName: requiredText('a last name', 100),
})

export const loginSchema = z.object({
  email: z
    .string({ required_error: 'Enter your email address.', invalid_type_error: 'Enter your email address.' })
    .trim()
    .min(1, 'Enter your email address.'),
  password: z
    .string({ required_error: 'Enter your password.', invalid_type_error: 'Enter your password.' })
    .min(1, 'Enter your password.'),
})

export const forgotPasswordSchema = z.object({
  email: z
    .string({ required_error: 'Enter your email address.', invalid_type_error: 'Enter your email address.' })
    .trim()
    .min(1, 'Enter your email address.'),
})

export const resetPasswordSchema = z.object({
  token: z
    .string({ required_error: 'This reset link is not valid.', invalid_type_error: 'This reset link is not valid.' })
    .min(1, 'This reset link is not valid.'),
  newPassword: z
    .string({ required_error: 'Choose a password.', invalid_type_error: 'Choose a password.' })
    .min(8, 'A password needs to be at least 8 characters.')
    .max(200, 'That password is too long.'),
})

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
