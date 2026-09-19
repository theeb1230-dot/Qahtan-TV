import { runTests } from './addon.test.js';
import { runDomainRegistryTests } from './domain-registry.test.js';
import { runNetworkSecurityTests } from './network-security.test.js';

runTests()
  .then(async (res) => {
    runDomainRegistryTests();
    await runNetworkSecurityTests();
    if (res.failed > 0) process.exit(1);
    process.exit(0);
  })
  .catch((err) => {
    console.error('Test run failed with unhandled error:', err);
    process.exit(1);
  });
