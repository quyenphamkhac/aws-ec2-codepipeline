import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";

export class AwsEc2CodepipelineStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "VPC", {
      maxAzs: 2,
      cidr: "10.0.0.0/16",
      subnetConfiguration: [
        {
          name: "Public",
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: "Private",
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });

    const ec2SG = new ec2.SecurityGroup(this, "EC2SG", {
      vpc,
      allowAllOutbound: true,
    });

    ec2SG.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), "Allow SSH");

    const ec2UserData = ec2.UserData.forWindows();
    ec2UserData.addCommands("echo Hello World");
    ec2UserData.addCommands(
      `$ErrorActionPreference = "stop"`,
      "echo 'Make powershell is default shell'",
      `New-ItemProperty -Path "HKLM:\\SOFTWARE\\OpenSSH" -Name DefaultShell -Value "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -PropertyType String -Force`,
      `echo 'Remove Windows-Defender'`,
      `Remove-WindowsFeature Windows-Defender`,
      `echo 'Install chocolatey'`,
      `Set-ExecutionPolicy Bypass -Scope Process -Force;`,
      `[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072;`,
      `iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))`,
      `choco install -y git`,
      `choco install -y nodejs`,
      `$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")`,
      `echo 'Install Process Manager'`,
      `npm install -g pm2@latest`,
      `npm install -g git+https://github.com/jon-hall/pm2-windows-service.git`,
      `echo 'Install nginx'`,
      `netsh advfirewall firewall add rule name="Univoice server" dir=in action=allow protocol=TCP localport=80`,
      `netsh advfirewall firewall add rule name="Univoice https server" dir=in action=allow protocol=TCP localport=443`,
      `Invoke-WebRequest http://nginx.org/download/nginx-1.18.0.zip -OutFile nginx-1.18.0.zip`,
      `Expand-Archive .\\nginx-1.18.0.zip c:\\nginx`,
      `echo 'setup pm2'`,
      `[System.Environment]::SetEnvironmentVariable('PM2_HOME', 'C:\\pm2', [System.EnvironmentVariableTarget]::Machine)`,
      `$env:PM2_HOME = 'C:\\pm2'`
    );

    const ec2Window = new ec2.Instance(this, "EC2", {
      vpc,
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T2,
        ec2.InstanceSize.MICRO
      ),
      machineImage: new ec2.WindowsImage(
        ec2.WindowsVersion.WINDOWS_SERVER_2019_ENGLISH_CORE_BASE
      ),
      userData: ec2UserData,
      blockDevices: [
        {
          deviceName: "/dev/sda1",
          volume: ec2.BlockDeviceVolume.ebs(30, {
            encrypted: false,
          }),
        },
      ],
      keyName: "pkquyen1996-key-pair",
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      securityGroup: ec2SG,
    });
  }
}
