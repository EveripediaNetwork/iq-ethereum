import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

// if you want to deploy in matic:
// yarn deploy matic --tags HIIQ
//   const {deployer, iQ} = await hre.getNamedAccounts();
//   args: [iQ, 'hiIQ', 'hiIQ', '1.0.0'],
//   remove: func.dependencies = ['IQERC20'];
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();
  const {deploy} = hre.deployments;
  const iQ = await hre.deployments.get('IQERC20');

  const result = await deploy('HIIQ', {
    from: deployer,
    args: [iQ.address, 'hiIQ', 'hiIQ', '1.0.0'],
    log: true,
  });
  hre.deployments.log(
    `🚀 contract HIIQ deployed at ${result.address} using ${result.receipt?.gasUsed} gas`
  );
};
export default func;
func.tags = ['HIIQ'];
func.dependencies = ['IQERC20'];
