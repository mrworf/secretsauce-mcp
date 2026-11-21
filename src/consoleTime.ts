// UI-only time conversion; stored/exported instants and explicit UTC schedules are unchanged.
export function consoleTimeZone(): string { return Intl.DateTimeFormat().resolvedOptions().timeZone; }
export function formatConsoleDate(value: number | string, zone = consoleTimeZone()): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat(undefined, {timeZone: zone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', fractionalSecondDigits:3, timeZoneName:'shortOffset'}).format(date)+' ['+zone+']';
}
export function localDateInput(value: number): string {
  const d = new Date(value), pad = (n: number, width = 2) => String(n).padStart(width,'0');
  if (!Number.isFinite(d.getTime())) throw Error('Enter a valid date and time.');
  return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes())+':'+pad(d.getSeconds())+'.'+pad(d.getMilliseconds(),3);
}
export function parseLocalDateInput(value: string): number | undefined {
  if (!value) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(value);
  if (!match) throw Error('Enter a valid local date and time.');
  const [,year,month,day,hour,minute,second='00',fraction='0'] = match;
  const canonical = year+'-'+month+'-'+day+'T'+hour+':'+minute+':'+second+'.'+fraction.padEnd(3,'0');
  const time = new Date(canonical).getTime();
  if (!Number.isFinite(time) || localDateInput(time)!==canonical) throw Error('This local date or time does not exist. Choose a valid time in '+consoleTimeZone()+'.');
  for (const delta of [-7200000,-3600000,-1800000,1800000,3600000,7200000]) if (localDateInput(time+delta)===canonical) throw Error('This local time occurs twice. Choose an unambiguous time in '+consoleTimeZone()+'.');
  return time;
}
export const consoleTimeScript = [consoleTimeZone,formatConsoleDate,localDateInput,parseLocalDateInput].map(fn=>fn.toString()).join('\n');
