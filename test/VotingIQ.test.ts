import {expect} from './chai-setup';
import {
  deployments,
  ethers,
  getNamedAccounts,
  getUnnamedAccounts,
} from 'hardhat';
import {IQERC20, HIIQ} from '../typechain';
import {setupUser, setupUsers} from './utils';
import {BigNumber} from 'ethers';
import {formatEther, parseEther} from 'ethers/lib/utils';

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
    const lockTime =
      Math.round(new Date().getTime() / 1000) + 60 * 60 * 24 * 14;
    const amount = BigNumber.from(parseEther('1000'));
    const {users, HIIQ, deployer} = await setup();
    await users[0].HIIQ.checkpoint();
    await deployer.IQERC20.mint(users[0].address, amount);
    await users[0].IQERC20.approve(HIIQ.address, amount);
    await users[0].HIIQ.create_lock(amount, lockTime);
    await users[0].HIIQ.checkpoint();

    const blockNumber = await ethers.provider.getBlockNumber();
    const balance = await users[0].HIIQ.balanceOfAt(
      users[0].address,
      blockNumber
    );

    const totalSupply = await users[0].HIIQ['totalSupply()']();
    expect(balance.eq(totalSupply)).to.be.true;

    const totalIQSupply = await users[0].HIIQ['totalIQSupply()']();
    expect(totalIQSupply.eq(amount)).to.be.true;

    expect(
      await (await users[0].HIIQ.locked__end(users[0].address)).toNumber()
    ).to.be.below(lockTime);

    await expect(users[0].HIIQ.withdraw()).to.be.revertedWith(
      "The lock didn't expire"
    );

    await ethers.provider.send('evm_increaseTime', [60 * 60 * 24 * 15]);
    await ethers.provider.send('evm_mine', []);

    await expect(users[0].HIIQ.withdraw()).to.be.not.reverted;
  });
});
