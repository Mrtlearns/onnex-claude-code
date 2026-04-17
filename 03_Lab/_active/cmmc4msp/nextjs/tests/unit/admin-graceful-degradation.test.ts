/**
 * admin-graceful-degradation.test.ts
 *
 * Verifies that the admin page uses errorPolicy: 'all' on all three queries
 * so partial data is returned even when the msp relationship or msps table
 * is not yet tracked in Hasura.
 *
 * These are import-level static analysis tests — they read the source and
 * assert the correct Apollo options are present. No DOM render needed.
 */
import fs from 'fs'
import path from 'path'

const ADMIN_PAGE = path.join(
  __dirname,
  '../../src/app/admin/page.tsx'
)

const source = fs.readFileSync(ADMIN_PAGE, 'utf-8')

describe('admin/page.tsx graceful error handling', () => {
  it('uses errorPolicy: all on GET_ADMIN_ORGS query', () => {
    // The useQuery call for orgs should opt in to partial data
    expect(source).toMatch(/GET_ADMIN_ORGS[\s\S]{0,200}errorPolicy:\s*['"]all['"]/)
  })

  it('uses errorPolicy: all on GET_ADMIN_USERS query', () => {
    expect(source).toMatch(/GET_ADMIN_USERS[\s\S]{0,200}errorPolicy:\s*['"]all['"]/)
  })

  it('uses errorPolicy: all on GET_ADMIN_MSPS query', () => {
    expect(source).toMatch(/GET_ADMIN_MSPS[\s\S]{0,200}errorPolicy:\s*['"]all['"]/)
  })

  it('renders a QueryErrorBanner component when queries fail', () => {
    expect(source).toContain('QueryErrorBanner')
  })

  it('degrades gracefully — org.msp?.name uses optional chaining', () => {
    // The msp relationship might not exist; accessing it must use optional chaining
    expect(source).toContain('org.msp?.name')
  })

  it('degrades gracefully — u.msp?.name uses optional chaining', () => {
    expect(source).toContain('u.msp?.name')
  })

  it('shows "Failed to load" message when orgs query errors and returns empty data', () => {
    expect(source).toContain('Failed to load orgs')
  })

  it('shows "Failed to load" message when users query errors and returns empty data', () => {
    expect(source).toContain('Failed to load users')
  })

  it('shows "Failed to load" message when msps query errors and returns empty data', () => {
    expect(source).toContain('Failed to load MSPs')
  })
})
