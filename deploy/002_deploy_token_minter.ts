import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer, pIQ} = await hre.getNamedAccounts();
  const {deploy} = hre.deployments;
  const iQ = await hre.deployments.get('IQERC20');

  const result = await deploy('TokenMinter', {
    from: deployer,
    args: [iQ.address, pIQ],
    log: true,
  });
  hre.deployments.log(
    `🚀 contract TokenMinter deployed at ${result.address} using ${result.receipt?.gasUsed} gas`
  );
};
export default func;
func.tags = ['TokenMinter'];
func.dependencies = ['IQERC20'];
