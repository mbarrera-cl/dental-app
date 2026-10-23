import { FichaClinica } from './ficha-clinica.entity.js';
import { Finding } from './finding.entity.js';
import { computeIntegrityHash } from './integrity.js';

describe('computeIntegrityHash', () => {
  const record = () =>
    FichaClinica.create({ patientId: 'patient-1', categoria: '15-19', createdBy: 'user-1' });

  const finding = (tooth: number) =>
    Finding.create({
      recordId: 'record-1',
      tooth,
      surfaces: ['O'],
      symbol: 'caries',
      createdBy: 'user-1',
    });

  it('is deterministic for the same record and findings', () => {
    const r = record();
    const f = [finding(36), finding(46)];

    const a = computeIntegrityHash(r, f);
    const b = computeIntegrityHash(r, f);

    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('does not depend on the order of the findings', () => {
    const r = record();
    const f36 = finding(36);
    const f46 = finding(46);

    const a = computeIntegrityHash(r, [f36, f46]);
    const b = computeIntegrityHash(r, [f46, f36]);

    expect(a).toBe(b);
  });

  it('changes when a finding is added or a field changes', () => {
    const r = record();
    const f36 = finding(36);
    const f46 = finding(46);
    const base = computeIntegrityHash(r, [f36]);

    expect(computeIntegrityHash(r, [f36, f46])).not.toBe(base);

    const changed = record();
    changed.changeMotivoConsulta('Dolor en pieza 16');
    expect(computeIntegrityHash(changed, [f36])).not.toBe(base);
  });

  it('excludes voided findings from the seal', () => {
    const r = record();
    const f36 = finding(36);
    const active = computeIntegrityHash(r, [f36]);

    const voided = finding(46);
    voided.void('user-1');
    const withVoided = computeIntegrityHash(r, [f36, voided]);

    expect(withVoided).toBe(active);
  });
});
