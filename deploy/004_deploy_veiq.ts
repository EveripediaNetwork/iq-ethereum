import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();
  const {deploy} = hre.deployments;
  const iQ = await hre.deployments.get('IQERC20');

  const result = await deploy('veIQ', {
    from: deployer,
    args: [iQ.address, 'veIQ', 'veIQ', '1.0.0'],
    log: true,
  });
  hre.deployments.log(
    `🚀 contract veIQ deployed at ${result.address} using ${result.receipt?.gasUsed} gas`
  );
};
export default func;
func.tags = ['VEIQ'];
func.dependencies = ['IQERC20'];
