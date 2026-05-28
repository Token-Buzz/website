import { describe, test, expect } from 'vitest'
import { formatPrice, formatBuzz, displaySymbol } from './tickerFormat'

describe('displaySymbol', () => {
  test('strips leading $ from symbol', () => {
    expect(displaySymbol('$SOL')).toBe('SOL')
  })
  test('leaves symbol without $ unchanged', () => {
    expect(displaySymbol('PEPE')).toBe('PEPE')
  })
})

describe('formatPrice', () => {
  test('null returns em dash', () => {
    expect(formatPrice(null)).toBe('—')
  })
  test('zero returns $0', () => {
    expect(formatPrice(0)).toBe('$0')
  })
  test('negative returns $0', () => {
    expect(formatPrice(-1)).toBe('$0')
  })
  test('price >= 1: 182.40', () => {
    expect(formatPrice(182.40)).toBe('$182.40')
  })
  test('price >= 1: 2.41', () => {
    expect(formatPrice(2.41)).toBe('$2.41')
  })
  test('small: 0.092', () => {
    expect(formatPrice(0.092)).toBe('$0.092')
  })
  test('small: 0.171', () => {
    expect(formatPrice(0.171)).toBe('$0.171')
  })
  test('small: 0.0041', () => {
    expect(formatPrice(0.0041)).toBe('$0.0041')
  })
  test('small: 0.0000182', () => {
    expect(formatPrice(0.0000182)).toBe('$0.0000182')
  })
  test('small: 0.000033', () => {
    expect(formatPrice(0.000033)).toBe('$0.000033')
  })
  test('small: 0.00000176', () => {
    expect(formatPrice(0.00000176)).toBe('$0.00000176')
  })
})

describe('formatBuzz', () => {
  test('positive: 4.12 -> buzz +412%', () => {
    expect(formatBuzz(4.12)).toBe('buzz +412%')
  })
  test('negative: -0.18 -> buzz −18% (unicode minus)', () => {
    expect(formatBuzz(-0.18)).toBe('buzz −18%')
  })
  test('zero: 0 -> buzz +0%', () => {
    expect(formatBuzz(0)).toBe('buzz +0%')
  })
})
