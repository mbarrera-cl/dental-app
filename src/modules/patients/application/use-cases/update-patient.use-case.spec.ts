import { InMemoryPatientRepository } from '../../infrastructure/adapters/persistence/in-memory-patient.repository.js';
import {
  EmptyPatientUpdateError,
  InvalidTelefonoError,
  PatientAlreadyExistsError,
  PatientNotFoundError,
} from '../../domain/patient.errors.js';
import { CreatePatientUseCase } from './create-patient.use-case.js';
import { UpdatePatientUseCase } from './update-patient.use-case.js';

describe('UpdatePatientUseCase', () => {
  const setup = async () => {
    const patientRepository = new InMemoryPatientRepository();
    const patient = await new CreatePatientUseCase(patientRepository).execute({
      rut: '12.345.678-5',
      nombres: 'Camila',
      apellidoPaterno: 'Rojas',
      apellidoMaterno: 'Pérez',
      fechaNacimiento: '1990-05-17',
      sexo: 'femenino',
      email: 'camila@example.com',
    });

    return {
      patientRepository,
      patient,
      useCase: new UpdatePatientUseCase(patientRepository),
    };
  };

  it('updates the provided fields and persists the change', async () => {
    const { patientRepository, patient, useCase } = await setup();

    const updated = await useCase.execute({
      id: patient.id,
      telefono: '+56 9 1234 5678',
      notas: 'Control de bruxismo',
    });

    expect(updated.telefono).toBe('+56912345678');
    expect(updated.notas).toBe('Control de bruxismo');
    expect(updated.nombres).toBe('Camila');
    await expect(patientRepository.findById(patient.id)).resolves.toBe(updated);
  });

  it('clears optional fields when null is provided', async () => {
    const { patient, useCase } = await setup();

    const updated = await useCase.execute({
      id: patient.id,
      email: null,
      notas: null,
    });

    expect(updated.email).toBeNull();
    expect(updated.notas).toBeNull();
  });

  it('validates new values before mutating the aggregate', async () => {
    const { patient, useCase } = await setup();

    await expect(
      useCase.execute({ id: patient.id, telefono: '123' }),
    ).rejects.toThrow(InvalidTelefonoError);
    expect(patient.telefono).toBeNull();
  });

  it('normalizes and changes the RUT when it is re-submitted differently', async () => {
    const { patient, useCase } = await setup();

    const updated = await useCase.execute({
      id: patient.id,
      rut: '12.345.678-5',
    });

    expect(updated.rut).toBe('12345678-5');
  });

  it('rejects RUTs already used by another patient', async () => {
    const { patientRepository, patient, useCase } = await setup();
    await new CreatePatientUseCase(patientRepository).execute({
      rut: '22222222-2',
      nombres: 'Grace',
      apellidoPaterno: 'Muñoz',
      apellidoMaterno: 'Soto',
      fechaNacimiento: '1988-03-10',
      sexo: 'femenino',
    });

    await expect(
      useCase.execute({ id: patient.id, rut: '22222222-2' }),
    ).rejects.toThrow(PatientAlreadyExistsError);
  });

  it('throws EmptyPatientUpdateError when no field is provided', async () => {
    const { patient, useCase } = await setup();

    await expect(useCase.execute({ id: patient.id })).rejects.toThrow(
      EmptyPatientUpdateError,
    );
  });

  it('throws PatientNotFoundError for unknown ids', async () => {
    const { useCase } = await setup();

    await expect(
      useCase.execute({ id: 'does-not-exist', nombres: 'Ghost' }),
    ).rejects.toThrow(PatientNotFoundError);
  });
});
