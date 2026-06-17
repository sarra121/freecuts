import { describe, it, expect } from 'vitest'
import { timerValueSeconds, formatTimer } from './timer-format'

describe('timerValueSeconds', () => {
  it('counts up from the offset', () => {
    expect(timerValueSeconds('up', 90, 0, 10)).toBe(100)
  })

  it('clamps negative elapsed (playhead before clip)', () => {
    expect(timerValueSeconds('up', 90, 0, -5)).toBe(90)
  })

  it('counts down to zero and stops', () => {
    expect(timerValueSeconds('down', 0, 60, 20)).toBe(40)
    expect(timerValueSeconds('down', 0, 60, 80)).toBe(0)
  })
})

describe('formatTimer', () => {
  it('mm:ss uses total minutes (match clock can exceed 60)', () => {
    expect(formatTimer(90 * 60, 'mm:ss')).toBe('90:00')
    expect(formatTimer(45 * 60 + 7, 'mm:ss')).toBe('45:07')
  })

  it('hh:mm:ss rolls minutes into hours', () => {
    expect(formatTimer(3661, 'hh:mm:ss')).toBe('01:01:01')
  })

  it('mm:ss:cc includes centiseconds', () => {
    expect(formatTimer(65.42, 'mm:ss:cc')).toBe('01:05:42')
  })

  it('ss:cc and ss', () => {
    expect(formatTimer(5.5, 'ss:cc')).toBe('05:50')
    expect(formatTimer(125, 'ss')).toBe('125')
  })

  it('never goes negative', () => {
    expect(formatTimer(-10, 'mm:ss')).toBe('00:00')
  })
})
