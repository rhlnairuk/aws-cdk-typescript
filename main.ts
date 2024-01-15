import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as rds from '@aws-cdk/aws-rds';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';

class MyStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a VPC
    const vpc = new ec2.Vpc(this, 'MyVPC', {
      maxAzs: 3 // Default is all AZs in the region
    });

    // Create an Application Load Balancer
    const lb = new elbv2.ApplicationLoadBalancer(this, 'LB', {
      vpc,
      internetFacing: true
    });

    const listener = lb.addListener('Listener', {
      port: 80,
    });

    // Create Security Groups for EC2 instances and RDS
    const ec2SecurityGroup = new ec2.SecurityGroup(this, 'ec2SecurityGroup', {
      vpc,
      description: 'Security group for EC2 instances',
      allowAllOutbound: true
    });

    const rdsSecurityGroup = new ec2.SecurityGroup(this, 'rdsSecurityGroup', {
      vpc,
      description: 'Security group for RDS instance',
      allowAllOutbound: true
    });

    // Allow web traffic to EC2 instances
    ec2SecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP traffic from anywhere'
    );

    // EC2 instance for web/application server
    const ec2Instance = new ec2.Instance(this, 'Instance', {
      vpc,
      instanceType: new ec2.InstanceType('t3.micro'),
      machineImage: new ec2.AmazonLinuxImage(),
      securityGroup: ec2SecurityGroup
    });

    // Add EC2 instance to the load balancer
    listener.addTargets('Target', {
      port: 80,
      targets: [ec2Instance]
    });

    // Create an RDS instance
    const dbInstance = new rds.DatabaseInstance(this, 'Instance', {
      engine: rds.DatabaseInstanceEngine.mysql({
        version: rds.MysqlEngineVersion.VER_8_0_19
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.MICRO),
      vpc,
      securityGroups: [rdsSecurityGroup]
    });

    // Output the DNS name of the load balancer
    new cdk.CfnOutput(this, 'LoadBalancerDNS', { value: lb.loadBalancerDnsName });
  }
}

const app = new cdk.App();
new MyStack(app, 'MyStack');