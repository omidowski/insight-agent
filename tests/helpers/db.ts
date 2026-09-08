import { openDatabase } from '@/lib/db/client';
import { createRepositories, type Repositories } from '@/lib/db/repositories';

export function freshRepos(): Repositories {
  const db = openDatabase(':memory:');
  const repos = createRepositories(db);
  repos.users.ensureLocal();
  return repos;
}
