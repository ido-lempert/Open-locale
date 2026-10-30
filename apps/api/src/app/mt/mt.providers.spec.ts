import { driverFor } from './mt.providers';

describe('pseudo driver scoring', () => {
  const driver = driverFor('pseudo')!;

  it('scores 100 when every preserved token survives', async () => {
    const [out] = await driver.translate(['Hello {name}, you have %d messages'], 'en', 'he', {});
    expect(driver.score!('Hello {name}, you have %d messages', out)).toBe(100);
  });

  it('drops 20 per missing preserved token', () => {
    expect(driver.score!('Hello {name} at {place}', 'Hello {name}')).toBe(80);
  });

  it('drops for extra tokens and floors at 0', () => {
    expect(driver.score!('plain', '{a}{b}{c}{d}{e}{f}')).toBe(0);
  });

  it('scores empty-token sources 100', () => {
    expect(driver.score!('plain text', 'anything')).toBe(100);
  });
});
