import {expect} from './chai-setup';
import {HIIQ, IQERC20, FeeDistributor, FeeDistributorVyper} from '../typechain';
import {
  deployments,
  ethers,
  getNamedAccounts,
  getUnnamedAccounts,
} from 'hardhat';
import {setupUser, setupUsers} from './utils';
import {BigNumber} from 'ethers';
import {formatEther, parseEther} from 'ethers/lib/utils';

const secondsInADay = 24 * 60 * 60;
const today = Math.round(new Date().getTime() / 1000);
const WEEK = secondsInADay * 7;

const setup = deployments.createFixture(async () => {
  await deployments.fixture('HIIQ');
  const {deployer} = await getNamedAccounts();
  const HIIQ = <HIIQ>await ethers.getContract('HIIQ');
  const IQERC20 = <IQERC20>await ethers.getContract('IQERC20');
  await deployments.deploy('FeeDistributor', {
    from: deployer,
    args: [HIIQ.address, IQERC20.address, today],
    log: true,
  });

  await deployments.deploy('FeeDistributorVyper', {
    from: deployer,
    args: [HIIQ.address, today, IQERC20.address, deployer, deployer],
    log: true,
  });

  const contracts = {
    FeeDistributor: <FeeDistributor>await ethers.getContract('FeeDistributor'),
    FeeDistributorVyper: <FeeDistributorVyper>await ethers.getContract('FeeDistributorVyper'),
    HIIQ,
    IQERC20,
  };
  const users = await setupUsers(await getUnnamedAccounts(), contracts);

  return {
    ...contracts,
    users,
    deployer: await setupUser(deployer, contracts),
  };
});

describe('FeeDistributor', () => {
  it('Mint and lock tokens', async () => {
    const {users, deployer, HIIQ, FeeDistributor, FeeDistributorVyper} = await setup();

    const user = users[0];
    const lockTime = today + secondsInADay * 60; // 60 days

    const amount = BigNumber.from(parseEther('60000000')); // 60M
    const lockedAmount = BigNumber.from(parseEther('1000000')); // 1M
    const rewardAmount = BigNumber.from(parseEther('7000000')); // 7M
    const initialPoint = BigNumber.from(today).div(WEEK).mul(WEEK); // initial point to track hiIQ total

    await deployer.IQERC20.mint(user.address, lockedAmount);
    await deployer.IQERC20.mint(deployer.address, amount);

    // lock 1M IQ for 60 days
    await user.IQERC20.approve(HIIQ.address, lockedAmount);
    await user.HIIQ.create_lock(lockedAmount, lockTime);
    await user.HIIQ.checkpoint();
    await deployer.IQERC20.transfer(FeeDistributor.address, rewardAmount);
    await deployer.IQERC20.transfer(FeeDistributorVyper.address, rewardAmount);

    expect(await deployer.FeeDistributor.timeCursor()).eq(initialPoint);
    expect(await deployer.FeeDistributorVyper.time_cursor()).eq(initialPoint);

    await deployer.FeeDistributor.checkpointToken();
    await deployer.FeeDistributor.checkpointTotalSupply();

    await deployer.FeeDistributorVyper.checkpoint_token();
    await deployer.FeeDistributorVyper.checkpoint_total_supply();


    expect(await deployer.FeeDistributor.timeCursor()).eq(initialPoint.add(WEEK));
    expect(await deployer.FeeDistributor.hiIQSupply(BigNumber.from(today).div(WEEK).mul(WEEK))).eq(0); // no hiIQ in first epoch
    expect(await deployer.FeeDistributor.tokenLastBalance()).eq(rewardAmount); // no claims balance should be the same

    expect(await deployer.FeeDistributorVyper.time_cursor()).eq(initialPoint.add(WEEK));
    expect(await deployer.FeeDistributorVyper.ve_supply(BigNumber.from(today).div(WEEK).mul(WEEK))).eq(0); // no hiIQ in first epoch
    expect(await deployer.FeeDistributorVyper.token_last_balance()).eq(rewardAmount); // no claims balance should be the same

    // move to next week
    await ethers.provider.send('evm_increaseTime', [WEEK]);
    await ethers.provider.send('evm_mine', []);

    await deployer.IQERC20.transfer(FeeDistributor.address, rewardAmount);
    await deployer.IQERC20.transfer(FeeDistributorVyper.address, rewardAmount);
    await deployer.FeeDistributor.checkpointToken();
    await deployer.FeeDistributor.checkpointTotalSupply();
    await deployer.FeeDistributorVyper.checkpoint_token();
    await deployer.FeeDistributorVyper.checkpoint_total_supply();

    await user.FeeDistributor.claim(user.address);
    await user.FeeDistributorVyper["claim(address)"](user.address);
    expect(await user.IQERC20.balanceOf(user.address)).to.equal(0);
    expect(await deployer.FeeDistributor.tokenLastBalance()).eq(rewardAmount.mul(2));
    expect(await deployer.FeeDistributorVyper.token_last_balance()).eq(rewardAmount.mul(2));

    expect(await deployer.FeeDistributor.timeCursor()).eq(initialPoint.add(WEEK * 2)); // cursor moved a new week
    expect(await deployer.FeeDistributorVyper.time_cursor()).eq(initialPoint.add(WEEK * 2)); // cursor moved a new week
    expect(await FeeDistributor.hiIQSupply(initialPoint.add(WEEK))).eq(await FeeDistributorVyper.ve_supply(initialPoint.add(WEEK)));

    // expect(await FeeDistributor.hiIQSupply(initialPoint.add(WEEK))).eq(await user.HIIQ["balanceOf(address)"](user.address)); // TODO: check why balance is 380k instead of 1M

    // move to next week
    await ethers.provider.send('evm_increaseTime', [WEEK]);
    await ethers.provider.send('evm_mine', []);

    await deployer.FeeDistributor.checkpointToken();
    await deployer.FeeDistributor.checkpointTotalSupply();
    await deployer.FeeDistributorVyper.checkpoint_token();
    await deployer.FeeDistributorVyper.checkpoint_total_supply();

    expect(await user.IQERC20.balanceOf(user.address)).to.equal(0);

    expect(await FeeDistributor.timeCursor()).eq(await FeeDistributorVyper.time_cursor());

    // aprox similar
    // expect(await FeeDistributor.tokensPerWeek(initialPoint.add(WEEK))).eq(await FeeDistributorVyper.tokens_per_week(initialPoint.add(WEEK)));
    // expect(await FeeDistributor.tokensPerWeek(initialPoint.add(WEEK*2))).eq(await FeeDistributorVyper.tokens_per_week(initialPoint.add(WEEK*2)));
    // expect(await FeeDistributor.lastTokenTime()).eq(await FeeDistributorVyper.last_token_time());

    await user.FeeDistributorVyper["claim(address)"](user.address);
    const balance1 = await user.IQERC20.balanceOf(user.address);
    console.log(formatEther(balance1));
    await user.FeeDistributor.claim(user.address);
    const balance2 = await user.IQERC20.balanceOf(user.address);
    console.log(formatEther(balance2));
    expect(balance2.gt(balance1)).to.be.true;

    // TODO: testing all scenarios ( restricted functions, with & without checkpoint, claim before time, claim after time, etc)
  });
});
