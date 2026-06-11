import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

const require = createRequire(import.meta.url);
const requiredPackages = ["@opennextjs/cloudflare"];
const missingPackages = requiredPackages.filter((packageName) => {
  try {
    require.resolve(`${packageName}/package.json`);
    return false;
  } catch {
    return true;
  }
});

if (missingPackages.length > 0) {
  console.log(`Installing Cloudflare build dependencies: ${missingPackages.join(", ")}`);
  execFileSync(
    "npm",
    [
      "install",
      "--no-save",
      "--package-lock=false",
      ...missingPackages.map((packageName) => `${packageName}@latest`),
    ],
    { stdio: "inherit" },
  );
}
