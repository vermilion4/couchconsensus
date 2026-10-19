import {buildApp} from './app';
import {loadConfig} from './config';

const config = loadConfig();
const app = await buildApp(config);

await app.listen({port: config.port, host: config.host});
app.log.info(
  {publicBaseUrl: config.publicBaseUrl, aiMode: config.aiMode, bedrockModelId: config.aiMode === 'on' ? config.bedrockModelId : undefined, catalogMode: config.catalogMode},
  'CouchConsensus session service ready',
);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    app.log.info({signal}, 'shutting down');
    void app.close().then(() => process.exit(0));
  });
}
