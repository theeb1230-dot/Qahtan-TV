import { runTests } from './addon.test.js';
import { runDomainRegistryTests } from './domain-registry.test.js';

runTests()
  .then((res) => {
    runDomainRegistryTests();
    if (res.failed > 0) process.exit(1);
    process.exit(0);
  })
  .catch((err) => {
    console.error('Test run failed with unhandled error:', err);
    process.exit(1);
  });
