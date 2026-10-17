import { initFederation } from '@angular-architects/native-federation';

initFederation(
  {
    patients: 'http://localhost:4203/remoteEntry.json',
    users: 'http://localhost:4201/remoteEntry.json',
    dashboard: 'http://localhost:4202/remoteEntry.json',
    admin: 'http://localhost:4204/remoteEntry.json',
    quotes: 'http://localhost:4205/remoteEntry.json',
  },
  {
    hostRemoteEntry: { url: './remoteEntry.json' },
  },
)
  .catch((err) => console.error(err))
  .then((_) => import('./bootstrap'))
  .catch((err) => console.error(err));
