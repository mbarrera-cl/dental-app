import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { Antecedentes, type AntecedentesInput } from '../../domain/antecedentes.vo.js';
import { ClinicalEvent } from '../../domain/clinical-event.entity.js';
import {
  ClinicalRecordNotFoundError,
  EmptyClinicalRecordUpdateError,
} from '../../domain/clinical.errors.js';
import {
  ExamenEstomatognatico,
  type ExamenEstomatognaticoInput,
} from '../../domain/examen-estomatognatico.vo.js';
import type { FichaClinica } from '../../domain/ficha-clinica.entity.js';
import {
  IndicadoresSaludBucal,
  type IndicadoresSaludBucalInput,
} from '../../domain/indicadores.vo.js';
import { SignosVitales, type SignosVitalesInput } from '../../domain/signos-vitales.vo.js';
import { ClinicalRecordRepositoryPort } from '../ports/clinical-record-repository.port.js';

/**
 * PATCH semantics: `undefined` leaves a section untouched, `null` clears it.
 * Composite sections are replaced as a whole (the form always sends them
 * complete), which keeps the merge rules trivial.
 */
export interface UpdateClinicalRecordCommand {
  id: string;
  actorId: string | null;
  categoria?: string;
  embarazada?: boolean;
  motivoConsulta?: string | null;
  enfermedadActual?: string | null;
  antecedentes?: AntecedentesInput | null;
  signosVitales?: SignosVitalesInput | null;
  examenEstomatognatico?: ExamenEstomatognaticoInput | null;
  indicadores?: IndicadoresSaludBucalInput | null;
}

@Injectable()
export class UpdateClinicalRecordUseCase implements UseCase<
  UpdateClinicalRecordCommand,
  FichaClinica
> {
  constructor(private readonly records: ClinicalRecordRepositoryPort) {}

  async execute(command: UpdateClinicalRecordCommand): Promise<FichaClinica> {
    const record = await this.records.findById(command.id);

    if (record === null) {
      throw new ClinicalRecordNotFoundError(command.id);
    }

    const changedFields = this.applyChanges(record, command);

    if (changedFields.length === 0) {
      throw new EmptyClinicalRecordUpdateError();
    }

    record.touch(command.actorId);
    await this.records.update(record);

    await this.records.appendEvent(
      ClinicalEvent.create({
        patientId: record.patientId,
        recordId: record.id,
        actorId: command.actorId,
        action: 'ficha-actualizada',
        summary: `Secciones actualizadas: ${changedFields.join(', ')}`,
        payload: { fields: changedFields },
      }),
    );

    return record;
  }

  private applyChanges(
    record: FichaClinica,
    command: UpdateClinicalRecordCommand,
  ): string[] {
    const changed: string[] = [];

    if (command.categoria !== undefined) {
      record.changeCategoria(command.categoria);
      changed.push('categoria');
    }

    if (command.embarazada !== undefined) {
      record.changeEmbarazada(command.embarazada);
      changed.push('embarazada');
    }

    if (command.motivoConsulta !== undefined) {
      record.changeMotivoConsulta(command.motivoConsulta);
      changed.push('motivoConsulta');
    }

    if (command.enfermedadActual !== undefined) {
      record.changeEnfermedadActual(command.enfermedadActual);
      changed.push('enfermedadActual');
    }

    if (command.antecedentes !== undefined) {
      record.changeAntecedentes(Antecedentes.create(command.antecedentes));
      changed.push('antecedentes');
    }

    if (command.signosVitales !== undefined) {
      record.changeSignosVitales(SignosVitales.create(command.signosVitales));
      changed.push('signosVitales');
    }

    if (command.examenEstomatognatico !== undefined) {
      record.changeExamenEstomatognatico(
        ExamenEstomatognatico.create(command.examenEstomatognatico),
      );
      changed.push('examenEstomatognatico');
    }

    if (command.indicadores !== undefined) {
      record.changeIndicadores(
        IndicadoresSaludBucal.create(command.indicadores),
      );
      changed.push('indicadores');
    }

    return changed;
  }
}
