import { exec } from "node:child_process";

const poolSizes = [];

const basePoolValues = [
  10_000,
  15_000,
  20_000,
  25_000,
  50_000,
  75_000,
  100_000,
  125_000,
  150_000,
  175_000,
  200_000,
  225_000,
  250_000,
  275_000,
  300_000,
  325_000,
  350_000,
  375_000,
  400_000,
  425_000,
  450_000,
  475_000,
  500_000,
  525_000,
  550_000,
  575_000,
  600_000,
  625_000,
  650_000,
  675_000,
  700_000,
  725_000,
  750_000,
  775_000,
  800_000,
  825_000,
  850_000,
  875_000,
  900_000,
  925_000,
  950_000,
  975_000,
  1_000_000,
  1_250_000,
  1_500_000,
  1_750_000,
  2_000_000,
  2_250_000,
  2_500_000,
  2_750_000,
  3_000_000,
  3_250_000,
  3_500_000,
  3_750_000,
  4_000_000,
  4_250_000,
  4_500_000,
  4_750_000,
  5_000_000,
  5_250_000,
  5_500_000,
  5_750_000,
  6_000_000,
  6_250_000,
  6_500_000,
  6_750_000,
  7_000_000,
  7_250_000,
  7_500_000,
  7_750_000,
  8_000_000,
  8_250_000,
  8_500_000,
  8_750_000,
  9_000_000,
  9_250_000,
  9_500_000,
  9_750_000,
  10_000_000,
  10_250_000,
  10_500_000,
  10_750_000
];

for (const val of basePoolValues) {
  poolSizes.push(val * 1_000_000);
};

const minDenominator = 1_000_000;
const maxDenominator = 1_200_000;
const denominatorStep = 1_000;

const denominators = [];
for (let d = minDenominator; d <= maxDenominator; d += denominatorStep) {
  denominators.push(d);
};

const commands = [];
for (const size of poolSizes) {
  for (const denom of denominators) {
    const cmd = `AMOUNT_FOR_POOL_CREATION=${size} ` +
                `WITHDRAW_DENOMINATOR=${denom} ` +
                `npm run test`;
    commands.push(cmd);
  }
}

console.log(`–––––––––––– START EXECUTING COMMANDS ––––––––––––`);
console.log(`Total commands to execute: ${commands.length}`);

function execCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing command: ${command}`);
        console.error(error);
        return reject(error);
      }
      console.log(`stdout: ${stdout}`);
      if (stderr) {
        console.error(`stderr: ${stderr}`);
      }
      resolve();
    });
  });
}

(async () => {
  for (const command of commands) {
    console.log(`> ${command}`);
    await execCommand(command);
  }
  console.log(`–––––––––––– END EXECUTING COMMANDS ––––––––––––`);
})();
