import { demoResponse } from '@/src/core/ai/iris/demo';

describe('demoResponse', () => {
  it('introduces itself for identity questions', () => {
    expect(demoResponse('who are you?')).toContain('IRIS');
  });

  it('routes weather queries to the weather branch', () => {
    expect(demoResponse('will it rain in Boston?')).toContain('Boston');
  });

  it('routes flight-status queries to the flight branch', () => {
    // "flight"/"gate" keep working even though 'status' was removed from this branch.
    expect(demoResponse('what is my flight status?')).toContain('DL2244');
    expect(demoResponse('any gate status?')).toContain('Gate B27');
  });

  it('routes loyalty-status queries to the loyalty branch (regression: status collision)', () => {
    // Before the fix, 'status' in the earlier flight branch stole these.
    expect(demoResponse('what is my medallion status?')).toContain('SkyMiles');
    expect(demoResponse('check my loyalty status')).toContain('SkyMiles');
  });

  it('falls back for an unmatched prompt', () => {
    expect(demoResponse('qwzx nonsense foobar')).toContain("I'm IRIS");
  });
});
