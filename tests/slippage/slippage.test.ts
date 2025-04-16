import { describe, it } from "vitest";
import { contractPrincipalCV, cvToValue } from "@stacks/transactions";
import { createPool, addLiquidity, mintTokens, setAmplificationCoefficient, getDy, getDx } from "./utils";

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

describe("Stableswap - Slippage - Quote Tests", () => {
  // Initial pool balances used for all tests
  const xAmountForPoolCreation = 500000_000000; // 500,000 X
  const yAmountForPoolCreation = 500000_000000; // 500,000 Y

  // Amplification coefficents used in all tests
  const amplificationCoefficients = [
    1,
    2,
    3,
    4,
    5,
    10,
    15,
    20,
    25,
    50,
    75,
    100,
    250
  ];

  // Percentages used to calculate amounts for quotes in all tests
  const percentagesForQuotes = [
    1,
    2,
    3,
    4,
    5,
    10,
    15,
    20,
    25,
    50,
    75
  ];

  // Midpoint values used in all tests
  const midpointPrimaryNumerator = 1_000_000;
  const midpointPrimaryDenominator = 1_000_000;
  const midpointWithdrawNumerator = 1_000_000;
  const midpointWithdrawDenominator = 1_000_000;

  // TEST_#1 (50:50 pool ratio)
  it(`Get ${((percentagesForQuotes.length + 1) * amplificationCoefficients.length) * 2} quotes(s) at a 50:50 pool ratio`, () => {
    // Set the ratio of the pool balances
    const [xBalanceRatio, yBalanceRatio] = [50, 50];

    // Mint X and Y for pool creation   
    mintTokens(tokenXContractName, xAmountForPoolCreation, deployerAccount);
    mintTokens(tokenYContractName, yAmountForPoolCreation, deployerAccount);

    // Create the pool using aeUSDC-USDh mainnet configuration
    createPool(
      tokenXContractPrincipal,      // (x-token-trait <sip-010-trait>)
      tokenYContractPrincipal,      // (y-token-trait <sip-010-trait>)
      xAmountForPoolCreation,       // (x-amount uint)
      yAmountForPoolCreation,       // (y-amount uint)
      1000,                         // (burn-amount uint)
      midpointPrimaryNumerator,     // (midpoint-primary-numerator uint)
      midpointPrimaryDenominator,   // (midpoint-primary-denominator uint)
      midpointWithdrawNumerator,    // (midpoint-withdraw-numerator uint)
      midpointWithdrawDenominator,  // (midpoint-withdraw-denominator uint)
      2,                            // (x-protocol-fee uint)
      3,                            // (x-provider-fee uint)
      2,                            // (y-protocol-fee uint)
      3,                            // (y-provider-fee uint)
      5,                            // (liquidity-fee uint)
      amplificationCoefficients[0], // (amplification-coefficient uint)
      2,                            // (convergence-threshold uint)
      true,                         // (imbalanced-withdraws bool)
      0,                            // (withdraw-cooldown uint)
      false,                        // (freeze-midpoint-manager bool)
      feeRecipient,                 // (fee-address principal)
      "uri",                        // (uri (string-utf8 256))
      true,                         // (status bool)
      deployerAccount
    );

    // Mint X and Y so the user can add liquidity
    const xAmountForAddLiquidity = Math.max((yAmountForPoolCreation * (xBalanceRatio / yBalanceRatio)) - xAmountForPoolCreation, 0);
    const yAmountForAddLiquidity = Math.max((xAmountForPoolCreation * (yBalanceRatio / xBalanceRatio)) - yAmountForPoolCreation, 0);
    mintTokens(tokenXContractName, xAmountForAddLiquidity, userAccount);
    mintTokens(tokenYContractName, yAmountForAddLiquidity, userAccount);

    // Add liquidity to adjust the balances of the pool
    addLiquidity(
      tokenXContractPrincipal,
      tokenYContractPrincipal,
      xAmountForAddLiquidity,
      yAmountForAddLiquidity,
      1,
      userAccount
    );

    // Calculate updated pool balances after adding liquidity
    const xBalanceAfterAddingLiquidity = xAmountForPoolCreation + xAmountForAddLiquidity;
    const yBalanceAfterAddingLiquidity = yAmountForPoolCreation + yAmountForAddLiquidity;

    // Track the total number of quotes
    let quoteIndex = 0;
    
    // Print initial logs
    console.log(`–––––––––––– TEST_#1 ––––––––––––`);
    console.log(
      `[Pool ratio] ${xBalanceRatio}:${yBalanceRatio} ` +
      `(${xBalanceAfterAddingLiquidity / tokenXDecimals} X / ` +
      `${yBalanceAfterAddingLiquidity / tokenXDecimals} Y)`
    );

    // Iterate over each amplification coefficient
    amplificationCoefficients.forEach((coefficient) => {
      // Set the pool's amplification coefficient
      setAmplificationCoefficient(coefficient, deployerAccount);
      console.log(
        `\n`,
        `> Amplification coefficient: ${coefficient}`,
        `\n`
      );

      // Get X to Y quote using 1 token
      const xAmountForQuote = 1 * tokenXDecimals;
      const getDyResult = getDy(
        tokenXContractPrincipal,
        tokenYContractPrincipal,
        xAmountForQuote,
        userAccount
      );

      // Get the amount of Y the user would receive
      const yAmountQuoted = cvToValue(getDyResult.result).value;

      // Scale down amounts and calculate value difference (gain/loss assuming both tokens are worth $1)
      const xAmountForQuoteScaled = xAmountForQuote / tokenXDecimals;
      const yAmountQuotedScaled = yAmountQuoted / tokenYDecimals;
      const valueDifferenceXtoY = yAmountQuotedScaled - xAmountForQuoteScaled;
      const valueDifferenceXtoYPercentage = (valueDifferenceXtoY / xAmountForQuoteScaled) * 100;

      // Update quoteIndex and return final quote result
      quoteIndex += 1;
      console.log(
        `[Quote #${quoteIndex}] ` +
        `${xAmountForQuoteScaled.toFixed(6)} X -> ` +
        `${yAmountQuotedScaled.toFixed(6)} Y ` +
        `(Difference: ${valueDifferenceXtoY.toFixed(6)} / ${valueDifferenceXtoYPercentage.toFixed(6)}%)`
      );

      // Get Y to X quote using 1 token
      const yAmountForQuote = 1 * tokenYDecimals;
      const getDxResult = getDx(
        tokenXContractPrincipal,
        tokenYContractPrincipal,
        yAmountForQuote,
        userAccount
      );

      // Get the amount of X the user would receive
      const xAmountQuoted = cvToValue(getDxResult.result).value;

      // Scale down amounts and calculate value difference (gain/loss assuming both tokens are worth $1)
      const yAmountForQuoteScaled = yAmountForQuote / tokenXDecimals;
      const xAmountQuotedScaled = xAmountQuoted / tokenYDecimals;
      const valueDifferenceYtoX = xAmountQuotedScaled - yAmountForQuoteScaled;
      const valueDifferenceYtoXPercentage = (valueDifferenceYtoX / yAmountForQuoteScaled) * 100;

      // Update quoteIndex and return final quote result
      quoteIndex += 1;
      console.log(
        `[Quote #${quoteIndex}] ` +
        `${yAmountForQuoteScaled.toFixed(6)} Y -> ` +
        `${xAmountQuotedScaled.toFixed(6)} X ` +
        `(Difference: ${valueDifferenceYtoX.toFixed(6)} / ${valueDifferenceYtoXPercentage.toFixed(6)}%)`
      );
      
      // Get X to Y quotes
      percentagesForQuotes.forEach((percent) => {
        // Calculate amount to use for the quote
        const xAmountForQuote = Math.floor(xBalanceAfterAddingLiquidity * (percent / 100));
        if (xAmountForQuote > 0) {
          // Get the quote using the calculated amount
          const getDyResult = getDy(
            tokenXContractPrincipal,
            tokenYContractPrincipal,
            xAmountForQuote,
            userAccount
          );

          // Get the amount of Y the user would receive
          const yAmountQuoted = cvToValue(getDyResult.result).value;

          // Scale down amounts and calculate value difference (gain/loss assuming both tokens are worth $1)
          const xAmountForQuoteScaled = xAmountForQuote / tokenXDecimals;
          const yAmountQuotedScaled = yAmountQuoted / tokenYDecimals;
          const valueDifference = yAmountQuotedScaled - xAmountForQuoteScaled;
          const valueDifferencePercentage = (valueDifference / xAmountForQuoteScaled) * 100;

          // Update quoteIndex and return final quote result
          quoteIndex += 1;
          console.log(
            `[Quote #${quoteIndex}] ` +
            `${xAmountForQuoteScaled.toFixed(2)} X -> ` +
            `${yAmountQuotedScaled.toFixed(2)} Y ` +
            `(Difference: ${valueDifference.toFixed(2)} / ${valueDifferencePercentage.toFixed(2)}%)`
          );
        };
      });

      // Get Y to X quotes
      percentagesForQuotes.forEach((percent) => {
        // Calculate amount to use for the quote
        const yAmountForQuote = Math.floor(yBalanceAfterAddingLiquidity * (percent / 100));
        if (yAmountForQuote > 0) {
          // Get the quote using the calculated amount
          const getDxResult = getDx(
            tokenXContractPrincipal,
            tokenYContractPrincipal,
            yAmountForQuote,
            userAccount
          );

          // Get the amount of X the user would receive
          const xAmountQuoted = cvToValue(getDxResult.result).value;

          // Scale down amounts and calculate value difference (gain/loss assuming both tokens are worth $1)
          const yAmountForQuoteScaled = yAmountForQuote / tokenXDecimals;
          const xAmountQuotedScaled = xAmountQuoted / tokenYDecimals;
          const valueDifference = xAmountQuotedScaled - yAmountForQuoteScaled;
          const valueDifferencePercentage = (valueDifference / yAmountForQuoteScaled) * 100;

          // Update quoteIndex and return final quote result
          quoteIndex += 1;
          console.log(
            `[Quote #${quoteIndex}] ` +
            `${yAmountForQuoteScaled.toFixed(2)} Y -> ` +
            `${xAmountQuotedScaled.toFixed(2)} X ` +
            `(Difference: ${valueDifference.toFixed(2)} / ${valueDifferencePercentage.toFixed(2)}%)`
          );
        };
      });
    });

    // Print final log
    console.log(`–––––––––––– TEST_#1 ––––––––––––`);
  });

  // TEST_#2 (40:60 pool ratio)
  it(`Get ${((percentagesForQuotes.length + 1) * amplificationCoefficients.length) * 2} quotes(s) at a 40:60 pool ratio`, () => {
    // Set the ratio of the pool balances
    const [xBalanceRatio, yBalanceRatio] = [40, 60];

    // Mint X and Y for pool creation   
    mintTokens(tokenXContractName, xAmountForPoolCreation, deployerAccount);
    mintTokens(tokenYContractName, yAmountForPoolCreation, deployerAccount);

    // Create the pool using aeUSDC-USDh mainnet configuration
    createPool(
      tokenXContractPrincipal,      // (x-token-trait <sip-010-trait>)
      tokenYContractPrincipal,      // (y-token-trait <sip-010-trait>)
      xAmountForPoolCreation,       // (x-amount uint)
      yAmountForPoolCreation,       // (y-amount uint)
      1000,                         // (burn-amount uint)
      midpointPrimaryNumerator,     // (midpoint-primary-numerator uint)
      midpointPrimaryDenominator,   // (midpoint-primary-denominator uint)
      midpointWithdrawNumerator,    // (midpoint-withdraw-numerator uint)
      midpointWithdrawDenominator,  // (midpoint-withdraw-denominator uint)
      2,                            // (x-protocol-fee uint)
      3,                            // (x-provider-fee uint)
      2,                            // (y-protocol-fee uint)
      3,                            // (y-provider-fee uint)
      5,                            // (liquidity-fee uint)
      amplificationCoefficients[0], // (amplification-coefficient uint)
      2,                            // (convergence-threshold uint)
      true,                         // (imbalanced-withdraws bool)
      0,                            // (withdraw-cooldown uint)
      false,                        // (freeze-midpoint-manager bool)
      feeRecipient,                 // (fee-address principal)
      "uri",                        // (uri (string-utf8 256))
      true,                         // (status bool)
      deployerAccount
    );

    // Mint X and Y so the user can add liquidity
    const xAmountForAddLiquidity = Math.max((yAmountForPoolCreation * (xBalanceRatio / yBalanceRatio)) - xAmountForPoolCreation, 0);
    const yAmountForAddLiquidity = Math.max((xAmountForPoolCreation * (yBalanceRatio / xBalanceRatio)) - yAmountForPoolCreation, 0);
    mintTokens(tokenXContractName, xAmountForAddLiquidity, userAccount);
    mintTokens(tokenYContractName, yAmountForAddLiquidity, userAccount);

    // Add liquidity to adjust the balances of the pool
    addLiquidity(
      tokenXContractPrincipal,
      tokenYContractPrincipal,
      xAmountForAddLiquidity,
      yAmountForAddLiquidity,
      1,
      userAccount
    );

    // Calculate updated pool balances after adding liquidity
    const xBalanceAfterAddingLiquidity = xAmountForPoolCreation + xAmountForAddLiquidity;
    const yBalanceAfterAddingLiquidity = yAmountForPoolCreation + yAmountForAddLiquidity;

    // Track the total number of quotes
    let quoteIndex = 0;
    
    // Print initial logs
    console.log(`–––––––––––– TEST_#2 ––––––––––––`);
    console.log(
      `[Pool ratio] ${xBalanceRatio}:${yBalanceRatio} ` +
      `(${xBalanceAfterAddingLiquidity / tokenXDecimals} X / ` +
      `${yBalanceAfterAddingLiquidity / tokenXDecimals} Y)`
    );

    // Iterate over each amplification coefficient
    amplificationCoefficients.forEach((coefficient) => {
      // Set the pool's amplification coefficient
      setAmplificationCoefficient(coefficient, deployerAccount);
      console.log(
        `\n`,
        `> Amplification coefficient: ${coefficient}`,
        `\n`
      );

      // Get X to Y quote using 1 token
      const xAmountForQuote = 1 * tokenXDecimals;
      const getDyResult = getDy(
        tokenXContractPrincipal,
        tokenYContractPrincipal,
        xAmountForQuote,
        userAccount
      );

      // Get the amount of Y the user would receive
      const yAmountQuoted = cvToValue(getDyResult.result).value;

      // Scale down amounts and calculate value difference (gain/loss assuming both tokens are worth $1)
      const xAmountForQuoteScaled = xAmountForQuote / tokenXDecimals;
      const yAmountQuotedScaled = yAmountQuoted / tokenYDecimals;
      const valueDifferenceXtoY = yAmountQuotedScaled - xAmountForQuoteScaled;
      const valueDifferenceXtoYPercentage = (valueDifferenceXtoY / xAmountForQuoteScaled) * 100;

      // Update quoteIndex and return final quote result
      quoteIndex += 1;
      console.log(
        `[Quote #${quoteIndex}] ` +
        `${xAmountForQuoteScaled.toFixed(6)} X -> ` +
        `${yAmountQuotedScaled.toFixed(6)} Y ` +
        `(Difference: ${valueDifferenceXtoY.toFixed(6)} / ${valueDifferenceXtoYPercentage.toFixed(6)}%)`
      );

      // Get Y to X quote using 1 token
      const yAmountForQuote = 1 * tokenYDecimals;
      const getDxResult = getDx(
        tokenXContractPrincipal,
        tokenYContractPrincipal,
        yAmountForQuote,
        userAccount
      );

      // Get the amount of X the user would receive
      const xAmountQuoted = cvToValue(getDxResult.result).value;

      // Scale down amounts and calculate value difference (gain/loss assuming both tokens are worth $1)
      const yAmountForQuoteScaled = yAmountForQuote / tokenXDecimals;
      const xAmountQuotedScaled = xAmountQuoted / tokenYDecimals;
      const valueDifferenceYtoX = xAmountQuotedScaled - yAmountForQuoteScaled;
      const valueDifferenceYtoXPercentage = (valueDifferenceYtoX / yAmountForQuoteScaled) * 100;

      // Update quoteIndex and return final quote result
      quoteIndex += 1;
      console.log(
        `[Quote #${quoteIndex}] ` +
        `${yAmountForQuoteScaled.toFixed(6)} Y -> ` +
        `${xAmountQuotedScaled.toFixed(6)} X ` +
        `(Difference: ${valueDifferenceYtoX.toFixed(6)} / ${valueDifferenceYtoXPercentage.toFixed(6)}%)`
      );
      
      // Get X to Y quotes
      percentagesForQuotes.forEach((percent) => {
        // Calculate amount to use for the quote
        const xAmountForQuote = Math.floor(xBalanceAfterAddingLiquidity * (percent / 100));
        if (xAmountForQuote > 0) {
          // Get the quote using the calculated amount
          const getDyResult = getDy(
            tokenXContractPrincipal,
            tokenYContractPrincipal,
            xAmountForQuote,
            userAccount
          );

          // Get the amount of Y the user would receive
          const yAmountQuoted = cvToValue(getDyResult.result).value;

          // Scale down amounts and calculate value difference (gain/loss assuming both tokens are worth $1)
          const xAmountForQuoteScaled = xAmountForQuote / tokenXDecimals;
          const yAmountQuotedScaled = yAmountQuoted / tokenYDecimals;
          const valueDifference = yAmountQuotedScaled - xAmountForQuoteScaled;
          const valueDifferencePercentage = (valueDifference / xAmountForQuoteScaled) * 100;

          // Update quoteIndex and return final quote result
          quoteIndex += 1;
          console.log(
            `[Quote #${quoteIndex}] ` +
            `${xAmountForQuoteScaled.toFixed(2)} X -> ` +
            `${yAmountQuotedScaled.toFixed(2)} Y ` +
            `(Difference: ${valueDifference.toFixed(2)} / ${valueDifferencePercentage.toFixed(2)}%)`
          );
        };
      });

      // Get Y to X quotes
      percentagesForQuotes.forEach((percent) => {
        // Calculate amount to use for the quote
        const yAmountForQuote = Math.floor(yBalanceAfterAddingLiquidity * (percent / 100));
        if (yAmountForQuote > 0) {
          // Get the quote using the calculated amount
          const getDxResult = getDx(
            tokenXContractPrincipal,
            tokenYContractPrincipal,
            yAmountForQuote,
            userAccount
          );

          // Get the amount of X the user would receive
          const xAmountQuoted = cvToValue(getDxResult.result).value;

          // Scale down amounts and calculate value difference (gain/loss assuming both tokens are worth $1)
          const yAmountForQuoteScaled = yAmountForQuote / tokenXDecimals;
          const xAmountQuotedScaled = xAmountQuoted / tokenYDecimals;
          const valueDifference = xAmountQuotedScaled - yAmountForQuoteScaled;
          const valueDifferencePercentage = (valueDifference / yAmountForQuoteScaled) * 100;

          // Update quoteIndex and return final quote result
          quoteIndex += 1;
          console.log(
            `[Quote #${quoteIndex}] ` +
            `${yAmountForQuoteScaled.toFixed(2)} Y -> ` +
            `${xAmountQuotedScaled.toFixed(2)} X ` +
            `(Difference: ${valueDifference.toFixed(2)} / ${valueDifferencePercentage.toFixed(2)}%)`
          );
        };
      });
    });

    // Print final log
    console.log(`–––––––––––– TEST_#2 ––––––––––––`);
  });

  // TEST_#3 (33:67 pool ratio)
  it(`Get ${((percentagesForQuotes.length + 1) * amplificationCoefficients.length) * 2} quotes(s) at a 33:67 pool ratio`, () => {
    // Set the ratio of the pool balances
    const [xBalanceRatio, yBalanceRatio] = [33, 67];

    // Mint X and Y for pool creation   
    mintTokens(tokenXContractName, xAmountForPoolCreation, deployerAccount);
    mintTokens(tokenYContractName, yAmountForPoolCreation, deployerAccount);

    // Create the pool using aeUSDC-USDh mainnet configuration
    createPool(
      tokenXContractPrincipal,      // (x-token-trait <sip-010-trait>)
      tokenYContractPrincipal,      // (y-token-trait <sip-010-trait>)
      xAmountForPoolCreation,       // (x-amount uint)
      yAmountForPoolCreation,       // (y-amount uint)
      1000,                         // (burn-amount uint)
      midpointPrimaryNumerator,     // (midpoint-primary-numerator uint)
      midpointPrimaryDenominator,   // (midpoint-primary-denominator uint)
      midpointWithdrawNumerator,    // (midpoint-withdraw-numerator uint)
      midpointWithdrawDenominator,  // (midpoint-withdraw-denominator uint)
      2,                            // (x-protocol-fee uint)
      3,                            // (x-provider-fee uint)
      2,                            // (y-protocol-fee uint)
      3,                            // (y-provider-fee uint)
      5,                            // (liquidity-fee uint)
      amplificationCoefficients[0], // (amplification-coefficient uint)
      2,                            // (convergence-threshold uint)
      true,                         // (imbalanced-withdraws bool)
      0,                            // (withdraw-cooldown uint)
      false,                        // (freeze-midpoint-manager bool)
      feeRecipient,                 // (fee-address principal)
      "uri",                        // (uri (string-utf8 256))
      true,                         // (status bool)
      deployerAccount
    );

    // Mint X and Y so the user can add liquidity
    const xAmountForAddLiquidity = Math.max((yAmountForPoolCreation * (xBalanceRatio / yBalanceRatio)) - xAmountForPoolCreation, 0);
    const yAmountForAddLiquidity = Math.max((xAmountForPoolCreation * (yBalanceRatio / xBalanceRatio)) - yAmountForPoolCreation, 0);
    mintTokens(tokenXContractName, xAmountForAddLiquidity, userAccount);
    mintTokens(tokenYContractName, yAmountForAddLiquidity, userAccount);

    // Add liquidity to adjust the balances of the pool
    addLiquidity(
      tokenXContractPrincipal,
      tokenYContractPrincipal,
      xAmountForAddLiquidity,
      yAmountForAddLiquidity,
      1,
      userAccount
    );

    // Calculate updated pool balances after adding liquidity
    const xBalanceAfterAddingLiquidity = xAmountForPoolCreation + xAmountForAddLiquidity;
    const yBalanceAfterAddingLiquidity = yAmountForPoolCreation + yAmountForAddLiquidity;

    // Track the total number of quotes
    let quoteIndex = 0;
    
    // Print initial logs
    console.log(`–––––––––––– TEST_#3 ––––––––––––`);
    console.log(
      `[Pool ratio] ${xBalanceRatio}:${yBalanceRatio} ` +
      `(${xBalanceAfterAddingLiquidity / tokenXDecimals} X / ` +
      `${yBalanceAfterAddingLiquidity / tokenXDecimals} Y)`
    );

    // Iterate over each amplification coefficient
    amplificationCoefficients.forEach((coefficient) => {
      // Set the pool's amplification coefficient
      setAmplificationCoefficient(coefficient, deployerAccount);
      console.log(
        `\n`,
        `> Amplification coefficient: ${coefficient}`,
        `\n`
      );

      // Get X to Y quote using 1 token
      const xAmountForQuote = 1 * tokenXDecimals;
      const getDyResult = getDy(
        tokenXContractPrincipal,
        tokenYContractPrincipal,
        xAmountForQuote,
        userAccount
      );

      // Get the amount of Y the user would receive
      const yAmountQuoted = cvToValue(getDyResult.result).value;

      // Scale down amounts and calculate value difference (gain/loss assuming both tokens are worth $1)
      const xAmountForQuoteScaled = xAmountForQuote / tokenXDecimals;
      const yAmountQuotedScaled = yAmountQuoted / tokenYDecimals;
      const valueDifferenceXtoY = yAmountQuotedScaled - xAmountForQuoteScaled;
      const valueDifferenceXtoYPercentage = (valueDifferenceXtoY / xAmountForQuoteScaled) * 100;

      // Update quoteIndex and return final quote result
      quoteIndex += 1;
      console.log(
        `[Quote #${quoteIndex}] ` +
        `${xAmountForQuoteScaled.toFixed(6)} X -> ` +
        `${yAmountQuotedScaled.toFixed(6)} Y ` +
        `(Difference: ${valueDifferenceXtoY.toFixed(6)} / ${valueDifferenceXtoYPercentage.toFixed(6)}%)`
      );

      // Get Y to X quote using 1 token
      const yAmountForQuote = 1 * tokenYDecimals;
      const getDxResult = getDx(
        tokenXContractPrincipal,
        tokenYContractPrincipal,
        yAmountForQuote,
        userAccount
      );

      // Get the amount of X the user would receive
      const xAmountQuoted = cvToValue(getDxResult.result).value;

      // Scale down amounts and calculate value difference (gain/loss assuming both tokens are worth $1)
      const yAmountForQuoteScaled = yAmountForQuote / tokenXDecimals;
      const xAmountQuotedScaled = xAmountQuoted / tokenYDecimals;
      const valueDifferenceYtoX = xAmountQuotedScaled - yAmountForQuoteScaled;
      const valueDifferenceYtoXPercentage = (valueDifferenceYtoX / yAmountForQuoteScaled) * 100;

      // Update quoteIndex and return final quote result
      quoteIndex += 1;
      console.log(
        `[Quote #${quoteIndex}] ` +
        `${yAmountForQuoteScaled.toFixed(6)} Y -> ` +
        `${xAmountQuotedScaled.toFixed(6)} X ` +
        `(Difference: ${valueDifferenceYtoX.toFixed(6)} / ${valueDifferenceYtoXPercentage.toFixed(6)}%)`
      );
      
      // Get X to Y quotes
      percentagesForQuotes.forEach((percent) => {
        // Calculate amount to use for the quote
        const xAmountForQuote = Math.floor(xBalanceAfterAddingLiquidity * (percent / 100));
        if (xAmountForQuote > 0) {
          // Get the quote using the calculated amount
          const getDyResult = getDy(
            tokenXContractPrincipal,
            tokenYContractPrincipal,
            xAmountForQuote,
            userAccount
          );

          // Get the amount of Y the user would receive
          const yAmountQuoted = cvToValue(getDyResult.result).value;

          // Scale down amounts and calculate value difference (gain/loss assuming both tokens are worth $1)
          const xAmountForQuoteScaled = xAmountForQuote / tokenXDecimals;
          const yAmountQuotedScaled = yAmountQuoted / tokenYDecimals;
          const valueDifference = yAmountQuotedScaled - xAmountForQuoteScaled;
          const valueDifferencePercentage = (valueDifference / xAmountForQuoteScaled) * 100;

          // Update quoteIndex and return final quote result
          quoteIndex += 1;
          console.log(
            `[Quote #${quoteIndex}] ` +
            `${xAmountForQuoteScaled.toFixed(2)} X -> ` +
            `${yAmountQuotedScaled.toFixed(2)} Y ` +
            `(Difference: ${valueDifference.toFixed(2)} / ${valueDifferencePercentage.toFixed(2)}%)`
          );
        };
      });

      // Get Y to X quotes
      percentagesForQuotes.forEach((percent) => {
        // Calculate amount to use for the quote
        const yAmountForQuote = Math.floor(yBalanceAfterAddingLiquidity * (percent / 100));
        if (yAmountForQuote > 0) {
          // Get the quote using the calculated amount
          const getDxResult = getDx(
            tokenXContractPrincipal,
            tokenYContractPrincipal,
            yAmountForQuote,
            userAccount
          );

          // Get the amount of X the user would receive
          const xAmountQuoted = cvToValue(getDxResult.result).value;

          // Scale down amounts and calculate value difference (gain/loss assuming both tokens are worth $1)
          const yAmountForQuoteScaled = yAmountForQuote / tokenXDecimals;
          const xAmountQuotedScaled = xAmountQuoted / tokenYDecimals;
          const valueDifference = xAmountQuotedScaled - yAmountForQuoteScaled;
          const valueDifferencePercentage = (valueDifference / yAmountForQuoteScaled) * 100;

          // Update quoteIndex and return final quote result
          quoteIndex += 1;
          console.log(
            `[Quote #${quoteIndex}] ` +
            `${yAmountForQuoteScaled.toFixed(2)} Y -> ` +
            `${xAmountQuotedScaled.toFixed(2)} X ` +
            `(Difference: ${valueDifference.toFixed(2)} / ${valueDifferencePercentage.toFixed(2)}%)`
          );
        };
      });
    });

    // Print final log
    console.log(`–––––––––––– TEST_#3 ––––––––––––`);
  });

  // TEST_#4 (25:75 pool ratio)
  it(`Get ${((percentagesForQuotes.length + 1) * amplificationCoefficients.length) * 2} quotes(s) at a 25:75 pool ratio`, () => {
    // Set the ratio of the pool balances
    const [xBalanceRatio, yBalanceRatio] = [25, 75];

    // Mint X and Y for pool creation   
    mintTokens(tokenXContractName, xAmountForPoolCreation, deployerAccount);
    mintTokens(tokenYContractName, yAmountForPoolCreation, deployerAccount);

    // Create the pool using aeUSDC-USDh mainnet configuration
    createPool(
      tokenXContractPrincipal,      // (x-token-trait <sip-010-trait>)
      tokenYContractPrincipal,      // (y-token-trait <sip-010-trait>)
      xAmountForPoolCreation,       // (x-amount uint)
      yAmountForPoolCreation,       // (y-amount uint)
      1000,                         // (burn-amount uint)
      midpointPrimaryNumerator,     // (midpoint-primary-numerator uint)
      midpointPrimaryDenominator,   // (midpoint-primary-denominator uint)
      midpointWithdrawNumerator,    // (midpoint-withdraw-numerator uint)
      midpointWithdrawDenominator,  // (midpoint-withdraw-denominator uint)
      2,                            // (x-protocol-fee uint)
      3,                            // (x-provider-fee uint)
      2,                            // (y-protocol-fee uint)
      3,                            // (y-provider-fee uint)
      5,                            // (liquidity-fee uint)
      amplificationCoefficients[0], // (amplification-coefficient uint)
      2,                            // (convergence-threshold uint)
      true,                         // (imbalanced-withdraws bool)
      0,                            // (withdraw-cooldown uint)
      false,                        // (freeze-midpoint-manager bool)
      feeRecipient,                 // (fee-address principal)
      "uri",                        // (uri (string-utf8 256))
      true,                         // (status bool)
      deployerAccount
    );

    // Mint X and Y so the user can add liquidity
    const xAmountForAddLiquidity = Math.max((yAmountForPoolCreation * (xBalanceRatio / yBalanceRatio)) - xAmountForPoolCreation, 0);
    const yAmountForAddLiquidity = Math.max((xAmountForPoolCreation * (yBalanceRatio / xBalanceRatio)) - yAmountForPoolCreation, 0);
    mintTokens(tokenXContractName, xAmountForAddLiquidity, userAccount);
    mintTokens(tokenYContractName, yAmountForAddLiquidity, userAccount);

    // Add liquidity to adjust the balances of the pool
    addLiquidity(
      tokenXContractPrincipal,
      tokenYContractPrincipal,
      xAmountForAddLiquidity,
      yAmountForAddLiquidity,
      1,
      userAccount
    );

    // Calculate updated pool balances after adding liquidity
    const xBalanceAfterAddingLiquidity = xAmountForPoolCreation + xAmountForAddLiquidity;
    const yBalanceAfterAddingLiquidity = yAmountForPoolCreation + yAmountForAddLiquidity;

    // Track the total number of quotes
    let quoteIndex = 0;
    
    // Print initial logs
    console.log(`–––––––––––– TEST_#4 ––––––––––––`);
    console.log(
      `[Pool ratio] ${xBalanceRatio}:${yBalanceRatio} ` +
      `(${xBalanceAfterAddingLiquidity / tokenXDecimals} X / ` +
      `${yBalanceAfterAddingLiquidity / tokenXDecimals} Y)`
    );

    // Iterate over each amplification coefficient
    amplificationCoefficients.forEach((coefficient) => {
      // Set the pool's amplification coefficient
      setAmplificationCoefficient(coefficient, deployerAccount);
      console.log(
        `\n`,
        `> Amplification coefficient: ${coefficient}`,
        `\n`
      );

      // Get X to Y quote using 1 token
      const xAmountForQuote = 1 * tokenXDecimals;
      const getDyResult = getDy(
        tokenXContractPrincipal,
        tokenYContractPrincipal,
        xAmountForQuote,
        userAccount
      );

      // Get the amount of Y the user would receive
      const yAmountQuoted = cvToValue(getDyResult.result).value;

      // Scale down amounts and calculate value difference (gain/loss assuming both tokens are worth $1)
      const xAmountForQuoteScaled = xAmountForQuote / tokenXDecimals;
      const yAmountQuotedScaled = yAmountQuoted / tokenYDecimals;
      const valueDifferenceXtoY = yAmountQuotedScaled - xAmountForQuoteScaled;
      const valueDifferenceXtoYPercentage = (valueDifferenceXtoY / xAmountForQuoteScaled) * 100;

      // Update quoteIndex and return final quote result
      quoteIndex += 1;
      console.log(
        `[Quote #${quoteIndex}] ` +
        `${xAmountForQuoteScaled.toFixed(6)} X -> ` +
        `${yAmountQuotedScaled.toFixed(6)} Y ` +
        `(Difference: ${valueDifferenceXtoY.toFixed(6)} / ${valueDifferenceXtoYPercentage.toFixed(6)}%)`
      );

      // Get Y to X quote using 1 token
      const yAmountForQuote = 1 * tokenYDecimals;
      const getDxResult = getDx(
        tokenXContractPrincipal,
        tokenYContractPrincipal,
        yAmountForQuote,
        userAccount
      );

      // Get the amount of X the user would receive
      const xAmountQuoted = cvToValue(getDxResult.result).value;

      // Scale down amounts and calculate value difference (gain/loss assuming both tokens are worth $1)
      const yAmountForQuoteScaled = yAmountForQuote / tokenXDecimals;
      const xAmountQuotedScaled = xAmountQuoted / tokenYDecimals;
      const valueDifferenceYtoX = xAmountQuotedScaled - yAmountForQuoteScaled;
      const valueDifferenceYtoXPercentage = (valueDifferenceYtoX / yAmountForQuoteScaled) * 100;

      // Update quoteIndex and return final quote result
      quoteIndex += 1;
      console.log(
        `[Quote #${quoteIndex}] ` +
        `${yAmountForQuoteScaled.toFixed(6)} Y -> ` +
        `${xAmountQuotedScaled.toFixed(6)} X ` +
        `(Difference: ${valueDifferenceYtoX.toFixed(6)} / ${valueDifferenceYtoXPercentage.toFixed(6)}%)`
      );
      
      // Get X to Y quotes
      percentagesForQuotes.forEach((percent) => {
        // Calculate amount to use for the quote
        const xAmountForQuote = Math.floor(xBalanceAfterAddingLiquidity * (percent / 100));
        if (xAmountForQuote > 0) {
          // Get the quote using the calculated amount
          const getDyResult = getDy(
            tokenXContractPrincipal,
            tokenYContractPrincipal,
            xAmountForQuote,
            userAccount
          );

          // Get the amount of Y the user would receive
          const yAmountQuoted = cvToValue(getDyResult.result).value;

          // Scale down amounts and calculate value difference (gain/loss assuming both tokens are worth $1)
          const xAmountForQuoteScaled = xAmountForQuote / tokenXDecimals;
          const yAmountQuotedScaled = yAmountQuoted / tokenYDecimals;
          const valueDifference = yAmountQuotedScaled - xAmountForQuoteScaled;
          const valueDifferencePercentage = (valueDifference / xAmountForQuoteScaled) * 100;

          // Update quoteIndex and return final quote result
          quoteIndex += 1;
          console.log(
            `[Quote #${quoteIndex}] ` +
            `${xAmountForQuoteScaled.toFixed(2)} X -> ` +
            `${yAmountQuotedScaled.toFixed(2)} Y ` +
            `(Difference: ${valueDifference.toFixed(2)} / ${valueDifferencePercentage.toFixed(2)}%)`
          );
        };
      });

      // Get Y to X quotes
      percentagesForQuotes.forEach((percent) => {
        // Calculate amount to use for the quote
        const yAmountForQuote = Math.floor(yBalanceAfterAddingLiquidity * (percent / 100));
        if (yAmountForQuote > 0) {
          // Get the quote using the calculated amount
          const getDxResult = getDx(
            tokenXContractPrincipal,
            tokenYContractPrincipal,
            yAmountForQuote,
            userAccount
          );

          // Get the amount of X the user would receive
          const xAmountQuoted = cvToValue(getDxResult.result).value;

          // Scale down amounts and calculate value difference (gain/loss assuming both tokens are worth $1)
          const yAmountForQuoteScaled = yAmountForQuote / tokenXDecimals;
          const xAmountQuotedScaled = xAmountQuoted / tokenYDecimals;
          const valueDifference = xAmountQuotedScaled - yAmountForQuoteScaled;
          const valueDifferencePercentage = (valueDifference / yAmountForQuoteScaled) * 100;

          // Update quoteIndex and return final quote result
          quoteIndex += 1;
          console.log(
            `[Quote #${quoteIndex}] ` +
            `${yAmountForQuoteScaled.toFixed(2)} Y -> ` +
            `${xAmountQuotedScaled.toFixed(2)} X ` +
            `(Difference: ${valueDifference.toFixed(2)} / ${valueDifferencePercentage.toFixed(2)}%)`
          );
        };
      });
    });

    // Print final log
    console.log(`–––––––––––– TEST_#4 ––––––––––––`);
  });

  // TEST_#5 (10:90 pool ratio)
  it(`Get ${((percentagesForQuotes.length + 1) * amplificationCoefficients.length) * 2} quotes(s) at a 10:90 pool ratio`, () => {
    // Set the ratio of the pool balances
    const [xBalanceRatio, yBalanceRatio] = [10, 90];

    // Mint X and Y for pool creation   
    mintTokens(tokenXContractName, xAmountForPoolCreation, deployerAccount);
    mintTokens(tokenYContractName, yAmountForPoolCreation, deployerAccount);

    // Create the pool using aeUSDC-USDh mainnet configuration
    createPool(
      tokenXContractPrincipal,      // (x-token-trait <sip-010-trait>)
      tokenYContractPrincipal,      // (y-token-trait <sip-010-trait>)
      xAmountForPoolCreation,       // (x-amount uint)
      yAmountForPoolCreation,       // (y-amount uint)
      1000,                         // (burn-amount uint)
      midpointPrimaryNumerator,     // (midpoint-primary-numerator uint)
      midpointPrimaryDenominator,   // (midpoint-primary-denominator uint)
      midpointWithdrawNumerator,    // (midpoint-withdraw-numerator uint)
      midpointWithdrawDenominator,  // (midpoint-withdraw-denominator uint)
      2,                            // (x-protocol-fee uint)
      3,                            // (x-provider-fee uint)
      2,                            // (y-protocol-fee uint)
      3,                            // (y-provider-fee uint)
      5,                            // (liquidity-fee uint)
      amplificationCoefficients[0], // (amplification-coefficient uint)
      2,                            // (convergence-threshold uint)
      true,                         // (imbalanced-withdraws bool)
      0,                            // (withdraw-cooldown uint)
      false,                        // (freeze-midpoint-manager bool)
      feeRecipient,                 // (fee-address principal)
      "uri",                        // (uri (string-utf8 256))
      true,                         // (status bool)
      deployerAccount
    );

    // Mint X and Y so the user can add liquidity
    const xAmountForAddLiquidity = Math.max((yAmountForPoolCreation * (xBalanceRatio / yBalanceRatio)) - xAmountForPoolCreation, 0);
    const yAmountForAddLiquidity = Math.max((xAmountForPoolCreation * (yBalanceRatio / xBalanceRatio)) - yAmountForPoolCreation, 0);
    mintTokens(tokenXContractName, xAmountForAddLiquidity, userAccount);
    mintTokens(tokenYContractName, yAmountForAddLiquidity, userAccount);

    // Add liquidity to adjust the balances of the pool
    addLiquidity(
      tokenXContractPrincipal,
      tokenYContractPrincipal,
      xAmountForAddLiquidity,
      yAmountForAddLiquidity,
      1,
      userAccount
    );

    // Calculate updated pool balances after adding liquidity
    const xBalanceAfterAddingLiquidity = xAmountForPoolCreation + xAmountForAddLiquidity;
    const yBalanceAfterAddingLiquidity = yAmountForPoolCreation + yAmountForAddLiquidity;

    // Track the total number of quotes
    let quoteIndex = 0;
    
    // Print initial logs
    console.log(`–––––––––––– TEST_#5 ––––––––––––`);
    console.log(
      `[Pool ratio] ${xBalanceRatio}:${yBalanceRatio} ` +
      `(${xBalanceAfterAddingLiquidity / tokenXDecimals} X / ` +
      `${yBalanceAfterAddingLiquidity / tokenXDecimals} Y)`
    );

    // Iterate over each amplification coefficient
    amplificationCoefficients.forEach((coefficient) => {
      // Set the pool's amplification coefficient
      setAmplificationCoefficient(coefficient, deployerAccount);
      console.log(
        `\n`,
        `> Amplification coefficient: ${coefficient}`,
        `\n`
      );

      // Get X to Y quote using 1 token
      const xAmountForQuote = 1 * tokenXDecimals;
      const getDyResult = getDy(
        tokenXContractPrincipal,
        tokenYContractPrincipal,
        xAmountForQuote,
        userAccount
      );

      // Get the amount of Y the user would receive
      const yAmountQuoted = cvToValue(getDyResult.result).value;

      // Scale down amounts and calculate value difference (gain/loss assuming both tokens are worth $1)
      const xAmountForQuoteScaled = xAmountForQuote / tokenXDecimals;
      const yAmountQuotedScaled = yAmountQuoted / tokenYDecimals;
      const valueDifferenceXtoY = yAmountQuotedScaled - xAmountForQuoteScaled;
      const valueDifferenceXtoYPercentage = (valueDifferenceXtoY / xAmountForQuoteScaled) * 100;

      // Update quoteIndex and return final quote result
      quoteIndex += 1;
      console.log(
        `[Quote #${quoteIndex}] ` +
        `${xAmountForQuoteScaled.toFixed(6)} X -> ` +
        `${yAmountQuotedScaled.toFixed(6)} Y ` +
        `(Difference: ${valueDifferenceXtoY.toFixed(6)} / ${valueDifferenceXtoYPercentage.toFixed(6)}%)`
      );

      // Get Y to X quote using 1 token
      const yAmountForQuote = 1 * tokenYDecimals;
      const getDxResult = getDx(
        tokenXContractPrincipal,
        tokenYContractPrincipal,
        yAmountForQuote,
        userAccount
      );

      // Get the amount of X the user would receive
      const xAmountQuoted = cvToValue(getDxResult.result).value;

      // Scale down amounts and calculate value difference (gain/loss assuming both tokens are worth $1)
      const yAmountForQuoteScaled = yAmountForQuote / tokenXDecimals;
      const xAmountQuotedScaled = xAmountQuoted / tokenYDecimals;
      const valueDifferenceYtoX = xAmountQuotedScaled - yAmountForQuoteScaled;
      const valueDifferenceYtoXPercentage = (valueDifferenceYtoX / yAmountForQuoteScaled) * 100;

      // Update quoteIndex and return final quote result
      quoteIndex += 1;
      console.log(
        `[Quote #${quoteIndex}] ` +
        `${yAmountForQuoteScaled.toFixed(6)} Y -> ` +
        `${xAmountQuotedScaled.toFixed(6)} X ` +
        `(Difference: ${valueDifferenceYtoX.toFixed(6)} / ${valueDifferenceYtoXPercentage.toFixed(6)}%)`
      );
      
      // Get X to Y quotes
      percentagesForQuotes.forEach((percent) => {
        // Calculate amount to use for the quote
        const xAmountForQuote = Math.floor(xBalanceAfterAddingLiquidity * (percent / 100));
        if (xAmountForQuote > 0) {
          // Get the quote using the calculated amount
          const getDyResult = getDy(
            tokenXContractPrincipal,
            tokenYContractPrincipal,
            xAmountForQuote,
            userAccount
          );

          // Get the amount of Y the user would receive
          const yAmountQuoted = cvToValue(getDyResult.result).value;

          // Scale down amounts and calculate value difference (gain/loss assuming both tokens are worth $1)
          const xAmountForQuoteScaled = xAmountForQuote / tokenXDecimals;
          const yAmountQuotedScaled = yAmountQuoted / tokenYDecimals;
          const valueDifference = yAmountQuotedScaled - xAmountForQuoteScaled;
          const valueDifferencePercentage = (valueDifference / xAmountForQuoteScaled) * 100;

          // Update quoteIndex and return final quote result
          quoteIndex += 1;
          console.log(
            `[Quote #${quoteIndex}] ` +
            `${xAmountForQuoteScaled.toFixed(2)} X -> ` +
            `${yAmountQuotedScaled.toFixed(2)} Y ` +
            `(Difference: ${valueDifference.toFixed(2)} / ${valueDifferencePercentage.toFixed(2)}%)`
          );
        };
      });

      // Get Y to X quotes
      percentagesForQuotes.forEach((percent) => {
        // Calculate amount to use for the quote
        const yAmountForQuote = Math.floor(yBalanceAfterAddingLiquidity * (percent / 100));
        if (yAmountForQuote > 0) {
          // Get the quote using the calculated amount
          const getDxResult = getDx(
            tokenXContractPrincipal,
            tokenYContractPrincipal,
            yAmountForQuote,
            userAccount
          );

          // Get the amount of X the user would receive
          const xAmountQuoted = cvToValue(getDxResult.result).value;

          // Scale down amounts and calculate value difference (gain/loss assuming both tokens are worth $1)
          const yAmountForQuoteScaled = yAmountForQuote / tokenXDecimals;
          const xAmountQuotedScaled = xAmountQuoted / tokenYDecimals;
          const valueDifference = xAmountQuotedScaled - yAmountForQuoteScaled;
          const valueDifferencePercentage = (valueDifference / yAmountForQuoteScaled) * 100;

          // Update quoteIndex and return final quote result
          quoteIndex += 1;
          console.log(
            `[Quote #${quoteIndex}] ` +
            `${yAmountForQuoteScaled.toFixed(2)} Y -> ` +
            `${xAmountQuotedScaled.toFixed(2)} X ` +
            `(Difference: ${valueDifference.toFixed(2)} / ${valueDifferencePercentage.toFixed(2)}%)`
          );
        };
      });
    });

    // Print final log
    console.log(`–––––––––––– TEST_#5 ––––––––––––`);
  });
});