import { initFederation } from '@angular-architects/native-federation';

const isLocalShell = location.hostname === 'localhost' && location.port === '4200';

// Each shell load asks for the federation manifests with a fresh cache key:
// the manifest names the hashed chunks of the current release, so reusing an
// older copy would keep the shell on a previous deploy. Bundled chunks stay
// content-hashed and immutable.
const manifestVersion = Date.now();

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
      patients: `${location.origin}/remotes/patients/remoteEntry.json?v=${manifestVersion}`,
      users: `${location.origin}/remotes/users/remoteEntry.json?v=${manifestVersion}`,
      dashboard: `${location.origin}/remotes/dashboard/remoteEntry.json?v=${manifestVersion}`,
      admin: `${location.origin}/remotes/admin/remoteEntry.json?v=${manifestVersion}`,
      quotes: `${location.origin}/remotes/quotes/remoteEntry.json?v=${manifestVersion}`,
      agenda: `${location.origin}/remotes/agenda/remoteEntry.json?v=${manifestVersion}`,
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
