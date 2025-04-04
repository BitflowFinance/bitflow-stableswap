import { describe, it } from "vitest";
import { contractPrincipalCV, cvToValue } from "@stacks/transactions";
import { createPool, addLiquidity, mintTokens, withdrawLiquidity, getPool } from "./utils";
import * as fs from "fs";
import * as path from "path";

// STX and stSTX represent X and Y
const tokenXContractName = "token-stx";
const tokenYContractName = "token-ststx";

const tokenXDecimals = 1e6;
const tokenYDecimals = 1e6;

const accounts = simnet.getAccounts();
const deployerAccount = accounts.get("deployer")!;
const userAccount = accounts.get("wallet_1")!;
const feeRecipient = accounts.get("wallet_4")!;

const tokenXContractPrincipal = contractPrincipalCV(deployerAccount, tokenXContractName);
const tokenYContractPrincipal = contractPrincipalCV(deployerAccount, tokenYContractName);

describe("Stableswap - Fuzz Test 1 (TVL BALANCED)", () => {
  // Set initial pool balances used for all trials from environment or default
  const amountForPoolCreation = process.env.AMOUNT_FOR_POOL_CREATION
    ? parseInt(process.env.AMOUNT_FOR_POOL_CREATION, 10)
    : 500_000_000000;

  // Set bounds used to calculate random amounts to add
  const minAmountForAddLiquidity = 1_000_000000; // 1,000 STX/stSTX
  const maxAmountForAddLiquidity = 5_000_000000; // 5,000 STX/stSTX

  // When enabled, calculate random amounts to add using percentage of the pool's balances
  const calculateAddLiquidityAsPercent = true;
  const minPercentForAddLiquidity = 0.01;
  const maxPercentForAddLiquidity = 1;

  // Set midpoint primary ratio
  const primaryNumerator = 1_000_000;
  const primaryDenominator = 1_100_000;
  const primaryRatio = primaryDenominator / primaryNumerator;

  // Set midpoint withdraw denominator from environment or default
  const withdrawDenominator = process.env.WITHDRAW_DENOMINATOR
    ? parseInt(process.env.WITHDRAW_DENOMINATOR, 10)
    : 1_088_818;

  // Set number of trials to perform
  const numberOfTrials = 10;

  // TEST_TVL
  it(`Fuzz test with ${numberOfTrials} trials using ${((amountForPoolCreation * 2)/tokenXDecimals).toFixed(6)} STX/stSTX as initial liquidity and ${withdrawDenominator} as the withdraw denominator`, () => {
    // Mint STX and stSTX for pool creation   
    mintTokens(tokenXContractName, amountForPoolCreation, deployerAccount);
    mintTokens(tokenYContractName, amountForPoolCreation, deployerAccount);

    // Create the pool using STX-stSTX mainnet configuration
    createPool(
      tokenXContractPrincipal,      // (x-token-trait <sip-010-trait>)
      tokenYContractPrincipal,      // (y-token-trait <sip-010-trait>)
      amountForPoolCreation,        // (x-amount uint)
      amountForPoolCreation,        // (y-amount uint)
      1_000_000,                    // (burn-amount uint)
      primaryNumerator,             // (midpoint-primary-numerator uint)
      primaryDenominator,           // (midpoint-primary-denominator uint)
      1_000_000,                    // (midpoint-withdraw-numerator uint)
      withdrawDenominator,          // (midpoint-withdraw-denominator uint)
      4,                            // (x-protocol-fee uint)
      6,                            // (x-provider-fee uint)
      4,                            // (y-protocol-fee uint)
      6,                            // (y-provider-fee uint)
      10,                           // (liquidity-fee uint)
      100,                          // (amplification-coefficient uint)
      2,                            // (convergence-threshold uint)
      feeRecipient,                 // (fee-address principal)
      "uri",                        // (uri (string-utf8 256))
      true,                         // (status bool)
      deployerAccount
    );

    // Mint STX so the user can add liquidity and balance the pool
    const xAmountToBalancePool = Math.floor((amountForPoolCreation * primaryRatio) - amountForPoolCreation);
    mintTokens(tokenXContractName, xAmountToBalancePool, userAccount);

    // Add liquidity to the pool to balance it
    addLiquidity(
      tokenXContractPrincipal,
      tokenYContractPrincipal,
      xAmountToBalancePool,
      0,
      1,
      userAccount
    );

    // Print initial log
    console.log(`–––––––––––– START TEST_TVL ––––––––––––`);

    // Keep track of all value differences and gains/losses from trials
    const valueDifferences: number[] = [];
    const valueDifferencesPercent: number[] = [];
    let numberOfGains: number = 0;
    let numberOfLosses: number = 0;

    const resultsForExport: Array<{
      initialPoolBalance: number;
      withdrawDenominator: number;
      trialId: number;
      poolBalanceX: number;
      poolBalanceY: number;
      stxAddedEstimated: number;
      stxWithdrawnEstimated: number;
      valueDifference: number;
      valueDifferencePercent: number;
    }> = [];

    // Perform all trials for this denominator
    for (let i = 1; i <= numberOfTrials; i++) {
      // Get pool data
      const getPoolResult = getPool(userAccount);
      const poolBalanceX = Number(getPoolResult.data["x-balance"].value);
      const poolBalanceY = Number(getPoolResult.data["y-balance"].value);

      // Calculate current pool ratio and desired balances
      const poolRatio = poolBalanceX / poolBalanceY;
      const desiredBalanceX = poolBalanceY * primaryRatio;
      const desiredBalanceY = poolBalanceX / primaryRatio;

      // Rebalance the pool if needed
      if (poolRatio < primaryRatio) {
        const xAmountToBalancePool = Math.floor(desiredBalanceX - poolBalanceX);

        mintTokens(tokenXContractName, xAmountToBalancePool, userAccount);
        addLiquidity(
          tokenXContractPrincipal,
          tokenYContractPrincipal,
          xAmountToBalancePool,
          0,
          1,
          userAccount
        );
      } else if (poolRatio > primaryRatio) {
        const yAmountToBalancePool = Math.floor(desiredBalanceY - poolBalanceY);
        mintTokens(tokenYContractName, yAmountToBalancePool, userAccount);
        addLiquidity(
          tokenXContractPrincipal,
          tokenYContractPrincipal,
          0,
          yAmountToBalancePool,
          1,
          userAccount
        );
      };

      // Generate a random amount for add liquidity
      let xAmountForAddLiquidity: number, yAmountForAddLiquidity: number;
      if (calculateAddLiquidityAsPercent) {
        xAmountForAddLiquidity =
          Math.floor(
            poolBalanceX * (Math.exp(
              Math.random() * (Math.log(maxPercentForAddLiquidity) - Math.log(minPercentForAddLiquidity)) +
              Math.log(minPercentForAddLiquidity)
            ) / 100)
          );
        yAmountForAddLiquidity =
          Math.floor(
            poolBalanceY * (Math.exp(
              Math.random() * (Math.log(maxPercentForAddLiquidity) - Math.log(minPercentForAddLiquidity)) +
              Math.log(minPercentForAddLiquidity)
            ) / 100)
          );
        //xAmountForAddLiquidity = Math.floor(yAmountForAddLiquidity * primaryRatio);
      } else {
        xAmountForAddLiquidity =
          Math.floor(
            Math.exp(
              Math.random() * (Math.log(maxAmountForAddLiquidity) - Math.log(minAmountForAddLiquidity)) +
              Math.log(minAmountForAddLiquidity)
            )
          );
        yAmountForAddLiquidity =
          Math.floor(
            Math.exp(
              Math.random() * (Math.log(maxAmountForAddLiquidity) - Math.log(minAmountForAddLiquidity)) +
              Math.log(minAmountForAddLiquidity)
            )
          );
        //xAmountForAddLiquidity = Math.floor(yAmountForAddLiquidity * primaryRatio);
      };

      // Mint STX and stSTX so the user can add liquidity
      mintTokens(tokenXContractName, xAmountForAddLiquidity, userAccount);
      mintTokens(tokenYContractName, yAmountForAddLiquidity, userAccount);

      // Add liquidity to the pool
      const addLiquidityResult = addLiquidity(
        tokenXContractPrincipal,
        tokenYContractPrincipal,
        xAmountForAddLiquidity,
        yAmountForAddLiquidity,
        1,
        userAccount
      );

      // Withdraw liquidity from the pool
      const withdrawLiquidityResult = withdrawLiquidity(
        tokenXContractPrincipal,
        tokenYContractPrincipal,
        cvToValue(addLiquidityResult.result).value,
        1,
        1,
        userAccount
      );
      const xAmountWithdrawn = Number(
        cvToValue(withdrawLiquidityResult.result).value["x-amount"].value
      );
      const yAmountWithdrawn = Number(
        cvToValue(withdrawLiquidityResult.result).value["y-amount"].value
      );

      // Calculate estimated STX value from add and withdraw
      const stxAddedEstimated =
        xAmountForAddLiquidity + (yAmountForAddLiquidity * primaryRatio);
      const stxWithdrawnEstimated =
        xAmountWithdrawn + (yAmountWithdrawn * primaryRatio);

      // Calculate gain/loss difference from add and withdraw
      const valueDifference = stxWithdrawnEstimated - stxAddedEstimated;
      const valueDifferencePercent = (valueDifference / stxAddedEstimated) * 100;

      // Store value difference from trial
      valueDifferences.push(valueDifference);
      valueDifferencesPercent.push(valueDifferencePercent);
      
      // Store gain/loss from trial
      valueDifference > 0
        ? numberOfGains += 1
        : numberOfLosses += 1

      // Get final pool data
      const updatedGetPoolResult = getPool(userAccount);
      const updatedPoolBalanceX = Number(updatedGetPoolResult.data["x-balance"].value);
      const updatedPoolBalanceY = Number(updatedGetPoolResult.data["y-balance"].value);

      // Store trial result for export
      resultsForExport.push({
        initialPoolBalance: amountForPoolCreation * 2,
        withdrawDenominator,
        trialId: i,
        poolBalanceX: updatedPoolBalanceX,
        poolBalanceY: updatedPoolBalanceY,
        stxAddedEstimated: stxAddedEstimated / tokenXDecimals,
        stxWithdrawnEstimated: stxWithdrawnEstimated / tokenXDecimals,
        valueDifference: valueDifference / tokenXDecimals,
        valueDifferencePercent: valueDifferencePercent
      });

      // Format value difference for logging
      const valueDifferenceSign = valueDifference >= 0 ? "+" : "-";
      const valueDifferenceAbs = Math.abs(valueDifference) / tokenXDecimals;
      const valueDifferencePercentAbs = Math.abs(valueDifferencePercent);

      // Print log for trial
      console.log(
        `[Trial ${i}] Added ≈ ${(stxAddedEstimated / tokenXDecimals).toFixed(6)} STX,` +
          ` Withdrawn ≈ ${(stxWithdrawnEstimated / tokenXDecimals).toFixed(6)} STX` +
          ` | Difference: ${valueDifferenceSign}${valueDifferenceAbs.toFixed(6)} STX (${valueDifferenceSign}${valueDifferencePercentAbs.toFixed(2)}%)`
      );
    };

    // Calculate data points for final log
    const averageValueDifferencePercent = valueDifferencesPercent.reduce((a,b)=>a+b,0) / valueDifferencesPercent.length;
    const minValueDifferencePercent = Math.min(...valueDifferencesPercent);
    const maxValueDifferencePercent = Math.max(...valueDifferencesPercent);

    // Get final pool data
    const getPoolResult = getPool(userAccount);
    const poolBalanceX = Number(getPoolResult.data["x-balance"].value);
    const poolBalanceY = Number(getPoolResult.data["y-balance"].value);

    // Print final log
    console.log("–––––––––––– SUMMARY TEST_TVL ––––––––––––");
    console.log(`[Total trials] ${numberOfTrials} (${numberOfGains} gains / ${numberOfLosses} losses)`);
    console.log(`[Final balances] ${(poolBalanceX / tokenXDecimals).toFixed(6)} STX / ${(poolBalanceY / tokenYDecimals).toFixed(6)} stSTX (${(poolBalanceX / (poolBalanceY * primaryRatio)).toFixed(4)}%)`);
    console.log(`[Mean difference] ${averageValueDifferencePercent.toFixed(4)}%`);
    console.log(`[Min difference] ${minValueDifferencePercent.toFixed(4)}%`);
    console.log(`[Max difference] ${maxValueDifferencePercent.toFixed(4)}%`);
    console.log("–––––––––––– END TEST_TVL ––––––––––––");

    // Export results from all trials to CSV
    const csvRows = ["initialPoolBalance,withdrawDenominator,trialId,poolBalanceX,poolBalanceY,stxAddedEstimated,stxWithdrawnEstimated,valueDifference,valueDifferencePercent"];
    for (const r of resultsForExport) {
      csvRows.push(
        `${r.initialPoolBalance},${r.withdrawDenominator},${r.trialId},${r.poolBalanceX},${r.poolBalanceY},${r.stxAddedEstimated},${r.stxWithdrawnEstimated},${r.valueDifference},${r.valueDifferencePercent}`
      );
    };

    const outputDirectory = "/tvl";
    if (!fs.existsSync(outputDirectory)) fs.mkdirSync(outputDirectory, { recursive: true });
    
    const csvFilePath = path.join(outputDirectory, `fuzz_balanced_tvl_${amountForPoolCreation * 2}_${withdrawDenominator}.csv`)
    fs.writeFileSync(csvFilePath, csvRows.join("\n"), "utf8");
  });
});
