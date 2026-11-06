import { describe, it, expect } from 'vitest'
import { ok, fail, parsePageParams, buildPage } from '../helpers/contract'

/**
 * The wrapper every reply arrives in, and the page shape every list arrives in.
 *
 * The screens read exactly these keys and nothing else. Getting one wrong does not
 * throw anywhere — it renders a blank page in a browser, which is why it is worth
 * a test at this level rather than trusting each handler.
 */

describe('the reply wrapper', () => {
  it('says success, carries a message and carries the data', () => {
    const reply = ok({ id: 7 }, 'Client created')
    expect(reply).toEqual({ status: 'success', message: 'Client created', data: { id: 7 } })
    expect(Object.keys(reply).sort()).toEqual(['data', 'message', 'status'])
  })

  it('says error, carries a message and carries no data', () => {
    const reply = fail('That invoice cannot be deleted once it has been sent')
    expect(reply.status).toBe('error')
    expect(reply.message).toBe('That invoice cannot be deleted once it has been sent')
    expect(reply.data).toBeNull()
    expect(Object.keys(reply).sort()).toEqual(['data', 'message', 'status'])
  })

  it('uses null rather than leaving data out, because the screens read res.data.data', () => {
    const reply = ok(null)
    expect('data' in reply).toBe(true)
    expect(reply.data).toBeNull()
  })
})

describe('reading the paging the screens send', () => {
  it('defaults to the first page when nothing is asked for', () => {
    const params = parsePageParams({})
    expect(params.page).toBe(0)
    expect(params.size).toBeGreaterThan(0)
  })

  it("understands the clients page's sort of 'name,asc'", () => {
    expect(parsePageParams({ sort: 'name,asc' }).sort).toEqual({ field: 'name', direction: 'asc' })
  })

  it("understands the invoices page's sort of 'createdAt,desc'", () => {
    expect(parsePageParams({ sort: 'createdAt,desc' }).sort).toEqual({
      field: 'createdAt',
      direction: 'desc',
    })
  })

  it('reads page and size as numbers, not as the strings a web address gives', () => {
    const params = parsePageParams({ page: '2', size: '100' })
    expect(params.page).toBe(2)
    expect(params.size).toBe(100)
  })

  it('refuses to sort by a field nobody may sort by', () => {
    // A sort field goes into a query. It must be checked against a known list.
    expect(() => parsePageParams({ sort: 'passwordHash,asc' })).toThrow()
  })

  it('caps the size, so nobody can ask for every invoice at once', () => {
    expect(parsePageParams({ size: '100000' }).size).toBeLessThanOrEqual(200)
  })
})

describe('the page shape a list arrives in', () => {
  it('carries content, page, size, totalElements, totalPages, first and last', () => {
    const page = buildPage([{ id: 1 }, { id: 2 }], { page: 1, size: 2, totalElements: 5 })
    expect(Object.keys(page).sort()).toEqual([
      'content',
      'first',
      'last',
      'page',
      'size',
      'totalElements',
      'totalPages',
    ])
    expect(page.content).toHaveLength(2)
    expect(page.page).toBe(1)
    expect(page.size).toBe(2)
    expect(page.totalElements).toBe(5)
    expect(page.totalPages).toBe(3)
    expect(page.first).toBe(false)
    expect(page.last).toBe(false)
  })

  it('marks the first page first and the last page last', () => {
    expect(buildPage([{ id: 1 }], { page: 0, size: 2, totalElements: 5 }).first).toBe(true)
    expect(buildPage([{ id: 5 }], { page: 2, size: 2, totalElements: 5 }).last).toBe(true)
  })

  it('calls an empty result both first and last, with no pages', () => {
    const page = buildPage([], { page: 0, size: 20, totalElements: 0 })
    expect(page.content).toEqual([])
    expect(page.totalElements).toBe(0)
    expect(page.totalPages).toBe(0)
    expect(page.first).toBe(true)
    expect(page.last).toBe(true)
  })
})
