export async function runwithImpersonation(userAddress: any, provider: any, hre: any, func: any) {

  try {
    await provider.send("hardhat_impersonateAccount", [userAddress]);
    const signer = await hre.ethers.getSigner(userAddress);
    await func(signer);
  } finally {
    await provider.send("hardhat_stopImpersonatingAccount", [userAddress]);
  }
}
