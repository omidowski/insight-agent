import { getConfig } from '@/lib/config/env';
import { hasSearchProvider } from '@/lib/search';
import ChatApp from '@/components/ChatApp';

export const dynamic = 'force-dynamic';

export default function Page() {
  const config = getConfig();
  return (
    <ChatApp
      configured={config.isConfigured}
      searchConfigured={config.isConfigured ? hasSearchProvider() : false}
      provider={config.llmProvider}
      showCosts={config.SHOW_COSTS}
    />
  );
}
