import { initFederation } from '@angular-architects/native-federation';

initFederation(
  {
    users: 'http://localhost:4201/remoteEntry.json',
    dashboard: 'http://localhost:4202/remoteEntry.json',
  },
  {
    hostRemoteEntry: { url: './remoteEntry.json' },
  },
)
  .catch((err) => console.error(err))
  .then((_) => import('./bootstrap'))
  .catch((err) => console.error(err));
