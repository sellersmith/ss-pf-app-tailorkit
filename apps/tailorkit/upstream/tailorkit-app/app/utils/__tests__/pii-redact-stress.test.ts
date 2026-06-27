import { describe, it, expect } from 'vitest'
import { redactPii } from '~/utils/pii-redact.server'

/**
 * Stress test for `redactPii` ahead of shipping conversation-driven export
 * (EMTLKIT-5336 Phase 1). User input is higher-risk than assistant output:
 * shop URLs, emails, order IDs, customer PII, credit cards, IPs all leak here.
 *
 * Each case asserts the *exact* redacted output for the listed input.
 */

describe('redactPii — stress cases (EMTLKIT-5336 phase 1)', () => {
  const cases: Array<{ name: string; input: string; expected: string }> = [
    {
      name: 'shop url — bare myshopify.com',
      input: 'My store is acme-store.myshopify.com please help',
      expected: 'My store is [shop] please help',
    },
    {
      name: 'shop url — uppercase + hyphens',
      input: 'Check My-Cool-Shop.myshopify.com today',
      expected: 'Check [shop] today',
    },
    {
      name: 'email — plain',
      input: 'Contact me at long.pc+test@bravebits.co soon',
      expected: 'Contact me at [email] soon',
    },
    {
      name: 'email — multiple in one line',
      input: 'a@b.co and c+d@e.fg both used',
      expected: '[email] and [email] both used',
    },
    {
      name: 'order id — # prefix',
      input: 'Order #1234 missing item',
      expected: 'Order [order-id] missing item',
    },
    {
      name: 'order id — shopify gid',
      input: 'gid://shopify/Order/9876543210 cannot fulfill',
      expected: '[gid] cannot fulfill',
    },
    {
      name: 'phone — international with plus',
      input: 'Call +1 (415) 555-0123 urgently',
      expected: 'Call [phone] urgently',
    },
    {
      name: 'phone — dashes only',
      input: 'reach me 415-555-0123 please',
      expected: 'reach me [phone] please',
    },
    {
      name: 'phone — vietnam local',
      input: 'số 0901 234 567 nha',
      expected: 'số [phone] nha',
    },
    {
      name: 'credit card — visa spaced',
      input: 'card 4111 1111 1111 1111 declined',
      expected: 'card [card] declined',
    },
    {
      name: 'credit card — amex 15 digits',
      input: 'amex 3782 822463 10005 issue',
      expected: 'amex [card] issue',
    },
    {
      name: 'iban — german',
      input: 'pay to DE89370400440532013000 today',
      expected: 'pay to [iban] today',
    },
    {
      name: 'ipv4',
      input: 'origin 192.168.1.42 hitting api',
      expected: 'origin [ip] hitting api',
    },
    {
      name: 'url with email and shop — composite',
      input: 'see https://acme.myshopify.com/admin and email me at boss@acme.io about #12345',
      expected: 'see [url] and email me at [email] about [order-id]',
    },
  ]

  it.each(cases)('redacts: $name', ({ input, expected }) => {
    expect(redactPii(input)).toBe(expected)
  })

  it('returns falsy input unchanged', () => {
    expect(redactPii('')).toBe('')
  })

  it('leaves plain text untouched', () => {
    expect(redactPii('hello world, no PII here')).toBe('hello world, no PII here')
  })
})
