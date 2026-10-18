import { ConsentRecord } from './consent-record.entity.js';
import { ConsentTemplate } from './consent-template.entity.js';
import { InvalidConsentError } from './consent.errors.js';

function template(): ConsentTemplate {
  return ConsentTemplate.create({
    key: 'extraccion',
    title: 'Consentimiento informado: extracción dental',
    body: 'Yo, {{paciente}}, autorizo {{procedimiento}}.',
  });
}

describe('ConsentRecord', () => {
  it('freezes the template snapshot at acceptance time', () => {
    const source = template();

    const record = ConsentRecord.create({
      template: source,
      patientId: 'patient-1',
      patientName: 'Camila Rojas Pérez',
      patientRut: '12345678-5',
      procedure: '  Extracción pieza 3.6 ',
      acceptorName: '  Camila Rojas ',
      recordedBy: 'user-1',
    });

    expect(record.templateId).toBe(source.id);
    expect(record.templateKey).toBe('extraccion');
    expect(record.templateVersion).toBe(1);
    expect(record.title).toBe(source.title);
    expect(record.body).toBe(source.body);
    expect(record.procedure).toBe('Extracción pieza 3.6');
    expect(record.acceptorName).toBe('Camila Rojas');
  });

  it('keeps the snapshot even if the template is edited afterwards', () => {
    const source = template();
    const record = ConsentRecord.create({
      template: source,
      patientId: 'patient-1',
      patientName: 'Camila Rojas Pérez',
      patientRut: '12345678-5',
      acceptorName: 'Camila Rojas',
      recordedBy: 'user-1',
    });

    source.update({ body: 'Nuevo texto' });

    expect(record.templateVersion).toBe(1);
    expect(record.body).toBe('Yo, {{paciente}}, autorizo {{procedimiento}}.');
  });

  it('rejects an empty acceptor name', () => {
    expect(() =>
      ConsentRecord.create({
        template: template(),
        patientId: 'patient-1',
        patientName: 'Camila Rojas Pérez',
        patientRut: '12345678-5',
        acceptorName: '   ',
        recordedBy: 'user-1',
      }),
    ).toThrow(InvalidConsentError);
  });

  it('stores no procedure when it is blank', () => {
    const record = ConsentRecord.create({
      template: template(),
      patientId: 'patient-1',
      patientName: 'Camila Rojas Pérez',
      patientRut: '12345678-5',
      procedure: '   ',
      acceptorName: 'Camila Rojas',
      recordedBy: 'user-1',
    });

    expect(record.procedure).toBeNull();
  });
});
