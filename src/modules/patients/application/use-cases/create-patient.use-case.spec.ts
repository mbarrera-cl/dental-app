import { InMemoryPatientRepository } from '../../infrastructure/adapters/persistence/in-memory-patient.repository.js';
import { PatientAlreadyExistsError } from '../../domain/patient.errors.js';
import { InvalidRutError } from '../../../../shared/domain/persona.errors.js';
import { CreatePatientUseCase } from './create-patient.use-case.js';

describe('CreatePatientUseCase', () => {
  // Use cases are plain classes: no Nest container is needed to unit test them.
  const setup = () => {
    const patientRepository = new InMemoryPatientRepository();

    return {
      patientRepository,
      useCase: new CreatePatientUseCase(patientRepository),
    };
  };

  const newPatient = {
    rut: '12.345.678-5',
    nombres: 'Camila',
    apellidoPaterno: 'Rojas',
    apellidoMaterno: 'Pérez',
    fechaNacimiento: '1990-05-17',
    sexo: 'femenino',
  };

  it('creates and persists a patient', async () => {
    const { patientRepository, useCase } = setup();

    const patient = await useCase.execute(newPatient);

    expect(patient.id).toEqual(expect.any(String));
    expect(patient.rut).toBe('12345678-5');
    await expect(patientRepository.findById(patient.id)).resolves.toBe(patient);
  });

  it('stores the canonical RUT no matter the spelling', async () => {
    const { useCase } = setup();

    const patient = await useCase.execute({
      ...newPatient,
      rut: ' 12.345.678-5 ',
    });

    expect(patient.rut).toBe('12345678-5');
  });

  it('rejects invalid RUTs before hitting the repository', async () => {
    const { patientRepository, useCase } = setup();
    const findByRut = vi.spyOn(patientRepository, 'findByRut');

    await expect(
      useCase.execute({ ...newPatient, rut: '12345678-9' }),
    ).rejects.toThrow(InvalidRutError);
    expect(findByRut).not.toHaveBeenCalled();
  });

  it('rejects duplicate RUTs across spellings', async () => {
    const { useCase } = setup();

    await useCase.execute(newPatient);

    await expect(
      useCase.execute({
        ...newPatient,
        rut: '12345678-5',
        nombres: 'Camila Segunda',
      }),
    ).rejects.toThrow(PatientAlreadyExistsError);
  });

  it('creates a patient with every optional group', async () => {
    const { useCase } = setup();

    const patient = await useCase.execute({
      ...newPatient,
      email: 'camila@example.com',
      telefono: '+56 9 1234 5678',
      direccion: {
        region: 'RM',
        comuna: 'Providencia',
        calle: 'Av. Providencia',
        numero: '1234',
      },
      prevision: { tipo: 'FONASA', tramo: 'B' },
      contactoEmergencia: {
        nombre: 'María Pérez',
        telefono: '9 8765 4321',
        parentesco: 'Madre',
      },
      notas: 'Alergia a la penicilina',
    });

    expect(patient.email).toBe('camila@example.com');
    expect(patient.telefono).toBe('+56912345678');
    expect(patient.direccion?.region).toBe('RM');
    expect(patient.prevision?.tramo).toBe('B');
    expect(patient.contactoEmergencia?.telefono).toBe('+56987654321');
    expect(patient.notas).toBe('Alergia a la penicilina');
  });
});
