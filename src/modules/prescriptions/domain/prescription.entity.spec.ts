import { InvalidPrescriptionError } from './prescription.errors.js';
import { Prescription } from './prescription.entity.js';

const BASE = {
  patientId: 'patient-1',
  patientName: 'Camila Rojas Pérez',
  patientRut: '12345678-5',
  issuedBy: 'user-1',
  issuedByName: 'Dra. Carolina Soto',
};

const ITEM = {
  medicamento: 'Amoxicilina 500 mg',
  dosis: '1 comprimido',
  frecuencia: 'Cada 8 horas',
  duracion: '7 días',
};

describe('Prescription', () => {
  it('creates a prescription with trimmed items', () => {
    const prescription = Prescription.create({
      ...BASE,
      items: [
        {
          medicamento: '  Amoxicilina 500 mg ',
          dosis: ' 1 comprimido ',
          frecuencia: ' Cada 8 horas ',
          duracion: ' 7 días ',
        },
      ],
      indicaciones: '  Con alimentos ',
    });

    expect(prescription.items).toHaveLength(1);
    expect(prescription.items[0]?.medicamento).toBe('Amoxicilina 500 mg');
    expect(prescription.items[0]?.duracion).toBe('7 días');
    expect(prescription.indicaciones).toBe('Con alimentos');
    expect(prescription.issuedAt).toEqual(prescription.createdAt);
  });

  it('rejects a prescription without medications', () => {
    expect(() => Prescription.create({ ...BASE, items: [] })).toThrow(
      InvalidPrescriptionError,
    );
  });

  it('rejects an empty medication field', () => {
    expect(() =>
      Prescription.create({
        ...BASE,
        items: [{ ...ITEM, medicamento: '   ' }],
      }),
    ).toThrow(InvalidPrescriptionError);
  });

  it('rejects an empty indications string only after trimming (becomes null)', () => {
    const prescription = Prescription.create({
      ...BASE,
      items: [ITEM],
      indicaciones: '   ',
    });

    expect(prescription.indicaciones).toBeNull();
  });

  it('rejects an empty professional name', () => {
    expect(() =>
      Prescription.create({ ...BASE, issuedByName: '  ', items: [ITEM] }),
    ).toThrow(InvalidPrescriptionError);
  });
});
