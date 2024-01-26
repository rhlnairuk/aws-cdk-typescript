#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import { NetworkingStack } from './dev_setup_stack';
import { DevStack } from './dev_setup_stack';

const app = new cdk.App();

const envDefault = {
  region: 'us-east-1',
  account: process.env.CDK_DEPLOY_ACCOUNT || process.env.CDK_DEFAULT_ACCOUNT
};

const networkStack = new NetworkingStack(app, 'NetworkingStack', { env: envDefault });
const devStack = new DevStack(app, 'DevStack', networkStack.vpc, { env: envDefault });
devStack.addDependency(networkStack);

app.synth();