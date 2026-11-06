import { readFile, unlink } from 'node:fs/promises'
import type { NextApiRequest } from 'next'
import formidable from 'formidable'
import { badRequest } from '@/server/http/errors'
import { MAX_LOGO_BYTES, TOO_LARGE_MESSAGE, WRONG_TYPE_MESSAGE } from './logo'

/**
 * Unpacking the one file the settings page sends.
 *
 * Next.js does not unpack a form upload by itself, so the address that takes a logo
 * turns Next's own body reading off and this reads the bytes out instead. Whatever
 * the form library complains about is turned into a sentence the settings page can
 * put in front of a person.
 */

export interface UploadedFile {
  bytes: Buffer
  mimeType: string
  fileName: string
}

export async function readUploadedFile(
  req: NextApiRequest,
  fieldName = 'file'
): Promise<UploadedFile> {
  const form = formidable({
    maxFiles: 1,
    maxFileSize: MAX_LOGO_BYTES,
    keepExtensions: true,
    multiples: false,
  })

  const parsed = await form.parse(req).catch((error: unknown) => {
    throw badRequest(describeFormFailure(error))
  })

  const uploaded = parsed[1][fieldName]
  const file = Array.isArray(uploaded) ? uploaded[0] : uploaded
  if (!file) throw badRequest('No file arrived with that upload. Please choose one and try again.')

  try {
    const bytes = await readFile(file.filepath)
    return {
      bytes,
      mimeType: file.mimetype ?? 'application/octet-stream',
      fileName: file.originalFilename ?? 'upload',
    }
  } finally {
    // The temporary copy has served its purpose; the picture lives in the database.
    await unlink(file.filepath).catch(() => undefined)
  }
}

function describeFormFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (/maxFileSize|maxTotalFileSize|too big|exceeded/i.test(message)) return TOO_LARGE_MESSAGE
  if (/type|mime/i.test(message)) return WRONG_TYPE_MESSAGE
  return 'That upload could not be read. Please try again.'
}
