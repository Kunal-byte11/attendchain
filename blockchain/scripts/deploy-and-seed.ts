import fs from "fs";
import path from "path";
import hre from "hardhat";

const { ethers } = hre;

async function main() {
  console.log("Starting AttendChain local deployment and synthetic seeding...");

  const [admin, teacher, student1, student2] = await ethers.getSigners();
  if (!admin || !teacher || !student1 || !student2) {
    throw new Error("Local Hardhat network must provide at least 4 accounts.");
  }

  console.log(`Admin account:   ${admin.address}`);
  console.log(`Teacher account: ${teacher.address}`);
  console.log(`Student 1:       ${student1.address}`);
  console.log(`Student 2:       ${student2.address}`);

  const qrSigner = admin; // In local dev, admin serves as default QR signer

  const Factory = await ethers.getContractFactory("AttendChainRegistry");
  const registry = (await Factory.deploy(admin.address, qrSigner.address)) as any;
  await registry.waitForDeployment();

  const registryAddress = await registry.getAddress();
  console.log(`AttendChainRegistry deployed to: ${registryAddress}`);

  // 1. Grant TEACHER_ROLE to teacher account
  const grantTx = await (registry.connect(admin) as any)
    .grantTeacherRole(teacher.address);
  await grantTx.wait();
  console.log(`Granted TEACHER_ROLE to ${teacher.address}`);

  // 2. Seed synthetic courses: CS701 (Distributed Systems) and CS702 (Blockchain Engineering)
  const courseCode1 = "CS701";
  const courseIdHash1 = ethers.id(courseCode1);
  const courseTx1 = await (registry.connect(admin) as any)
    .createCourse(courseIdHash1, teacher.address);
  await courseTx1.wait();
  console.log(`Created course ${courseCode1} (Hash: ${courseIdHash1})`);

  const courseCode2 = "CS702";
  const courseIdHash2 = ethers.id(courseCode2);
  const courseTx2 = await (registry.connect(admin) as any)
    .createCourse(courseIdHash2, teacher.address);
  await courseTx2.wait();
  console.log(`Created course ${courseCode2} (Hash: ${courseIdHash2})`);

  // 3. Enroll synthetic student cohorts (TR-004 deterministic salted hashes)
  const salt =
    "0x1111111111111111111111111111111111111111111111111111111111111111";
  const rollNumbers = [
    "SYN-2026-042", // Aarav Mehta
    "SYN-2026-019", // Diya Nair
    "SYN-2026-007", // Rohan Kulkarni
  ];

  const studentHashes = rollNumbers.map((roll) =>
    ethers.solidityPackedKeccak256(["bytes32", "string"], [salt, roll])
  );

  const enrollTx = await (registry.connect(admin) as any)
    .enrollStudentsBatch(courseIdHash1, studentHashes);
  await enrollTx.wait();
  console.log(
    `Enrolled ${studentHashes.length} synthetic students in ${courseCode1}`
  );

  // 4. Export deployments.json artifact for frontend and backend consumption
  const deploymentsDir = path.join(process.cwd(), "src", "lib", "blockchain");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const network = await ethers.provider.getNetwork();
  const artifactPath = path.join(
    process.cwd(),
    "blockchain",
    "artifacts",
    "blockchain",
    "contracts",
    "AttendChainRegistry.sol",
    "AttendChainRegistry.json"
  );

  let abi: unknown[] = [];
  if (fs.existsSync(artifactPath)) {
    const rawArtifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
    abi = rawArtifact.abi;
  }

  const deploymentData = {
    network: network.name,
    chainId: Number(network.chainId),
    contracts: {
      AttendChainRegistry: {
        address: registryAddress,
        admin: admin.address,
        qrSigner: qrSigner.address,
        deployedAt: new Date().toISOString(),
        abi,
      },
    },
    seedData: {
      courses: [
        {
          courseCode: courseCode1,
          courseIdHash: courseIdHash1,
          teacher: teacher.address,
        },
        {
          courseCode: courseCode2,
          courseIdHash: courseIdHash2,
          teacher: teacher.address,
        },
      ],
      enrolledStudents: rollNumbers.map((roll, idx) => ({
        rollNumber: roll,
        studentIdHash: studentHashes[idx],
      })),
    },
  };

  const outputPath = path.join(deploymentsDir, "deployments.json");
  fs.writeFileSync(
    outputPath,
    JSON.stringify(deploymentData, null, 2),
    "utf-8"
  );
  console.log(`Deployment manifest written to: ${outputPath}`);
  console.log("Local deployment and synthetic seeding completed successfully.");
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
