import {ethers, getNamedAccounts} from 'hardhat';
import {IIQERC20} from '../typechain';

const args = process.argv.slice(2);
const minterAddress = args[0];

async function main() {
  const {deployer} = await getNamedAccounts();
  const IQERC20 = <IIQERC20>await ethers.getContract('IQERC20', deployer);
  const tx = await IQERC20.setMinter(minterAddress || '0x0');
  console.log({tx: tx.hash});
  await tx.wait();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
