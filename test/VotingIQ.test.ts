import {expect} from './chai-setup';
import {
  deployments,
  ethers,
  getNamedAccounts,
  getUnnamedAccounts,
} from 'hardhat';
import {IQERC20, HIIQ} from '../typechain';
import {setupUser, setupUsers} from './utils';

const setup = deployments.createFixture(async () => {
  const {deployer} = await getNamedAccounts();
  await deployments.fixture();
  const IQERC20 = <IQERC20>await ethers.getContract('IQERC20');
  const HIIQ = <HIIQ>await ethers.getContract('HIIQ');

  const contracts = {
    IQERC20: IQERC20,
    HIIQ: HIIQ,
  };
  const users = await setupUsers(await getUnnamedAccounts(), contracts);
  return {
    ...contracts,
    users,
    deployer: await setupUser(deployer, contracts),
  };
});

describe('HIIQ', function () {
  it('HIIQ can get IQ and vote', async function () {
    const lockTime = Math.round(new Date().getTime() / 1000) + 600000;
    const amount = 5 ** 18;
    const {users, HIIQ, deployer} = await setup();

    await expect(deployer.IQERC20.mint(users[0].address, amount)).to.be.not
      .reverted;
    await expect(users[0].IQERC20.approve(HIIQ.address, amount)).to.be.not
      .reverted;
    await users[0].HIIQ.create_lock(amount, lockTime);
    const blockNumber = await ethers.provider.getBlockNumber();
    expect(
      await (
        await users[0].HIIQ.balanceOfAt(users[0].address, blockNumber)
      ).toNumber()
    ).to.be.greaterThan(amount);
    expect(
      await (await users[0].HIIQ.locked__end(users[0].address)).toNumber()
    ).to.be.below(lockTime);

    await expect(users[0].HIIQ.withdraw()).to.be.revertedWith("The lock didn't expire");

    await ethers.provider.send('evm_increaseTime', [610000]);
    await ethers.provider.send('evm_mine', []);

    await expect(users[0].HIIQ.withdraw()).to.be.not.reverted;
  });
});
