import {expect} from './chai-setup';
import {
  deployments,
  ethers,
  getNamedAccounts,
  getUnnamedAccounts,
} from 'hardhat';
import {IQERC20, VEIQ} from '../typechain';
import {setupUser, setupUsers} from './utils';

const setup = deployments.createFixture(async () => {
  const {deployer} = await getNamedAccounts();
  await deployments.fixture();
  const IQERC20 = <IQERC20>await ethers.getContract('IQERC20');
  const VEIQ = <VEIQ>await ethers.getContract('VEIQ');

  const contracts = {
    IQERC20: IQERC20,
    VEIQ: VEIQ,
  };
  const users = await setupUsers(await getUnnamedAccounts(), contracts);
  return {
    ...contracts,
    users,
    deployer: await setupUser(deployer, contracts),
  };
});

describe('VEIQ', function () {
  it('VEIQ can get IQ and vote', async function () {
    const lockTime = Math.round(new Date().getTime() / 1000) + 6000000;
    const amount = 5 ** 18;
    const {users, VEIQ, deployer} = await setup();

    await expect(deployer.IQERC20.mint(users[0].address, amount)).to.be.not
      .reverted;
    await expect(users[0].IQERC20.approve(VEIQ.address, amount)).to.be.not
      .reverted;
    await users[0].VEIQ.create_lock(amount, lockTime);
    const blockNumber = await ethers.provider.getBlockNumber();
    expect(
      await (
        await users[0].VEIQ.balanceOfAt(users[0].address, blockNumber)
      ).toNumber()
    ).to.be.greaterThan(amount);
    expect(
      await (await users[0].VEIQ.locked__end(users[0].address)).toNumber()
    ).to.be.below(lockTime);
  });
});
