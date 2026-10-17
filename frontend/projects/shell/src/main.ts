import { initFederation } from '@angular-architects/native-federation';

const isLocalShell = location.hostname === 'localhost' && location.port === '4200';
const remotes = isLocalShell
  ? {
      patients: 'http://localhost:4203/remoteEntry.json',
      users: 'http://localhost:4201/remoteEntry.json',
      dashboard: 'http://localhost:4202/remoteEntry.json',
      admin: 'http://localhost:4204/remoteEntry.json',
      quotes: 'http://localhost:4205/remoteEntry.json',
      agenda: 'http://localhost:4206/remoteEntry.json',
    }
  : {
      patients: `${location.origin}/remotes/patients/remoteEntry.json`,
      users: `${location.origin}/remotes/users/remoteEntry.json`,
      dashboard: `${location.origin}/remotes/dashboard/remoteEntry.json`,
      admin: `${location.origin}/remotes/admin/remoteEntry.json`,
      quotes: `${location.origin}/remotes/quotes/remoteEntry.json`,
      agenda: `${location.origin}/remotes/agenda/remoteEntry.json`,
    };

initFederation(
  remotes,
  {
    hostRemoteEntry: { url: './remoteEntry.json' },
  },
)
  .catch((err) => console.error(err))
  .then((_) => import('./bootstrap'))
  .catch((err) => console.error(err));
