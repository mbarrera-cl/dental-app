/**
 * Spanish translations (default language).
 *
 * All translations live in the `ui` library because it is the only project
 * shared between the shell and the remotes. Keeping a single source of truth
 * avoids cross-origin dictionary fetches between the microfrontends: the
 * Transloco loader resolves translations statically (already compiled into
 * each bundle).
 */
export const ES = {
  common: {
    appName: 'Hexa',
    users: 'Usuarios',
    dashboard: 'Dashboard',
    language: 'Idioma',
    loading: 'Cargando…',
    save: 'Guardar',
    cancel: 'Cancelar',
    edit: 'Editar',
    delete: 'Eliminar',
    refresh: 'Actualizar',
    search: 'Buscar',
    retry: 'Reintentar',
    close: 'Cerrar',
    actions: 'Acciones',
  },
  errors: {
    userAlreadyExists: 'Ya existe un usuario con ese email.',
    userNotFound: 'El usuario no existe (puede haber sido eliminado).',
    emptyUpdate: 'Debes cambiar al menos un campo.',
    invalidEmail: 'El email no es válido.',
    invalidName: 'El nombre no es válido.',
    validation: 'La petición no pasó la validación.',
    network: 'No se pudo conectar con la API. ¿Está arrancado el backend?',
    unknown: 'Ha ocurrido un error inesperado.',
  },
  shell: {
    title: 'Hexa',
    subtitle: 'Microfrontends sobre una API hexagonal',
    navUsers: 'Usuarios',
    navDashboard: 'Dashboard',
  },
  users: {
    title: 'Usuarios',
    subtitle: 'CRUD completo contra la API de NestJS + SQLite.',
    count: '{{count}} de {{total}} usuarios',
    searchPlaceholder: 'Buscar por nombre o email…',
    empty: 'No hay usuarios que coincidan con la búsqueda.',
    newUser: 'Nuevo usuario',
    columns: {
      name: 'Nombre',
      email: 'Email',
      createdAt: 'Creado',
      actions: 'Acciones',
    },
    form: {
      createTitle: 'Nuevo usuario',
      createDescription: 'Rellena los datos para crear un usuario.',
      editTitle: 'Editar usuario',
      editDescription: 'Modifica los datos del usuario y guarda los cambios.',
      name: 'Nombre',
      namePlaceholder: 'Ada Lovelace',
      email: 'Email',
      emailPlaceholder: 'ada@example.com',
      submitCreate: 'Crear usuario',
      submitEdit: 'Guardar cambios',
    },
    delete: {
      title: '¿Eliminar usuario?',
      description: 'Se eliminará "{{name}}" de forma permanente. Esta acción no se puede deshacer.',
      action: 'Eliminar',
    },
    toasts: {
      created: 'Usuario creado correctamente.',
      updated: 'Usuario actualizado correctamente.',
      deleted: 'Usuario eliminado correctamente.',
    },
    validation: {
      nameRequired: 'El nombre es obligatorio.',
      nameMin: 'El nombre debe tener al menos 2 caracteres.',
      nameMax: 'El nombre no puede superar los 100 caracteres.',
      emailRequired: 'El email es obligatorio.',
      emailInvalid: 'Introduce un email válido.',
      emailMax: 'El email no puede superar los 254 caracteres.',
    },
  },
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Resumen en vivo de la API de usuarios.',
    total: 'Usuarios totales',
    totalDescription: 'Registros almacenados en SQLite',
    latest: 'Últimos usuarios',
    latestDescription: 'Los 5 usuarios más recientes',
    viewAll: 'Ver todos los usuarios',
    empty: 'Todavía no hay usuarios registrados.',
  },
} as const;
