export class InflightLimiter {
  private total = 0;
  private readonly bySource = new Map<string, number>();

  constructor(private maxTotal: number, private maxPerSource: number) {}

  updateLimits(maxTotal:number,maxPerSource:number):void {if(!Number.isInteger(maxTotal)||!Number.isInteger(maxPerSource)||maxTotal<1||maxPerSource<1||maxPerSource>maxTotal)throw new Error('Invalid inflight limits');this.maxTotal=maxTotal;this.maxPerSource=maxPerSource;}
  stats(){return {total:this.total,largestSource:Math.max(0,...this.bySource.values()),sources:this.bySource.size};}
  acquire(source: string): (() => void) | undefined {
    const sourceCount = this.bySource.get(source) ?? 0;
    if (this.total >= this.maxTotal || sourceCount >= this.maxPerSource) return undefined;
    this.total += 1;
    this.bySource.set(source, sourceCount + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.total -= 1;
      const remaining = (this.bySource.get(source) ?? 1) - 1;
      if (remaining === 0) this.bySource.delete(source);
      else this.bySource.set(source, remaining);
    };
  }
}
