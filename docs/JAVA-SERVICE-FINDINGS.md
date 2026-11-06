# Findings from the Java service

Inspected on **2026-09-11** in the local checkout at
`/Users/darot/IdeaProjects/billon`. These findings describe the source code. The live
database structure still needs to be checked against a restored production backup
before changeover.

## Password hashes

The Java application uses BCrypt. `SecurityConfig.java` constructs a
`BCryptPasswordEncoder`, and `AuthService.java` uses the injected `PasswordEncoder`
for registration and authentication. Migrated rows are therefore labelled
`spring-bcrypt`; successful first sign-in verifies the existing hash and replaces it
with the current Billon bcrypt hash.

Source evidence:

- `src/main/java/com/billon/shared/config/SecurityConfig.java`
- `src/main/java/com/billon/identity/service/AuthService.java`

Three inherited accounts must still pass the private restored-data sign-in check.
Their emails, passwords, and hashes are supplied through protected CI settings and
must never be committed.

## Send behavior

Send emails the invoice PDF to the client. `InvoiceService.sendInvoice` changes the
invoice to `SENT`, renders the PDF, and invokes `EmailService.sendInvoiceEmail`.
`EmailService` creates a multipart message with one `<invoice number>.pdf` attachment
and sends it through the configured mail provider.

The old call is asynchronous and catches mail errors, so it can report `SENT` even if
delivery fails. The replacement deliberately strengthens this: it returns success
and commits `SENT` only after the provider accepts the message. A real-inbox test is
still required before release.

Source evidence:

- `src/main/java/com/billon/invoice/service/InvoiceService.java`
- `src/main/java/com/billon/shared/service/EmailService.java`
- `src/main/resources/application-prod.yml`

## Logo storage

Logos are stored in the old `users.logo_url` text column as a PNG or JPEG data URL.
`UserService.uploadLogo` base64-encodes the uploaded bytes and saves that string;
`PdfGenerationService` decodes the same string for the invoice document. The mover
reads `logo_url`, validates the data URL, and stores its decoded bytes and MIME type
in PostgreSQL.

Source evidence:

- `src/main/java/com/billon/identity/model/User.java`
- `src/main/java/com/billon/identity/service/UserService.java`
- `src/main/java/com/billon/pdf/service/PdfGenerationService.java`

## Source-code table mapping

The JPA entities declare `users`, `clients`, `invoices`, and
`invoice_line_items`. Named invoice taxes are JSON in `invoices.tax_entries`, not a
separate table. The invoice note column is `note`. `scripts/migrate/legacy-schema.ts`
matches these annotations.

Source evidence:

- `src/main/java/com/billon/identity/model/User.java`
- `src/main/java/com/billon/client/model/Client.java`
- `src/main/java/com/billon/invoice/model/Invoice.java`
- `src/main/java/com/billon/invoice/model/InvoiceLineItem.java`
- `src/main/java/com/billon/invoice/model/TaxEntryConverter.java`

## Still required from a restored database

Before running the mover, record `\dt` and `\d` output for all four tables, actual
status values, nullability, row counts, logo counts, and samples of tax JSON. Compare
them with `scripts/migrate/legacy-schema.ts`. This remains a blocking release-evidence
item because source annotations do not prove that production schema drift never
occurred.
