import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("AttendChainRegistryModule", (m) => {
  const admin = m.getAccount(0);
  const qrSigner = m.getParameter("qrSigner", admin);

  const registry = m.contract("AttendChainRegistry", [admin, qrSigner]);

  return { registry };
});
