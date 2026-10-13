import hre from "hardhat";

const { ethers } = hre;

async function main() {
  console.log("Starting AttendChain Sepolia Deployment & Verification...");

  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error("No deployer account configured for Sepolia.");
  }

  const network = await ethers.provider.getNetwork();
  console.log(
    `Connected to chain ID: ${network.chainId} (Expected Sepolia: 11155111)`
  );
  console.log(`Deployer address: ${deployer.address}`);

  const qrSignerAddress =
    process.env.QR_TICKET_SIGNER_ADDRESS || deployer.address;
  console.log(`Configured QR ticket signer: ${qrSignerAddress}`);

  console.log("Deploying AttendChainRegistry to Sepolia...");
  const Factory = await ethers.getContractFactory("AttendChainRegistry");
  const registry = await Factory.deploy(deployer.address, qrSignerAddress);
  await registry.waitForDeployment();

  const registryAddress = await registry.getAddress();
  console.log(`AttendChainRegistry deployed at: ${registryAddress}`);
  console.log(
    "Waiting for 5 block confirmations before triggering Etherscan verification..."
  );

  const deploymentTx = registry.deploymentTransaction();
  if (deploymentTx) {
    await deploymentTx.wait(5);
  }

  console.log(`Submitting source code verification to Sepolia Etherscan...`);
  try {
    await hre.run("verify:verify", {
      address: registryAddress,
      constructorArguments: [deployer.address, qrSignerAddress],
    });
    console.log(
      "AttendChainRegistry successfully verified on Sepolia Etherscan!"
    );
  } catch (err: unknown) {
    console.warn(
      "Etherscan verification response:",
      err instanceof Error ? err.message : err
    );
  }

  console.log(`\nDeployment Summary:`);
  console.log(`Contract: ${registryAddress}`);
  console.log(
    `Etherscan: https://sepolia.etherscan.io/address/${registryAddress}`
  );
}

main().catch((error) => {
  console.error("Sepolia deployment failed:", error);
  process.exitCode = 1;
});
