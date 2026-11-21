import {describe,it,expect} from 'vitest';
import {formatConsoleDate,localDateInput,parseLocalDateInput} from '../src/consoleTime.js';
describe('console local time presentation',()=>{
 it('identifies the browser-selected zone and distinguishes repeated DST instants',()=>{
  const a=formatConsoleDate('2026-11-01T08:30:00.123Z','America/Los_Angeles'),b=formatConsoleDate('2026-11-01T09:30:00.123Z','America/Los_Angeles');
  expect(a).toContain('America/Los_Angeles');expect(a).toContain('GMT-7');expect(b).toContain('GMT-8');expect(a).toContain('123');expect(a).not.toBe(b);expect(formatConsoleDate('invalid')).toBe('Unknown');
 });
 it('round-trips a valid local instant with milliseconds and rejects malformed/nonexistent calendar dates',()=>{
  const time=new Date(2026,6,15,12,34,56,789).getTime();expect(parseLocalDateInput(localDateInput(time))).toBe(time);expect(parseLocalDateInput('')).toBeUndefined();
  for(const value of ['2026-02-30T12:00','2026-01-01T24:00','2026-01-01T12:60','invalid','2026-01-01T12:00Z','2026-01-01T12:00:00.1234'])expect(()=>parseLocalDateInput(value)).toThrow();
 });
});
