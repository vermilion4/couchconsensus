// One stack for the whole service (ADR-0012):
// CloudFront (TLS, WSS, viewer country) → ALB → ECS Fargate (1 task) → DynamoDB + Bedrock.
import * as path from 'node:path';
import {fileURLToPath} from 'node:url';
import {CfnOutput, Duration, RemovalPolicy, Stack, type StackProps} from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import type {Construct} from 'constructs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export interface CouchStackProps extends StackProps {
  /** Bedrock model or inference profile id (ADR-0008). */
  bedrockModelId: string;
  /** "on" to call Bedrock; "off" keeps the rule-based deck and template reasons (AI-3). */
  aiMode: 'on' | 'off';
}

export class CouchStack extends Stack {
  constructor(scope: Construct, id: string, props: CouchStackProps) {
    super(scope, id, props);

    // ---------- DynamoDB (ADR-0003, DATA_MODEL §4) ----------
    const table = new dynamodb.Table(this, 'Rooms', {
      tableName: 'couch-rooms',
      partitionKey: {name: 'PK', type: dynamodb.AttributeType.STRING},
      sortKey: {name: 'SK', type: dynamodb.AttributeType.STRING},
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // ---------- Network: public subnets only, no NAT (cost) ----------
    const vpc = new ec2.Vpc(this, 'Vpc', {
      // Fixed AZs: synth needs no AWS lookups (and so never touches whatever account is the default).
      availabilityZones: ['us-east-1a', 'us-east-1b'],
      natGateways: 0,
      subnetConfiguration: [{name: 'public', subnetType: ec2.SubnetType.PUBLIC}],
    });

    // ---------- ECS Fargate + ALB (ADR-0002) ----------
    const cluster = new ecs.Cluster(this, 'Cluster', {vpc});
    const logGroup = new logs.LogGroup(this, 'Logs', {retention: logs.RetentionDays.ONE_WEEK, removalPolicy: RemovalPolicy.DESTROY});

    const service = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'Service', {
      cluster,
      desiredCount: 1, // live rooms are in memory: exactly one task (ARCHITECTURE §9)
      cpu: 512,
      memoryLimitMiB: 1024,
      assignPublicIp: true,
      taskSubnets: {subnetType: ec2.SubnetType.PUBLIC},
      publicLoadBalancer: true,
      minHealthyPercent: 0,
      maxHealthyPercent: 100,
      runtimePlatform: {cpuArchitecture: ecs.CpuArchitecture.ARM64, operatingSystemFamily: ecs.OperatingSystemFamily.LINUX},
      taskImageOptions: {
        image: ecs.ContainerImage.fromAsset(repoRoot, {file: 'apps/server/Dockerfile'}),
        containerPort: 8080,
        logDriver: ecs.LogDrivers.awsLogs({streamPrefix: 'couch', logGroup}),
        environment: {
          NODE_ENV: 'production',
          PORT: '8080',
          ROOMS_TABLE: table.tableName,
          AI_MODE: props.aiMode,
          BEDROCK_MODEL_ID: props.bedrockModelId,
          CATALOG_MODE: 'demo',
          // PUBLIC_BASE_URL is the CloudFront URL; set after the first deploy (see README).
        },
      },
    });
    service.loadBalancer.setAttribute('idle_timeout.timeout_seconds', '300'); // long-lived sockets
    service.targetGroup.configureHealthCheck({path: '/healthz', healthyHttpCodes: '200', interval: Duration.seconds(15)});

    table.grantReadWriteData(service.taskDefinition.taskRole);
    service.taskDefinition.taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
        resources: ['arn:aws:bedrock:*::foundation-model/*', `arn:aws:bedrock:*:${this.account}:inference-profile/*`],
      }),
    );

    // ---------- CloudFront: HTTPS/WSS on *.cloudfront.net, viewer country (ADR-0002, ADR-0009) ----------
    const albOrigin = new origins.LoadBalancerV2Origin(service.loadBalancer, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
      readTimeout: Duration.seconds(60),
    });
    const dynamic = {
      origin: albOrigin,
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      // forwards all viewer headers (incl. WebSocket upgrade) + CloudFront-Viewer-Country
      originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_AND_CLOUDFRONT_2022,
    };
    const distribution = new cloudfront.Distribution(this, 'Cdn', {
      comment: 'CouchConsensus',
      defaultBehavior: dynamic,
      additionalBehaviors: {
        '/assets/*': {
          origin: albOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    new CfnOutput(this, 'PublicUrl', {value: `https://${distribution.distributionDomainName}`});
    new CfnOutput(this, 'AlbUrl', {value: `http://${service.loadBalancer.loadBalancerDnsName}`});
    new CfnOutput(this, 'TableName', {value: table.tableName});
  }
}
