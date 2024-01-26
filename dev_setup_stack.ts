import * as ec2 from '@aws-cdk/aws-ec2';
import * as rds from '@aws-cdk/aws-rds';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import * as autoscaling from '@aws-cdk/aws-autoscaling';
import { Stack, Construct, StackProps } from '@aws-cdk/core';

export class NetworkingStack extends Stack {
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const envType = this.node.tryGetContext('env_type');
    const resourcePrefix = this.node.tryGetContext(envType).resourcePrefix;

    this.vpc = new ec2.Vpc(this, `${resourcePrefix}VPC`, {
      maxAzs: 3,
      natGateways: 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'PublicSubnet',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'PrivateSubnetWithNat',
          subnetType: ec2.SubnetType.PRIVATE_WITH_NAT,
        },
        {
          cidrMask: 24,
          name: 'IsolatedSubnet',
          subnetType: ec2.SubnetType.ISOLATED,
        },
      ],
    });
  }
}
export class DevStack extends Stack {
  constructor(scope: Construct, id: string, vpc: ec2.Vpc, props?: StackProps) {
    super(scope, id, props);

    const webServerUserData = ec2.UserData.forLinux();
    webServerUserData.addCommands(
      "echo 'Configuring as web server'",
      "# Add application server specific setup commands here"
    );

    const appServerUserData = ec2.UserData.forLinux();
    appServerUserData.addCommands(
      "echo 'Configuring as app server'",
      "# Add application server specific setup commands here"
    );

    // Define the criteria for the AMI
    const amiFilters = {
      filters: {
        'name': process.env.CDK_IMAGE_REGEX || 'amzn2-ami-hvm-*-x86_64-gp2', // Example pattern
      },
      owners: [process.env.CDK_AMI_ACCOUNT] || ['amazon'], // Specify the owner account ID
    };

    const latestAmi = ec2.MachineImage.lookup(amiFilters);

    const lbSg = new ec2.SecurityGroup(this, 'LoadBalancerSG', {
      vpc,
      allowAllOutbound: true,
      description: 'Security group for load balancer'
    });
    lbSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80));

    const alb = new elbv2.ApplicationLoadBalancer(this, 'ALB', {
      vpc,
      internetFacing: true,
      securityGroup: lbSg
    });

    const listener = alb.addListener('WebListener', { port: 80 });

    const webServerAsg = new autoscaling.AutoScalingGroup(this, 'WebServersAsg', {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      userData: webServerUserData,
      instanceType: new ec2.InstanceType('t3.micro'),
      machineImage: latestAmi,
      minCapacity: 1,
      maxCapacity: 5
    });

    listener.addTargetGroups('Target', {
      targetGroups: [webServerAsg]
    });

    webServerAsg.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 50
    });

    // Create an EC2 instance for the application server
    new ec2.Instance(this, 'AppServers', {
      userData: appServerUserData,
      instanceType: new ec2.InstanceType('t3.micro'),
      machineImage: ec2.MachineImage.latestAmazonLinux(),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_NAT }
    });

    // Additional resources like RDS instance can be added here
  }
}
