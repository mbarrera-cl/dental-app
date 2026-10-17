import { InMemoryPatientRepository } from '../../infrastructure/adapters/persistence/in-memory-patient.repository.js';
import { PatientRutNotFoundError } from '../../domain/patient.errors.js';
import { InvalidRutError } from '../../../../shared/domain/persona.errors.js';
import { CreatePatientUseCase } from './create-patient.use-case.js';
import { GetPatientByRutUseCase } from './get-patient-by-rut.use-case.js';

describe('GetPatientByRutUseCase', () => {
  const setup = async () => {
    const patientRepository = new InMemoryPatientRepository();
    const patient = await new CreatePatientUseCase(patientRepository).execute({
      rut: '12.345.678-5',
      nombres: 'Camila',
      apellidoPaterno: 'Rojas',
      apellidoMaterno: 'Pérez',
      fechaNacimiento: '1990-05-17',
      sexo: 'femenino',
    });

    return { patient, useCase: new GetPatientByRutUseCase(patientRepository) };
  };

  it('finds the patient from any RUT spelling', async () => {
    const { patient, useCase } = await setup();

    await expect(useCase.execute({ rut: '12345678-5' })).resolves.toBe(patient);
    await expect(useCase.execute({ rut: '12.345.678-5' })).resolves.toBe(
      patient,
    );
  });

  it('rejects malformed RUTs with a validation error', async () => {
    const { useCase } = await setup();

    await expect(useCase.execute({ rut: 'not-a-rut' })).rejects.toThrow(
      InvalidRutError,
    );
  });

  it('throws PatientRutNotFoundError for valid but unknown RUTs', async () => {
    const { useCase } = await setup();

    await expect(useCase.execute({ rut: '22222222-2' })).rejects.toThrow(
      PatientRutNotFoundError,
    );
  });
});
