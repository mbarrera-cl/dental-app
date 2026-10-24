import { Injectable } from '@nestjs/common';
import writeExcelFile from 'write-excel-file/node';
import {
  PatientExportPort,
  type PatientExportOptions,
} from '../../../application/ports/patient-export.port.js';
import { PATIENT_EXPORT_COLUMNS, buildPatientSheet } from './patient-excel.mapper.js';

@Injectable()
export class WriteExcelFilePatientExportAdapter extends PatientExportPort {
  async build({ patients, timeZone, generatedAt }: PatientExportOptions): Promise<Buffer> {
    return writeExcelFile(buildPatientSheet(patients, timeZone, generatedAt), {
      sheet: 'Pacientes',
      columns: PATIENT_EXPORT_COLUMNS.map(({ width }) => ({ width })),
      // Keep the header visible while scrolling through a long patient list.
      stickyRowsCount: 1,
    }).toBuffer();
  }
}
