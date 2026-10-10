import {App} from 'aws-cdk-lib';
import {CouchStack} from '../lib/couch-stack';

// Guard: this machine's default AWS profile is a company account. Only ever run against the
// project's own account, selected explicitly. Override with COUCH_AWS_PROFILE if the name differs.
const expectedProfile = process.env.COUCH_AWS_PROFILE ?? 'couch';
if (process.env.AWS_PROFILE !== expectedProfile) {
  throw new Error(`Refusing to run: set AWS_PROFILE=${expectedProfile} (got ${process.env.AWS_PROFILE ?? 'the default profile'}).`);
}

const app = new App();
new CouchStack(app, 'CouchStack', {
  env: {account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-1'},
  bedrockModelId: process.env.BEDROCK_MODEL_ID ?? 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
  aiMode: process.env.AI_MODE === 'on' ? 'on' : 'off',
  cdn: app.node.tryGetContext('cdn') !== 'false',
  description: 'CouchConsensus session service (hackathon)',
});
