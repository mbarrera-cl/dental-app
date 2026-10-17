import { InvalidTelefonoError } from '../../../shared/domain/persona.errors.js';
import { Rut } from '../../../shared/domain/rut.vo.js';
import { Telefono } from '../../../shared/domain/telefono.vo.js';
import { Email } from './email.vo.js';
import { FechaNacimiento } from './fecha-nacimiento.vo.js';
import { Patient, type PatientProps } from './patient.entity.js';
import {
  InvalidEmailError,
  InvalidFechaNacimientoError,
  InvalidPatientNameError,
  InvalidPrevisionError,
  InvalidSexoError,
} from './patient.errors.js';
import { Prevision } from './prevision.vo.js';

describe('Patient', () => {
  const validProps = {
    rut: '12.345.678-5',
    nombres: 'Camila',
    apellidoPaterno: 'Rojas',
    apellidoMaterno: 'Pérez',
    fechaNacimiento: '1990-05-17',
    sexo: 'femenino',
  };

  const persistedProps: PatientProps = {
    rut: Rut.create('12345678-5'),
    nombres: 'Camila',
    apellidoPaterno: 'Rojas',
    apellidoMaterno: 'Pérez',
    fechaNacimiento: FechaNacimiento.create('1990-05-17'),
    sexo: 'femenino',
    email: Email.create('camila@example.com'),
    telefono: Telefono.create('+56912345678'),
    direccion: null,
    prevision: Prevision.create({ tipo: 'FONASA', tramo: 'B' }),
    contactoEmergencia: null,
    notas: 'Alergia a la penicilina',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  it('normalizes the rut and names on create', () => {
    const patient = Patient.create({
      ...validProps,
      nombres: '  Camila ',
      apellidoPaterno: ' Rojas',
      apellidoMaterno: 'Pérez ',
    });

    expect(patient.rut).toBe('12345678-5');
    expect(patient.nombres).toBe('Camila');
    expect(patient.apellidoPaterno).toBe('Rojas');
    expect(patient.apellidoMaterno).toBe('Pérez');
    expect(patient.nombreCompleto).toBe('Camila Rojas Pérez');
    expect(patient.createdAt).toBeInstanceOf(Date);
  });

  it('generates a unique id per patient', () => {
    expect(Patient.create(validProps).id).not.toBe(
      Patient.create(validProps).id,
    );
  });

  it('starts with every optional group empty', () => {
    const patient = Patient.create(validProps);

    expect(patient.email).toBeNull();
    expect(patient.telefono).toBeNull();
    expect(patient.direccion).toBeNull();
    expect(patient.prevision).toBeNull();
    expect(patient.contactoEmergencia).toBeNull();
    expect(patient.notas).toBeNull();
  });

  it('creates a patient with every optional group filled', () => {
    const patient = Patient.create({
      ...validProps,
      email: '  Camila@Example.COM ',
      telefono: '+56 9 1234 5678',
      direccion: {
        region: 'rm',
        comuna: 'Providencia',
        calle: 'Av. Providencia',
        numero: '1234',
        departamento: '  ',
      },
      prevision: { tipo: 'ISAPRE', plan: ' Consalud Plus ' },
      contactoEmergencia: {
        nombre: 'María Pérez',
        telefono: '987654321',
        parentesco: 'Madre',
      },
      notas: '  Bruxismo  ',
    });

    expect(patient.email).toBe('camila@example.com');
    expect(patient.telefono).toBe('+56912345678');
    expect(patient.direccion?.region).toBe('RM');
    expect(patient.direccion?.departamento).toBeNull();
    expect(patient.prevision?.plan).toBe('Consalud Plus');
    expect(patient.contactoEmergencia?.telefono).toBe('+56987654321');
    expect(patient.contactoEmergencia?.parentesco).toBe('Madre');
    expect(patient.notas).toBe('Bruxismo');
  });

  it('rejects invalid inputs with the matching domain error', () => {
    expect(() => Patient.create({ ...validProps, rut: '12345678-9' })).toThrow(
      expect.objectContaining({ name: 'InvalidRutError' }),
    );
    expect(() => Patient.create({ ...validProps, nombres: '   ' })).toThrow(
      InvalidPatientNameError,
    );
    expect(() =>
      Patient.create({ ...validProps, sexo: 'desconocido' }),
    ).toThrow(InvalidSexoError);
    expect(() =>
      Patient.create({ ...validProps, email: 'not-an-email' }),
    ).toThrow(InvalidEmailError);
    expect(() => Patient.create({ ...validProps, telefono: '123' })).toThrow(
      InvalidTelefonoError,
    );
    expect(() =>
      Patient.create({ ...validProps, prevision: { tipo: 'FONASA' } }),
    ).toThrow(InvalidPrevisionError);
  });

  describe('fecha de nacimiento', () => {
    it('rejects future dates', () => {
      expect(() =>
        Patient.create({ ...validProps, fechaNacimiento: '2999-01-01' }),
      ).toThrow(InvalidFechaNacimientoError);
    });

    it('rejects dates before 1900 and impossible calendar dates', () => {
      expect(() =>
        Patient.create({ ...validProps, fechaNacimiento: '1899-12-31' }),
      ).toThrow(InvalidFechaNacimientoError);
      expect(() =>
        Patient.create({ ...validProps, fechaNacimiento: '1990-02-30' }),
      ).toThrow(InvalidFechaNacimientoError);
      expect(() =>
        Patient.create({ ...validProps, fechaNacimiento: '17-05-1990' }),
      ).toThrow(InvalidFechaNacimientoError);
    });

    it('revalidates through the mutator', () => {
      const patient = Patient.create(validProps);

      patient.changeFechaNacimiento(FechaNacimiento.create('1985-12-01'));

      expect(patient.fechaNacimiento).toBe('1985-12-01');
    });
  });

  it('applies changes through mutators, re-validating invariants', () => {
    const patient = Patient.create(validProps);

    patient.changeNombres('  Camila Ignacia ');
    patient.changeApellidoPaterno('Rojas ');
    patient.changeSexo('otro');
    patient.changeEmail(Email.create('Camila.Ignacia@Example.com'));
    patient.changeTelefono(null);
    patient.changeNotas('   ');
    patient.changePrevision(Prevision.create({ tipo: 'FONASA', tramo: 'D' }));

    expect(patient.nombres).toBe('Camila Ignacia');
    expect(patient.sexo).toBe('otro');
    expect(patient.email).toBe('camila.ignacia@example.com');
    expect(patient.telefono).toBeNull();
    expect(patient.notas).toBeNull();
    expect(patient.prevision?.tramo).toBe('D');
    expect(() => patient.changeNombres('   ')).toThrow(InvalidPatientNameError);
    expect(() => patient.changeSexo('xyz')).toThrow(InvalidSexoError);
  });

  it('clears every optional group when null is passed', () => {
    const patient = Patient.create({
      ...validProps,
      email: 'camila@example.com',
      telefono: '9 1234 5678',
      notas: 'Control anual',
    });

    patient.changeEmail(null);
    patient.changeTelefono(null);
    patient.changeNotas(null);

    expect(patient.email).toBeNull();
    expect(patient.telefono).toBeNull();
    expect(patient.notas).toBeNull();
  });

  it('reconstitutes a persisted patient preserving every field', () => {
    const patient = Patient.reconstitute(persistedProps, 'fixed-id');

    expect(patient.id).toBe('fixed-id');
    expect(patient.rut).toBe('12345678-5');
    expect(patient.createdAt).toEqual(new Date('2026-01-01T00:00:00.000Z'));
    expect(patient.email).toBe('camila@example.com');
    expect(patient.prevision?.tipo).toBe('FONASA');
    expect(patient.prevision?.tramo).toBe('B');
    expect(patient.notas).toBe('Alergia a la penicilina');
  });
});
