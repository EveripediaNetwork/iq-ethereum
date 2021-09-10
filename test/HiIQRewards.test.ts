import {expect} from './chai-setup';
import {HiIQRewards, HIIQ, IQERC20} from '../typechain';
import {
  deployments,
  ethers,
  getNamedAccounts,
  getUnnamedAccounts,
} from 'hardhat';
import {setupUser, setupUsers} from './utils';
import {BigNumber} from 'ethers';
import {parseEther, formatEther} from 'ethers/lib/utils';

const secondsInADay = 24 * 60 * 60;

const contractName = 'HiIQRewards'; // HiIQRewards HiIQRewardsv4 HiIQRewardsv2
const setup = deployments.createFixture(async () => {
  await deployments.fixture('HIIQ');
  const {deployer} = await getNamedAccounts();
  const HIIQ = <HIIQ>await ethers.getContract('HIIQ');
  const IQERC20 = <IQERC20>await ethers.getContract('IQERC20');
  await deployments.deploy(contractName, {
    from: deployer,
    args: [IQERC20.address, HIIQ.address],
    log: true,
  });

  const contracts = {
    HiIQRewards: <HiIQRewards>await ethers.getContract(contractName),
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

describe(contractName, () => {
  it('Only owner can call restrictive functions', async () => {
    const {users, deployer} = await setup();
    const temp = users[0];

    await expect(deployer.HiIQRewards.setYieldDuration(604800)).to.be.not
      .reverted;
    await expect(temp.HiIQRewards.setYieldDuration(604800)).to.be.reverted;

    await expect(temp.HiIQRewards.initializeDefault()).to.be.reverted;

    await expect(deployer.HiIQRewards.greylistAddress(temp.address)).to.be.not
      .reverted;
    await expect(temp.HiIQRewards.greylistAddress(deployer.address)).to.be
      .reverted;

    await expect(deployer.HiIQRewards.setPauses(true)).to.be.not.reverted;
    await expect(temp.HiIQRewards.setPauses(true)).to.be.reverted;

    await expect(deployer.HiIQRewards.setYieldRate(7 * 86400, false)).to.be.not
      .reverted;
    await expect(temp.HiIQRewards.setYieldRate(7 * 86400, false)).to.be
      .reverted;
  });

  it('Mint and lock tokens', async () => {
    const {users, deployer, HIIQ, HiIQRewards} = await setup();

    const user = users[0];
    const lockTime =
      Math.round(new Date().getTime() / 1000) + secondsInADay * 60; // 60 days

    const amount = BigNumber.from(parseEther('60000000')); // 60M
    const lockedAmount = BigNumber.from(parseEther('1000000')); // 1M
    const rewardAmount = BigNumber.from(parseEther('30000000')); // 30M
    const yieldPerSecond = BigNumber.from(parseEther('1000000')).div(
      secondsInADay
    ); // 1M per day

    await deployer.IQERC20.mint(user.address, amount);

    // lock 1M IQ for 60 days
    await user.IQERC20.approve(HIIQ.address, lockedAmount);
    await user.HIIQ.create_lock(lockedAmount, lockTime);
    await user.HIIQ.checkpoint();

    await deployer.HiIQRewards.initializeDefault();
    await deployer.HiIQRewards.setYieldRate(yieldPerSecond, true);
    await user.IQERC20.transfer(HiIQRewards.address, rewardAmount);

    expect(await user.HiIQRewards.userIsInitialized(user.address)).to.be.false;
    await user.HiIQRewards.checkpoint();
    expect(await user.HiIQRewards.userIsInitialized(user.address)).to.be.true;

    await ethers.provider.send('evm_increaseTime', [secondsInADay * 7]); // 7 days
    await ethers.provider.send('evm_mine', []);

    const currentBalance = amount.sub(lockedAmount).sub(rewardAmount);
    expect(await deployer.IQERC20.balanceOf(user.address)).to.equal(
      currentBalance
    );

    const earned = await user.HiIQRewards.earned(user.address);
    expect(earned.gt(BigNumber.from(parseEther('6000000')))).to.be.true;
    expect(earned.lt(BigNumber.from(parseEther('7000000')))).to.be.true;
    await user.HiIQRewards.getYield();

    const earned2 = await user.HiIQRewards.earned(user.address);
    expect(earned2.toNumber()).to.be.equal(0);

    expect(await deployer.IQERC20.balanceOf(user.address)).to.not.equal(
      currentBalance
    );
  });

  it('Rewards Test, Issue with Last Reward Period', async () => {
    const {users, deployer, HIIQ, HiIQRewards} = await setup();

    const user = users[0];
    const WEEKS_TO_STAKE = 2;

    const lockTime =
      Math.round(new Date().getTime() / 1000) +
      secondsInADay * 7 * WEEKS_TO_STAKE; // 14 days
    const amount = BigNumber.from(parseEther('60000000')); // 60M
    const lockedAmount = BigNumber.from(parseEther('1000000')); // 1M
    const yieldPerSecond = BigNumber.from(parseEther('1000000')).div(
      secondsInADay
    ); // 1M per day

    await deployer.IQERC20.mint(user.address, amount);
    await deployer.IQERC20.mint(HiIQRewards.address, amount);

    await user.IQERC20.approve(HIIQ.address, lockedAmount);
    await user.HIIQ.create_lock(lockedAmount, lockTime);
    await user.HIIQ.checkpoint();

    await deployer.HiIQRewards.initializeDefault();
    await deployer.HiIQRewards.setYieldRate(yieldPerSecond, true);
    await user.HiIQRewards.checkpoint();

    let blockNum = await ethers.provider.getBlockNumber();
    let block = await ethers.provider.getBlock(blockNum);

    let prevBlock;
    const firstBlock = block;
    let expectedEarned1;
    let expectedEarned2;
    for (let weeksTest = 1; weeksTest < 6; weeksTest++) {
      await ethers.provider.send('evm_increaseTime', [secondsInADay * 7]); // days to move forward
      await ethers.provider.send('evm_mine', []);

      blockNum = await ethers.provider.getBlockNumber();
      block = await ethers.provider.getBlock(blockNum);
      let user1LockEnd = await user.HIIQ.locked__end(user.address);
      if (user1LockEnd > BigNumber.from(block.timestamp)) {
        user1LockEnd = BigNumber.from(block.timestamp);
      }
      const user1IQBal = await user.IQERC20.balanceOf(user.address);
      const [
        user1HiIQRewardsBal,
        user1endLockTime,
      ] = await user.HiIQRewards.eligibleCurrentHiIQ(user.address);
      const earned1 = await user.HiIQRewards.earned(user.address);

      await user.HiIQRewards.checkpoint();

      // expected amount tops after lockTime
      if (weeksTest <= WEEKS_TO_STAKE) {
        expectedEarned1 = 6000000 * weeksTest;
        expectedEarned2 = 7000000 * weeksTest;
      }

      console.log('block.timestamp: ', block.timestamp);
      console.log(
        'weeks ellapsed: ',
        firstBlock
          ? (block.timestamp - firstBlock.timestamp) / (secondsInADay * 7)
          : ''
      );
      console.log('BlockNum: ', blockNum);
      console.log('user1IQBal', formatEther(user1IQBal));
      console.log('user1HiIQRewardsBal', formatEther(user1HiIQRewardsBal));
      console.log(
        'HIIQ.totalSupply',
        formatEther(await user.HIIQ.totalSupplyAt(blockNum))
      );
      console.log(
        'HiIQRewards.totalSupply',
        formatEther(await user.HiIQRewards.totalHiIQSupplyStored())
      );
      console.log(
        'HiIQRewards.userYieldPerTokenPaid',
        formatEther(await user.HiIQRewards.userYieldPerTokenPaid(user.address))
      );
      console.log(
        'HiIQRewards.yieldPerHiIQ',
        formatEther(await user.HiIQRewards.yieldPerHiIQ())
      );
      console.log('earned1', formatEther(earned1));
      console.log('expectedEarned1', expectedEarned1);
      console.log('expectedEarned2', expectedEarned2);
      console.log('');

      prevBlock = block;

      expect(earned1.gt(BigNumber.from(parseEther(`${expectedEarned1}`)))).to.be
        .true;
      expect(earned1.lt(BigNumber.from(parseEther(`${expectedEarned2}`)))).to.be
        .true;
    }

    // let's re stake
    const newLockTime = block.timestamp + secondsInADay * 7 * WEEKS_TO_STAKE; // 14 days
    await user.HIIQ.withdraw();
    await user.IQERC20.approve(HIIQ.address, lockedAmount);
    await user.HIIQ.create_lock(lockedAmount, newLockTime);
    await user.HiIQRewards.checkpoint();

    await ethers.provider.send('evm_increaseTime', [secondsInADay * 14]); // days to move forward
    await ethers.provider.send('evm_mine', []);

    const earned1 = await user.HiIQRewards.earned(user.address);
    console.log('earned1', formatEther(earned1)); // 135M !
  });

  it('Re stake with multiple users', async () => {
    const {users, deployer, HIIQ, HiIQRewards} = await setup();
    const WEEKS_TO_STAKE = 2;
    const AMOUNT_USERS = 7;

    const lockTime =
      Math.round(new Date().getTime() / 1000) +
      secondsInADay * 7 * WEEKS_TO_STAKE; // 14 days
    const amount = BigNumber.from(parseEther('60000000')); // 60M
    const lockedAmount = BigNumber.from(parseEther('1000000')); // 1M
    const yieldPerSecond = BigNumber.from(parseEther('1000000')).div(
      secondsInADay
    ); // 1M per day

    await deployer.IQERC20.mint(HiIQRewards.address, amount);

    for (let i = 0; i <= AMOUNT_USERS; i++) {
      await deployer.IQERC20.mint(users[i].address, amount);
      await users[i].IQERC20.approve(HIIQ.address, lockedAmount);
      await users[i].HIIQ.create_lock(lockedAmount, lockTime);
      await users[i].HIIQ.checkpoint();
    }

    await deployer.HiIQRewards.initializeDefault();
    await deployer.HiIQRewards.setYieldRate(yieldPerSecond, true);

    for (let i = 0; i <= AMOUNT_USERS; i++) {
      await users[i].HiIQRewards.checkpoint();
    }

    await ethers.provider.send('evm_increaseTime', [secondsInADay * 30]); // days to move forward
    await ethers.provider.send('evm_mine', []);

    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);

    // await users[0].HiIQRewards.checkpoint(); // w checkpoint earned1 == 1,663,481 & earned2 == 1,946,490
    const earned1 = await users[0].HiIQRewards.earned(users[0].address);
    console.log('earned1', formatEther(earned1)); // 378,296 but it should be 14M/7 = 2M

    // let's re stake
    const newLockTime = block.timestamp + secondsInADay * 7 * WEEKS_TO_STAKE; // 14 days
    await users[0].HIIQ.withdraw();
    await users[0].IQERC20.approve(HIIQ.address, lockedAmount);
    await users[0].HIIQ.create_lock(lockedAmount, newLockTime);
    await users[0].HiIQRewards.checkpoint();

    await ethers.provider.send('evm_increaseTime', [secondsInADay * 14]); // days to move forward
    await ethers.provider.send('evm_mine', []);

    const earned2 = await users[0].HiIQRewards.earned(users[0].address);
    console.log('earned2', formatEther(earned2)); // 3,290,265 but it should be 2M + 14M (one per day since nobody else is staking)
  });

  it('Re stake with multiple users 2', async () => {
    const {users, deployer, HIIQ, HiIQRewards} = await setup();
    const WEEKS_TO_STAKE = 52;
    const AMOUNT_USERS = 7;

    const lockTime =
      Math.round(new Date().getTime() / 1000) +
      secondsInADay * 7 * WEEKS_TO_STAKE; // 14 days
    const amount = BigNumber.from(parseEther('365000000'));
    const lockedAmount = BigNumber.from(parseEther('1000000')); // 1M
    const yieldPerSecond = BigNumber.from(parseEther('1000000')).div(
      secondsInADay
    ); // 1M per day

    await deployer.IQERC20.mint(HiIQRewards.address, amount);

    await deployer.IQERC20.mint(users[0].address, amount);
    await users[0].IQERC20.approve(HIIQ.address, lockedAmount);
    await users[0].HIIQ.create_lock(
      lockedAmount,
      Math.round(new Date().getTime() / 1000) + secondsInADay * 7
    );
    await users[0].HIIQ.checkpoint();

    for (let i = 1; i <= AMOUNT_USERS; i++) {
      await deployer.IQERC20.mint(users[i].address, amount);
      await users[i].IQERC20.approve(HIIQ.address, lockedAmount);
      await users[i].HIIQ.create_lock(lockedAmount, lockTime);
      await users[i].HIIQ.checkpoint();
    }

    await deployer.HiIQRewards.initializeDefault();
    await deployer.HiIQRewards.setYieldRate(yieldPerSecond, true);

    for (let i = 1; i <= AMOUNT_USERS; i++) {
      await users[i].HiIQRewards.checkpoint();
    }
    await users[0].HiIQRewards.checkpoint();

    await ethers.provider.send('evm_increaseTime', [secondsInADay * 14]); // days to move forward
    await ethers.provider.send('evm_mine', []);

    // await users[0].HiIQRewards.checkpoint(); // w checkpoint earned1 == 1,662,000 & earned2 == 1,662,000
    const earned1 = await users[0].HiIQRewards.earned(users[0].address);
    console.log('earned1', formatEther(earned1)); // 780,000 but it should be 14M/7 = 2M

    await ethers.provider.send('evm_increaseTime', [secondsInADay * 300]); // days to move forward
    await ethers.provider.send('evm_mine', []);

    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);

    // let's re stake
    const newLockTime = block.timestamp + secondsInADay * 7;
    await users[0].HIIQ.withdraw();
    await users[0].IQERC20.approve(HIIQ.address, lockedAmount);
    await users[0].HIIQ.create_lock(lockedAmount, newLockTime);
    await users[0].HiIQRewards.checkpoint();

    const earned2 = await users[0].HiIQRewards.earned(users[0].address);
    console.log('earned2', formatEther(earned2)); // 3,290,265 but it should be same than earn1 (2M)
  });

  it('2 users, 1 checkpointer. 14 day lock for both users. 21 day simulation 1 day step', async () => {
    // return
    const {users, deployer, HIIQ, HiIQRewards} = await setup();

    const user = users[0];
    const user2 = users[1];

    const lockTime =
      Math.round(new Date().getTime() / 1000) + secondsInADay * 14; // 365 days
    const amount = BigNumber.from(parseEther('60000000')); // 60M
    const lockedAmount = BigNumber.from(parseEther('1000000')); // 1M
    const yieldPerSecond = BigNumber.from(parseEther('1000000')).div(
      secondsInADay
    ); // 1M per day

    await deployer.IQERC20.mint(user.address, amount);
    await deployer.IQERC20.mint(user2.address, amount);
    await deployer.IQERC20.mint(HiIQRewards.address, amount);

    await user.IQERC20.approve(HIIQ.address, lockedAmount);
    await user.HIIQ.create_lock(lockedAmount, lockTime);
    await user.HIIQ.checkpoint();

    await user2.IQERC20.approve(HIIQ.address, lockedAmount);
    await user2.HIIQ.create_lock(lockedAmount, lockTime);
    await user2.HIIQ.checkpoint();

    await deployer.HiIQRewards.initializeDefault();
    await deployer.HiIQRewards.setYieldRate(yieldPerSecond, true);
    await user.HiIQRewards.checkpoint();
    await user2.HiIQRewards.checkpoint();

    let blockNum = await ethers.provider.getBlockNumber();
    let block = await ethers.provider.getBlock(blockNum);

    let prevBlock;
    const firstBlock = block;
    let expectedEarned1;
    let expectedEarned2;
    for (let weeksTest = 1; weeksTest < 21; weeksTest++) {
      await ethers.provider.send('evm_increaseTime', [secondsInADay]); // days to move forward
      await ethers.provider.send('evm_mine', []);

      blockNum = await ethers.provider.getBlockNumber();
      block = await ethers.provider.getBlock(blockNum);
      let user1LockEnd = await user.HIIQ.locked__end(user.address);
      if (user1LockEnd > BigNumber.from(block.timestamp)) {
        user1LockEnd = BigNumber.from(block.timestamp);
      }
      const user1IQBal = await user.IQERC20.balanceOf(user.address);
      const [
        user1HiIQRewardsBal,
        user1endLockTime,
      ] = await user.HiIQRewards.eligibleCurrentHiIQ(user.address);
      const earned1 = await user.HiIQRewards.earned(user.address);

      // don't checkpoint user1 but have user2 updating global states
      // await user.HiIQRewards.checkpoint();
      await user2.HiIQRewards.checkpoint();

      // expected amount tops after lockTime
      if (lockTime >= block.timestamp) {
        expectedEarned1 = (6000000 * weeksTest) / 7 / 2;
        expectedEarned2 = (8000000 * weeksTest) / 7 / 2;
      }

      console.log('block.timestamp: ', block.timestamp);
      console.log(
        'days ellapsed: ',
        firstBlock
          ? (block.timestamp - firstBlock.timestamp) / secondsInADay
          : ''
      );
      console.log(
        'weeks ellapsed: ',
        firstBlock
          ? (block.timestamp - firstBlock.timestamp) / (secondsInADay * 7)
          : ''
      );
      console.log('BlockNum: ', blockNum);
      console.log('user1IQBal', formatEther(user1IQBal));
      console.log('user1HiIQRewardsBal', formatEther(user1HiIQRewardsBal));
      console.log(
        'HIIQ.totalSupply',
        formatEther(await user.HIIQ.totalSupplyAt(blockNum))
      );
      console.log(
        'HiIQRewards.totalSupply',
        formatEther(await user.HiIQRewards.totalHiIQSupplyStored())
      );
      console.log(
        'HiIQRewards.userYieldPerTokenPaid',
        formatEther(await user.HiIQRewards.userYieldPerTokenPaid(user.address))
      );
      console.log(
        'HiIQRewards.yieldPerHiIQ',
        formatEther(await user.HiIQRewards.yieldPerHiIQ())
      );
      console.log('earned1', formatEther(earned1));
      console.log('expectedEarned1', expectedEarned1);
      console.log('expectedEarned2', expectedEarned2);
      console.log('');

      prevBlock = block;

      expect(earned1.gt(BigNumber.from(parseEther(`${expectedEarned1}`)))).to.be
        .true;
      expect(earned1.lt(BigNumber.from(parseEther(`${expectedEarned2}`)))).to.be
        .true;
    }
  });

  it('Greylist and pause', async () => {
    const {users, deployer, HIIQ, HiIQRewards} = await setup();

    const user = users[0];
    const lockTime =
      Math.round(new Date().getTime() / 1000) + secondsInADay * 45; // 45 days

    const amount = BigNumber.from(parseEther('61000000')); // 60M
    const lockedAmount = BigNumber.from(parseEther('1000000')); // 1M
    const rewardAmount = BigNumber.from(parseEther('60000000')); // 60M
    const yieldPerSecond = BigNumber.from(parseEther('1000000')).div(
      secondsInADay
    ); // 1M per day

    await deployer.IQERC20.mint(user.address, amount);
    await user.IQERC20.approve(HIIQ.address, lockedAmount);
    await user.HIIQ.create_lock(lockedAmount, lockTime);
    await user.HIIQ.checkpoint();

    await deployer.HiIQRewards.initializeDefault();
    await deployer.HiIQRewards.setYieldRate(yieldPerSecond, true);
    await user.IQERC20.transfer(HiIQRewards.address, rewardAmount);
    await user.HiIQRewards.checkpoint();

    await ethers.provider.send('evm_increaseTime', [secondsInADay * 14]);
    await ethers.provider.send('evm_mine', []);

    // greylist
    await deployer.HiIQRewards.greylistAddress(user.address);
    await expect(user.HiIQRewards.getYield()).to.be.revertedWith(
      'Address has been greylisted'
    );
    await deployer.HiIQRewards.greylistAddress(user.address);

    // pause
    await deployer.HiIQRewards.setPauses(true);
    await expect(user.HiIQRewards.getYield()).to.be.revertedWith(
      'Yield collection is paused'
    );
    await deployer.HiIQRewards.setPauses(false);

    await user.HiIQRewards.getYield();
  });
});
