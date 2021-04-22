import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {ethers, getNamedAccounts} from 'hardhat';
import {IIQERC20} from '../typechain';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await getNamedAccounts();
  const IQERC20 = <IIQERC20>await ethers.getContract('IQERC20', deployer);
  const TokenMinter = <IIQERC20>await ethers.getContract('TokenMinter');
  if (TokenMinter.address === await IQERC20.minter()) {
    hre.deployments.log(
      `🚀 setMinter has same address than the deployed - ${TokenMinter.address}`
    );
    return;
  }
  const tx = await IQERC20.setMinter(TokenMinter.address);
  hre.deployments.log(
    `🚀 setMinter TokenMinter deployed at ${TokenMinter.address} with tx hash ${tx.hash}`
  );
  await tx.wait();
};
export default func;
func.tags = ['TokenMinter'];
module.exports.runAtTheEnd = true;
