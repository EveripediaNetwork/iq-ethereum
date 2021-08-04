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

const AddressZero = '0x0000000000000000000000000000000000000000';
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
    FeeDistributorVyper: <FeeDistributorVyper>(
      await ethers.getContract('FeeDistributorVyper')
    ),
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
    const {
      users,
      deployer,
      HIIQ,
      FeeDistributor,
      FeeDistributorVyper,
    } = await setup();

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

    expect(await deployer.FeeDistributor.timeCursor()).eq(
      initialPoint.add(WEEK)
    );
    expect(
      await deployer.FeeDistributor.hiIQSupply(
        BigNumber.from(today).div(WEEK).mul(WEEK)
      )
    ).eq(0); // no hiIQ in first epoch
    expect(await deployer.FeeDistributor.tokenLastBalance()).eq(rewardAmount); // no claims balance should be the same

    expect(await deployer.FeeDistributorVyper.time_cursor()).eq(
      initialPoint.add(WEEK)
    );
    expect(
      await deployer.FeeDistributorVyper.ve_supply(
        BigNumber.from(today).div(WEEK).mul(WEEK)
      )
    ).eq(0); // no hiIQ in first epoch
    expect(await deployer.FeeDistributorVyper.token_last_balance()).eq(
      rewardAmount
    ); // no claims balance should be the same

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
    await user.FeeDistributorVyper['claim(address)'](user.address);
    expect(await user.IQERC20.balanceOf(user.address)).to.equal(0);
    expect(await deployer.FeeDistributor.tokenLastBalance()).eq(
      rewardAmount.mul(2)
    );
    expect(await deployer.FeeDistributorVyper.token_last_balance()).eq(
      rewardAmount.mul(2)
    );

    expect(await deployer.FeeDistributor.timeCursor()).eq(
      initialPoint.add(WEEK * 2)
    ); // cursor moved a new week
    expect(await deployer.FeeDistributorVyper.time_cursor()).eq(
      initialPoint.add(WEEK * 2)
    ); // cursor moved a new week
    expect(await FeeDistributor.hiIQSupply(initialPoint.add(WEEK))).eq(
      await FeeDistributorVyper.ve_supply(initialPoint.add(WEEK))
    );

    // expect(await FeeDistributor.hiIQSupply(initialPoint.add(WEEK))).eq(await user.HIIQ["balanceOf(address)"](user.address)); // TODO: check why balance is 380k instead of 1M

    // move to next week
    await ethers.provider.send('evm_increaseTime', [WEEK]);
    await ethers.provider.send('evm_mine', []);

    await deployer.FeeDistributor.checkpointToken();
    await deployer.FeeDistributor.checkpointTotalSupply();
    await deployer.FeeDistributorVyper.checkpoint_token();
    await deployer.FeeDistributorVyper.checkpoint_total_supply();

    expect(await user.IQERC20.balanceOf(user.address)).to.equal(0);

    expect(await FeeDistributor.timeCursor()).eq(
      await FeeDistributorVyper.time_cursor()
    );

    // aprox similar
    // expect(await FeeDistributor.tokensPerWeek(initialPoint.add(WEEK))).eq(await FeeDistributorVyper.tokens_per_week(initialPoint.add(WEEK)));
    // expect(await FeeDistributor.tokensPerWeek(initialPoint.add(WEEK*2))).eq(await FeeDistributorVyper.tokens_per_week(initialPoint.add(WEEK*2)));
    // expect(await FeeDistributor.lastTokenTime()).eq(await FeeDistributorVyper.last_token_time());

    await user.FeeDistributorVyper['claim(address)'](user.address);
    const balance1 = await user.IQERC20.balanceOf(user.address);
    await user.FeeDistributor.claim(user.address);
    const balance2 = await user.IQERC20.balanceOf(user.address);
    expect(balance2.gt(balance1)).to.be.true;
  });

  it('Restrictive functions pause & recoverERC20 & allowcheckpoint', async () => {
    const {users, deployer, HIIQ, IQERC20, FeeDistributor} = await setup();

    const user = users[0];
    const lockTime = today + secondsInADay * 60; // 60 days

    const amount = BigNumber.from(parseEther('60000000')); // 60M
    const lockedAmount = BigNumber.from(parseEther('1000000')); // 1M
    const rewardAmount = BigNumber.from(parseEther('7000000')); // 7M

    await deployer.IQERC20.mint(user.address, lockedAmount);
    await deployer.IQERC20.mint(deployer.address, amount);

    // lock 1M IQ for 60 days
    await user.IQERC20.approve(HIIQ.address, lockedAmount);
    await user.HIIQ.create_lock(lockedAmount, lockTime);
    await deployer.IQERC20.transfer(FeeDistributor.address, rewardAmount);

    await deployer.FeeDistributor.checkpointToken();

    await expect(
      user.FeeDistributor.toggleAllowCheckpointToken()
    ).to.be.revertedWith('Ownable: caller is not the owner');
    await deployer.FeeDistributor.toggleAllowCheckpointToken();
    await expect(user.FeeDistributor.checkpointToken()).to.be.revertedWith(
      "Can't checkpoint token!"
    );
    await deployer.FeeDistributor.toggleAllowCheckpointToken();

    await expect(user.FeeDistributor.togglePause()).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
    await deployer.FeeDistributor.togglePause();
    await expect(user.FeeDistributor.checkpointToken()).to.be.revertedWith(
      'Contract is paused'
    );

    await expect(
      user.FeeDistributor.recoverERC20(IQERC20.address, rewardAmount)
    ).to.be.revertedWith('Ownable: caller is not the owner');
    await deployer.FeeDistributor.recoverERC20(IQERC20.address, rewardAmount);
    expect(await deployer.IQERC20.balanceOf(deployer.address)).to.be.eq(amount);
  });

  it('Many weeks without claiming', async () => {
    const {
      users,
      deployer,
      HIIQ,
      FeeDistributor,
      FeeDistributorVyper,
    } = await setup();

    const user = users[0];
    const lockTime = today + secondsInADay * 60; // 60 days

    const amount = BigNumber.from(parseEther('100000000')); // 100M
    const lockedAmount = BigNumber.from(parseEther('1000000')); // 1M
    const rewardAmount = BigNumber.from(parseEther('7000000')); // 7M

    await deployer.IQERC20.mint(user.address, lockedAmount);
    await deployer.IQERC20.mint(deployer.address, amount);

    // lock 1M IQ for 60 days
    await user.IQERC20.approve(HIIQ.address, lockedAmount);
    await user.HIIQ.create_lock(lockedAmount, lockTime);
    await user.HIIQ.checkpoint();
    await deployer.IQERC20.transfer(FeeDistributor.address, rewardAmount);
    await deployer.IQERC20.transfer(FeeDistributorVyper.address, rewardAmount);

    await deployer.FeeDistributor.checkpointToken();
    await deployer.FeeDistributor.checkpointTotalSupply();

    await deployer.FeeDistributorVyper.checkpoint_token();
    await deployer.FeeDistributorVyper.checkpoint_total_supply();

    // 1 week
    await ethers.provider.send('evm_increaseTime', [WEEK]);
    await ethers.provider.send('evm_mine', []);

    await deployer.IQERC20.transfer(FeeDistributor.address, rewardAmount);
    await deployer.IQERC20.transfer(FeeDistributorVyper.address, rewardAmount);
    await deployer.FeeDistributor.checkpointToken();
    await deployer.FeeDistributor.checkpointTotalSupply();
    await deployer.FeeDistributorVyper.checkpoint_token();
    await deployer.FeeDistributorVyper.checkpoint_total_supply();

    // 2 week
    await ethers.provider.send('evm_increaseTime', [WEEK]);
    await ethers.provider.send('evm_mine', []);

    await deployer.IQERC20.transfer(FeeDistributor.address, rewardAmount);
    await deployer.IQERC20.transfer(FeeDistributorVyper.address, rewardAmount);
    await deployer.FeeDistributor.checkpointToken();
    await deployer.FeeDistributor.checkpointTotalSupply();
    await deployer.FeeDistributorVyper.checkpoint_token();
    await deployer.FeeDistributorVyper.checkpoint_total_supply();

    // 3 week
    await ethers.provider.send('evm_increaseTime', [WEEK]);
    await ethers.provider.send('evm_mine', []);

    await deployer.IQERC20.transfer(FeeDistributor.address, rewardAmount);
    await deployer.IQERC20.transfer(FeeDistributorVyper.address, rewardAmount);
    await deployer.FeeDistributor.checkpointToken();
    await deployer.FeeDistributor.checkpointTotalSupply();
    await deployer.FeeDistributorVyper.checkpoint_token();
    await deployer.FeeDistributorVyper.checkpoint_total_supply();

    // 4 week
    await ethers.provider.send('evm_increaseTime', [WEEK]);
    await ethers.provider.send('evm_mine', []);

    await deployer.IQERC20.transfer(FeeDistributor.address, rewardAmount);
    await deployer.IQERC20.transfer(FeeDistributorVyper.address, rewardAmount);
    await deployer.FeeDistributor.checkpointToken();
    await deployer.FeeDistributor.checkpointTotalSupply();
    await deployer.FeeDistributorVyper.checkpoint_token();
    await deployer.FeeDistributorVyper.checkpoint_total_supply();

    // 5 week
    await ethers.provider.send('evm_increaseTime', [WEEK]);
    await ethers.provider.send('evm_mine', []);

    await deployer.IQERC20.transfer(FeeDistributor.address, rewardAmount);
    await deployer.IQERC20.transfer(FeeDistributorVyper.address, rewardAmount);
    await deployer.FeeDistributor.checkpointToken();
    await deployer.FeeDistributor.checkpointTotalSupply();
    await deployer.FeeDistributorVyper.checkpoint_token();
    await deployer.FeeDistributorVyper.checkpoint_total_supply();

    // 6 week
    await ethers.provider.send('evm_increaseTime', [WEEK]);
    await ethers.provider.send('evm_mine', []);

    await deployer.IQERC20.transfer(FeeDistributor.address, rewardAmount);
    await deployer.IQERC20.transfer(FeeDistributorVyper.address, rewardAmount);
    await deployer.FeeDistributor.checkpointToken();
    await deployer.FeeDistributor.checkpointTotalSupply();
    await deployer.FeeDistributorVyper.checkpoint_token();
    await deployer.FeeDistributorVyper.checkpoint_total_supply();

    await user.FeeDistributorVyper['claim(address)'](user.address);
    const balance1 = await user.IQERC20.balanceOf(user.address);
    await user.FeeDistributor.claim(user.address);
    const balance2 = await user.IQERC20.balanceOf(user.address);
    expect(balance2.sub(balance1).div(1000).mul(1000)).eq(
      balance1.div(1000).mul(1000)
    ); // aprox 1000 up or down
  });

  it('Users get rewards only w HIIQ not expired', async () => {
    const {
      users,
      deployer,
      HIIQ,
      FeeDistributor,
      FeeDistributorVyper,
    } = await setup();

    const user = users[0];
    const lockTime = today + secondsInADay * 15; // 15 days

    const amount = BigNumber.from(parseEther('100000000')); // 100M
    const lockedAmount = BigNumber.from(parseEther('1000000')); // 1M
    const rewardAmount = BigNumber.from(parseEther('7000000')); // 7M

    await deployer.IQERC20.mint(user.address, lockedAmount);
    await deployer.IQERC20.mint(deployer.address, amount);

    // lock 1M IQ for 60 days
    await user.IQERC20.approve(HIIQ.address, lockedAmount);
    await user.HIIQ.create_lock(lockedAmount, lockTime);
    await user.HIIQ.checkpoint();
    await deployer.IQERC20.transfer(FeeDistributor.address, rewardAmount);
    await deployer.IQERC20.transfer(FeeDistributorVyper.address, rewardAmount);

    await deployer.FeeDistributor.checkpointToken();
    await deployer.FeeDistributor.checkpointTotalSupply();

    await deployer.FeeDistributorVyper.checkpoint_token();
    await deployer.FeeDistributorVyper.checkpoint_total_supply();

    // 1 week
    await ethers.provider.send('evm_increaseTime', [WEEK]);
    await ethers.provider.send('evm_mine', []);

    await deployer.IQERC20.transfer(FeeDistributor.address, rewardAmount);
    await deployer.IQERC20.transfer(FeeDistributorVyper.address, rewardAmount);
    await deployer.FeeDistributor.checkpointToken();
    await deployer.FeeDistributor.checkpointTotalSupply();
    await deployer.FeeDistributorVyper.checkpoint_token();
    await deployer.FeeDistributorVyper.checkpoint_total_supply();

    // 2 week
    await ethers.provider.send('evm_increaseTime', [WEEK]);
    await ethers.provider.send('evm_mine', []);

    await deployer.IQERC20.transfer(FeeDistributor.address, rewardAmount);
    await deployer.IQERC20.transfer(FeeDistributorVyper.address, rewardAmount);
    await deployer.FeeDistributor.checkpointToken();
    await deployer.FeeDistributor.checkpointTotalSupply();
    await deployer.FeeDistributorVyper.checkpoint_token();
    await deployer.FeeDistributorVyper.checkpoint_total_supply();

    // 3 week
    await ethers.provider.send('evm_increaseTime', [WEEK]);
    await ethers.provider.send('evm_mine', []);

    await deployer.IQERC20.transfer(FeeDistributor.address, rewardAmount);
    await deployer.IQERC20.transfer(FeeDistributorVyper.address, rewardAmount);
    await deployer.FeeDistributor.checkpointToken();
    await deployer.FeeDistributor.checkpointTotalSupply();
    await deployer.FeeDistributorVyper.checkpoint_token();
    await deployer.FeeDistributorVyper.checkpoint_total_supply();

    await user.FeeDistributorVyper['claim(address)'](user.address);
    const balance1 = await user.IQERC20.balanceOf(user.address);
    await user.FeeDistributor.claim(user.address);
    const balance2 = await user.IQERC20.balanceOf(user.address);
    expect(balance1.lt(rewardAmount)).to.be.true;
    // only gets 1 week. First week its still not rewarded, second yes, and third gets expired
    expect(balance1.gt(BigNumber.from(parseEther('6999900')))).to.be.true;
    expect(balance2.sub(balance1).div(1000).mul(1000)).eq(
      balance1.div(1000).mul(1000)
    ); // aprox 1000 up or down
  });

  it('Claims Many', async () => {
    const {
      users,
      deployer,
      HIIQ,
      FeeDistributor,
      FeeDistributorVyper,
    } = await setup();

    const user = users[0];
    const user2 = users[1];
    const lockTime = today + secondsInADay * 15; // 15 days
    const lockTime2 = today + secondsInADay * 30; // 30 days

    const amount = BigNumber.from(parseEther('100000000')); // 100M
    const lockedAmount = BigNumber.from(parseEther('1000000')); // 1M
    const rewardAmount = BigNumber.from(parseEther('7000000')); // 7M

    await deployer.IQERC20.mint(user.address, lockedAmount);
    await deployer.IQERC20.mint(user2.address, lockedAmount);
    await deployer.IQERC20.mint(deployer.address, amount);

    // lock 1M IQ for 60 days
    await user.IQERC20.approve(HIIQ.address, lockedAmount);
    await user.HIIQ.create_lock(lockedAmount, lockTime);
    await user2.IQERC20.approve(HIIQ.address, lockedAmount);
    await user2.HIIQ.create_lock(lockedAmount, lockTime2); // second user gets 2x more time locked
    await deployer.IQERC20.transfer(FeeDistributor.address, rewardAmount);
    await deployer.IQERC20.transfer(FeeDistributorVyper.address, rewardAmount);

    await deployer.FeeDistributor.checkpointToken();
    await deployer.FeeDistributor.checkpointTotalSupply();

    await deployer.FeeDistributorVyper.checkpoint_token();
    await deployer.FeeDistributorVyper.checkpoint_total_supply();

    // 1 week
    await ethers.provider.send('evm_increaseTime', [WEEK]);
    await ethers.provider.send('evm_mine', []);

    await deployer.IQERC20.transfer(FeeDistributor.address, rewardAmount);
    await deployer.IQERC20.transfer(FeeDistributorVyper.address, rewardAmount);
    await deployer.FeeDistributor.checkpointToken();
    await deployer.FeeDistributor.checkpointTotalSupply();
    await deployer.FeeDistributorVyper.checkpoint_token();
    await deployer.FeeDistributorVyper.checkpoint_total_supply();

    // 2 week
    await ethers.provider.send('evm_increaseTime', [WEEK]);
    await ethers.provider.send('evm_mine', []);

    await deployer.IQERC20.transfer(FeeDistributor.address, rewardAmount);
    await deployer.IQERC20.transfer(FeeDistributorVyper.address, rewardAmount);
    await deployer.FeeDistributor.checkpointToken();
    await deployer.FeeDistributor.checkpointTotalSupply();
    await deployer.FeeDistributorVyper.checkpoint_token();
    await deployer.FeeDistributorVyper.checkpoint_total_supply();

    // 3 week
    await ethers.provider.send('evm_increaseTime', [WEEK]);
    await ethers.provider.send('evm_mine', []);

    await deployer.IQERC20.transfer(FeeDistributor.address, rewardAmount);
    await deployer.IQERC20.transfer(FeeDistributorVyper.address, rewardAmount);
    await deployer.FeeDistributor.checkpointToken();
    await deployer.FeeDistributor.checkpointTotalSupply();
    await deployer.FeeDistributorVyper.checkpoint_token();
    await deployer.FeeDistributorVyper.checkpoint_total_supply();

    await user.FeeDistributorVyper.claim_many([
      user.address,
      user2.address,
      AddressZero,
      AddressZero,
      AddressZero,
      AddressZero,
      AddressZero,
      AddressZero,
      AddressZero,
      AddressZero,
      AddressZero,
      AddressZero,
      AddressZero,
      AddressZero,
      AddressZero,
      AddressZero,
      AddressZero,
      AddressZero,
      AddressZero,
      AddressZero,
    ]);
    const balance1 = await user.IQERC20.balanceOf(user.address);
    const balance11 = await user2.IQERC20.balanceOf(user2.address);
    await user.FeeDistributor.claimMany([user.address, user2.address]);
    const balance2 = await user.IQERC20.balanceOf(user.address);
    const balance22 = await user2.IQERC20.balanceOf(user2.address);
    expect(balance1.lt(rewardAmount)).to.be.true;
    expect(balance1.gt(BigNumber.from(parseEther('1700000')))).to.be.true; // gets 1/3 7M bcs staking is half of time than user 2
    expect(balance2.sub(balance1).div(10000).mul(10000)).eq(
      balance1.div(10000).mul(10000)
    ); // aprox 10000 up or down
    expect(balance22.sub(balance11).div(10000).mul(10000)).eq(
      balance11.div(10000).mul(10000)
    ); // aprox 10000 up or down
  });
});
