import { prefixWithUnit, SizeUnit } from '../../src/util/unitPrefix';
import { expect } from 'chai';

describe('prefixWithUnit', () => {
  it('Return expected value for various units', () => {
    expect(prefixWithUnit(1000, SizeUnit.B)).to.eq('1000 B');
    expect(prefixWithUnit(1000, SizeUnit.KB)).to.eq('1 KB');
    expect(prefixWithUnit(1000, SizeUnit.MB)).to.eq('0.001 MB');
    expect(prefixWithUnit(1000, SizeUnit.GB)).to.eq('0.000001 GB');
    expect(prefixWithUnit(1000, SizeUnit.TB)).to.eq('1e-9 TB');
  })
});
