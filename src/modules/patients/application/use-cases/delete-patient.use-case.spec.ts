import { InMemoryPatientRepository } from '../../infrastructure/adapters/persistence/in-memory-patient.repository.js';
import { PatientNotFoundError } from '../../domain/patient.errors.js';
import { CreatePatientUseCase } from './create-patient.use-case.js';
import { DeletePatientUseCase } from './delete-patient.use-case.js';

describe('DeletePatientUseCase', () => {
  it('deletes an existing patient', async () => {
    const patientRepository = new InMemoryPatientRepository();
    const patient = await new CreatePatientUseCase(patientRepository).execute({
      rut: '12.345.678-5',
      nombres: 'Camila',
      apellidoPaterno: 'Rojas',
      apellidoMaterno: 'Pérez',
      fechaNacimiento: '1990-05-17',
      sexo: 'femenino',
    });

    await new DeletePatientUseCase(patientRepository).execute({
      id: patient.id,
    });

    await expect(patientRepository.findById(patient.id)).resolves.toBeNull();
  });

  it('throws PatientNotFoundError for unknown ids', async () => {
    const useCase = new DeletePatientUseCase(new InMemoryPatientRepository());

    await expect(useCase.execute({ id: 'does-not-exist' })).rejects.toThrow(
      PatientNotFoundError,
    );
  });
});
