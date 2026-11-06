import { z } from 'zod'
import { emailField, optionalText, requiredText } from './common'

/**
 * What a client may be created or changed with.
 *
 * The account is never among these fields: it comes from the sign-in token, so an
 * `accountId` planted in a request is simply dropped along with everything else the
 * checker was not told about.
 */

export const createClientSchema = z.object({
  name: requiredText("the client's name", 200),
  email: emailField('the client'),
  companyName: optionalText(200),
  addressLine1: optionalText(200),
  addressLine2: optionalText(200),
  city: optionalText(120),
  postcode: optionalText(30),
  country: optionalText(120),
})

export const updateClientSchema = createClientSchema

export type CreateClientInput = z.infer<typeof createClientSchema>
export type UpdateClientInput = z.infer<typeof updateClientSchema>
