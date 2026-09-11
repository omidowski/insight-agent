import { describe, expect, it } from 'vitest';
import { getConfig, resetConfig } from '@/lib/config/env';
import { getRepositories, LOCAL_USER_ID, resetRepositories } from '@/lib/db/repositories';
import { closeDb } from '@/lib/db/client';
import { GET as healthGet } from '@/app/api/health/route';
import { GET as listConversations } from '@/app/api/conversations/route';
import { GET as getConversation } from '@/app/api/conversations/[id]/route';
import { GET as modelsGet } from '@/app/api/models/route';
import { POST as createRun } from '@/app/api/runs/route';
import { GET as vectorStatsGet } from '@/app/api/vector/stats/route';

describe('Live Debug', () => {
  it('checks config and db against real data', async () => {
    closeDb();
    resetRepositories();
    resetConfig();
    process.env.DATABASE_PATH = './data/app.db';

    const repos = getRepositories();
    repos.users.ensureLocal();
    const convos = repos.conversations.listByUser(LOCAL_USER_ID);
    console.log('Real DB Conversations count:', convos.length);
    for (const c of convos) {
      console.log('Conversation:', c.id, c.title);
      const detailReq = new Request(`http://localhost:3000/api/conversations/${c.id}`);
      const detailRes = await getConversation(detailReq, { params: Promise.resolve({ id: c.id }) });
      console.log('Detail status:', detailRes.status);
      if (detailRes.status !== 200) {
        console.error('Detail error:', await detailRes.text());
      }
    }

    const healthRes = await healthGet();
    console.log('Health status:', healthRes.status, await healthRes.json());

    const modelsReq = new Request('http://localhost:3000/api/models');
    const modelsRes = await modelsGet(modelsReq);
    console.log('Models status:', modelsRes.status, await modelsRes.json());

    const statsReq = new Request('http://localhost:3000/api/vector/stats');
    const statsRes = await vectorStatsGet(statsReq);
    console.log('Vector stats status:', statsRes.status, await statsRes.json());
  });
});
