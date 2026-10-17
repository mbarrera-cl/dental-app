import { HttpErrorResponse } from '@angular/common/http';

/**
 * Backend error names (`user.errors.ts` / `patient.errors.ts` / Nest
 * `DomainExceptionFilter`) mapped to Transloco keys. Using keys instead of
 * messages keeps the UI translatable regardless of the language the API
 * responds in.
 */
const ERROR_NAME_TO_KEY: Readonly<Record<string, string>> = {
  // users context
  UserAlreadyExistsError: 'errors.userAlreadyExists',
  UserNotFoundError: 'errors.userNotFound',
  EmptyUserUpdateError: 'errors.emptyUpdate',
  InvalidEmailError: 'errors.invalidEmail',
  InvalidNameError: 'errors.invalidName',
  // patients context
  PatientAlreadyExistsError: 'errors.patientAlreadyExists',
  PatientNotFoundError: 'errors.patientNotFound',
  PatientRutNotFoundError: 'errors.patientRutNotFound',
  EmptyPatientUpdateError: 'errors.emptyUpdate',
  InvalidRutError: 'errors.invalidRut',
  InvalidPatientNameError: 'errors.invalidName',
  InvalidFechaNacimientoError: 'errors.invalidFechaNacimiento',
  InvalidSexoError: 'errors.invalidSexo',
  InvalidTelefonoError: 'errors.invalidTelefono',
  InvalidRegionError: 'errors.invalidRegion',
  InvalidDireccionError: 'errors.invalidDireccion',
  InvalidPrevisionError: 'errors.invalidPrevision',
  InvalidContactoEmergenciaError: 'errors.invalidContactoEmergencia',
  // clinical context (ficha dental)
  ClinicalRecordAlreadyExistsError: 'errors.clinicalRecordExists',
  PatientClinicalRecordNotFoundError: 'errors.clinicalRecordNotFound',
  ClinicalRecordNotFoundError: 'errors.clinicalRecordNotFound',
  ClinicalRecordLockedError: 'errors.clinicalRecordLocked',
  EmptyClinicalRecordUpdateError: 'errors.emptyUpdate',
  ClinicalFindingNotFoundError: 'errors.clinicalFindingNotFound',
  ClinicalFindingAlreadyVoidedError: 'errors.clinicalFindingAlreadyVoided',
  // accounts / rbac context
  LastAdminError: 'errors.lastAdmin',
  UnknownRoleError: 'errors.unknownRole',
  PermissionUnknownError: 'errors.unknownPermission',
  PasswordPolicyViolationError: 'errors.passwordPolicy',
  PasswordReusedError: 'errors.passwordReused',
  EmptyPasswordResetError: 'errors.emptyPasswordReset',
  // roles context
  RoleNameTakenError: 'errors.roleNameTaken',
  RoleNameReservedError: 'errors.roleNameReserved',
  RoleProtectedError: 'errors.roleProtected',
  RoleAssignedError: 'errors.roleAssigned',
  RoleNotFoundError: 'errors.roleNotFound',
  InvalidRoleNameError: 'errors.invalidName',
  InvalidRoleDescriptionError: 'errors.validation',
  EmptyRoleUpdateError: 'errors.emptyUpdate',
  // api keys context
  ApiKeyNotFoundError: 'errors.apiKeyNotFound',
  ApiKeyAlreadyRevokedError: 'errors.apiKeyRevoked',
  InvalidApiKeyNameError: 'errors.invalidName',
  InvalidApiKeyExpirationError: 'errors.apiKeyExpiration',
  InvalidApiKeyScopesError: 'errors.apiKeyScopes',
  ApiKeyScopesExceedPermissionsError: 'errors.apiKeyScopesExceed',
  ApiKeyLimitReachedError: 'errors.apiKeyLimit',
  ApiKeyOwnerNotFoundError: 'errors.userNotFound',
  // settings context
  SettingsUnknownKeyError: 'errors.settingUnknown',
  SettingsValueInvalidError: 'errors.settingInvalid',
  EmptySettingsUpdateError: 'errors.settingsEmpty',
  // clinic context
  InvalidImageError: 'errors.invalidImage',
  UnsupportedImageFormatError: 'errors.unsupportedImageFormat',
  ImageTooLargeError: 'errors.imageTooLarge',
  UnknownVariantError: 'errors.notFound',
  ClinicAssetNotFoundError: 'errors.notFound',
  // navigation context
  InvalidMenuItemKindError: 'errors.validation',
  InvalidMenuDestinationError: 'errors.menuDestination',
  InvalidMenuRouteKeyError: 'errors.menuRouteKey',
  InvalidMenuExternalUrlError: 'errors.menuExternalUrl',
  InvalidMenuLabelError: 'errors.invalidName',
  InvalidMenuIconError: 'errors.menuIcon',
  InvalidMenuPositionError: 'errors.validation',
  NestedMenuGroupError: 'errors.menuNestedGroup',
  MenuItemNotFoundError: 'errors.menuItemNotFound',
  MenuParentNotGroupError: 'errors.menuParentNotGroup',
  MenuReorderDuplicateError: 'errors.validation',
  MenuReorderSelfParentError: 'errors.validation',
  EmptyMenuItemUpdateError: 'errors.emptyUpdate',
};

/**
 * Maps any API failure to a Transloco key. Both the domain errors
 * (`{ statusCode, error: 'UserAlreadyExistsError', ... }`) and the
 * `ValidationPipe` responses (`400 Bad Request`) are covered.
 */
export function mapApiError(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) {
    return 'errors.unknown';
  }

  if (error.status === 0) {
    return 'errors.network';
  }

  const errorName = extractErrorName(error);

  if (errorName !== null && errorName in ERROR_NAME_TO_KEY) {
    return ERROR_NAME_TO_KEY[errorName];
  }

  switch (error.status) {
    case 400:
    case 422:
      return 'errors.validation';
    case 404:
      return 'errors.notFound';
    case 409:
      return 'errors.conflict';
    default:
      return 'errors.unknown';
  }
}

function extractErrorName(error: HttpErrorResponse): string | null {
  const body: unknown = error.error;

  if (typeof body === 'object' && body !== null && 'error' in body) {
    const name = (body as { error: unknown }).error;
    return typeof name === 'string' ? name : null;
  }

  return null;
}
