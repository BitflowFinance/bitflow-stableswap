import { Cl, ClarityType, cvToJSON } from "@stacks/transactions";
import { initSimnet } from "@hirosystems/clarinet-sdk";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import chalk from 'chalk';

// Color formatting helpers
const colors = {
    title: (text: string) => chalk.bold.blue(text),
    subtitle: (text: string) => chalk.bold.cyan(text),
    success: (text: string) => chalk.green(text),
    error: (text: string) => chalk.red(text),
    warning: (text: string) => chalk.yellow(text),
    info: (text: string) => chalk.yellow(text),
    profit: (value: number) => value >= 0 ? chalk.green(`+${value.toFixed(2)}`) : chalk.red(value.toFixed(2)),
    amount: (text: string) => chalk.yellow(text),
    usd: (text: string) => chalk.green(text),
    token: (text: string) => chalk.cyan(text),
    percentage: (value: number) => value >= 0 ? chalk.green(`+${value.toFixed(2)}%`) : chalk.red(`${value.toFixed(2)}%`),
    checkmark: ' ✅',
    xmark: ' ❌',
    arrow: chalk.gray('→'),
};

const simnet = await initSimnet();
console.log(simnet.initSession)
const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;

// Price configuration
const STX_PRICE_USD = 1.00;
const STSTX_PRICE_USD = 1.10;

// Helper functions for unit conversion and formatting
const DECIMALS = 6;
const UNIT = Math.pow(10, DECIMALS);

const formatUnits = (microAmount: number): string => {
    return (microAmount / UNIT).toFixed(DECIMALS);
};

const formatSTX = (microAmount: number): string => {
    return colors.token(`${(microAmount / UNIT).toLocaleString()} STX`);
};

const formatStSTX = (microAmount: number): string => {
    return colors.token(`${(microAmount / UNIT).toLocaleString()} stSTX`);
};

const formatUSD = (microAmount: number, price: number): string => {
    const usdValue = (microAmount / UNIT) * price;
    return colors.usd(`$${usdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
};

const toMicroUnits = (amount: number): number => {
    return amount * UNIT;
};

// Add helper for profit percentage formatting
const formatProfitPercent = (profit: number, initial: number): string => {
    const percentage = (profit / initial) * 100;
    return colors.percentage(percentage);
};

// Add helper for price ratio formatting
const formatPriceRatio = (outputAmount: number, inputAmount: number, outputPrice: number, inputPrice: number): string => {
    const ratio = ((outputAmount / UNIT) * outputPrice) / ((inputAmount / UNIT) * inputPrice);
    return ratio.toFixed(4);
};

// Test configuration with adjusted parameters
const INITIAL_POOL_BALANCE = 100_000 * UNIT; // 100k tokens
const INITIAL_STSTX_BALANCE = 90_000 * UNIT; // 90k stSTX
const SWAP_AMOUNT = 1_000 * UNIT; // 1k tokens

// Burn amount configuration
const BURN_AMOUNT = 1000;

// Midpoint configuration
const MIDPOINT = 1_100000;
const MIDPOINT_FACTOR = 1_000000;
const MIDPOINT_REVERSED = true;

// Fees configuration
const PROTOCOL_FEE = 30; // 0.3%
const PROVIDER_FEE = 30; // 0.3%
const LIQUIDITY_FEE = 40; // 0.4%
// Total fees: 1% (100 bps)

const AMP_COEFF = 100;
// Currently 100 - this is a key parameter. 
// Higher amplification = more stable prices
// Higher values (like 200-500) would make the pool more "stable" around the intended price ratio, making arbitrage harder. 
// Lower values would make the price more volatile and potentially increase arbitrage opportunities.

const CONVERGENCE_THRESHOLD = 2;
// Convergence threshold controls the precision of price calculations.
// A smaller value means more precision, which means more accurate prices, but also means more computation.

interface PoolConfig {
    initialBalance: number;      // Initial pool balance for both tokens
    burnAmount: number;         // Amount of LP tokens to burn
    midpoint: number;          // Midpoint value
    midpointFactor: number;    // Midpoint factor
    midpointReversed: boolean; // Whether midpoint is reversed
    protocolFee: number;       // Protocol fee in BPS
    providerFee: number;       // Provider fee in BPS
    liquidityFee: number;      // Liquidity fee in BPS
    ampCoeff: number;          // Amplification coefficient
    convergenceThreshold: number; // Convergence threshold
}

const DEFAULT_POOL_CONFIG: PoolConfig = {
    initialBalance: INITIAL_POOL_BALANCE,
    burnAmount: BURN_AMOUNT,
    midpoint: MIDPOINT,
    midpointFactor: MIDPOINT_FACTOR,
    midpointReversed: MIDPOINT_REVERSED,
    protocolFee: PROTOCOL_FEE,
    providerFee: PROVIDER_FEE,
    liquidityFee: LIQUIDITY_FEE,
    ampCoeff: AMP_COEFF,
    convergenceThreshold: CONVERGENCE_THRESHOLD
};

const initializePool = async (config: Partial<PoolConfig> = {}) => {
    // Merge provided config with defaults
    const poolConfig = { ...DEFAULT_POOL_CONFIG, ...config };

    // First mint some stSTX tokens to deployer
    simnet.callPublicFn(
        "token-ststx",
        "mint",
        [
            Cl.uint(poolConfig.initialBalance),
            Cl.principal(deployer)
        ],
        deployer
    );

    // Now create the pool
    const data = simnet.callPublicFn(
        "stableswap-core-v-1-1",
        "create-pool",
        [
            Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
            Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
            Cl.contractPrincipal(deployer, "token-ststx"),
            Cl.uint(poolConfig.initialBalance),
            Cl.uint(poolConfig.initialBalance),
            Cl.uint(poolConfig.burnAmount),
            Cl.uint(poolConfig.midpoint),
            Cl.uint(poolConfig.midpointFactor),
            Cl.bool(poolConfig.midpointReversed),
            Cl.uint(poolConfig.protocolFee),
            Cl.uint(poolConfig.providerFee),
            Cl.uint(poolConfig.protocolFee),
            Cl.uint(poolConfig.providerFee),
            Cl.uint(poolConfig.liquidityFee),
            Cl.uint(poolConfig.ampCoeff),
            Cl.uint(poolConfig.convergenceThreshold),
            Cl.principal(wallet1),
            Cl.stringUtf8("stx-ststx-pool-v1"),
            Cl.bool(true)
        ],
        deployer
    );
    expect(data.result).toHaveClarityType(ClarityType.ResponseOk)

    const poolData = simnet.callReadOnlyFn(
        "stableswap-pool-stx-ststx-v-1-1",
        "get-pool",
        [],
        deployer
    );

    console.log(`\n${colors.title('=== Pool Configuration ===')}`)
    console.log(`${colors.subtitle('Protocol Fee:')} ${colors.info(poolConfig.protocolFee / 100 + '%')}`);
    console.log(`${colors.subtitle('Provider Fee:')} ${colors.info(poolConfig.providerFee / 100 + '%')}`);
    console.log(`${colors.subtitle('Liquidity Fee:')} ${colors.info(poolConfig.liquidityFee / 100 + '%')}`);
    console.log(`${colors.subtitle('Amplification Coefficient:')} ${colors.info(poolConfig.ampCoeff.toString())}`);
    console.log(`${colors.subtitle('Convergence Threshold:')} ${colors.info(poolConfig.convergenceThreshold.toString())}`);
    console.log(`${colors.subtitle('Midpoint:')} ${colors.info(poolConfig.midpoint.toString())}`);
    console.log(`${colors.subtitle('Midpoint Factor:')} ${colors.info(poolConfig.midpointFactor.toString())}`);
    console.log(`${colors.subtitle('Midpoint Reversed:')} ${colors.info(poolConfig.midpointReversed.toString())}`);
    console.log(`${colors.subtitle('Burn Amount:')} ${colors.info(poolConfig.burnAmount.toString())}`);


    console.log(`\n${colors.title('=== Pool State ===')}`)
    const verifiedPoolData = cvToJSON(poolData.result).value.value

    console.log(`${colors.subtitle('Reserves STX:')} ${formatSTX(verifiedPoolData['x-balance'].value)} (${formatUSD(verifiedPoolData['x-balance'].value, STX_PRICE_USD)})`);
    console.log(`${colors.subtitle('Reserves stSTX:')} ${formatStSTX(verifiedPoolData['y-balance'].value)} (${formatUSD(verifiedPoolData['y-balance'].value, STSTX_PRICE_USD)})`);

    expect(verifiedPoolData['pool-created'].value).toStrictEqual(true);
    expect(verifiedPoolData['pool-status'].value).toStrictEqual(true);
    expect(Number(verifiedPoolData['x-protocol-fee'].value)).toStrictEqual(poolConfig.protocolFee);
    expect(Number(verifiedPoolData['x-provider-fee'].value)).toStrictEqual(poolConfig.providerFee);
    expect(Number(verifiedPoolData['y-protocol-fee'].value)).toStrictEqual(poolConfig.protocolFee);
    expect(Number(verifiedPoolData['y-provider-fee'].value)).toStrictEqual(poolConfig.providerFee);
    expect(Number(verifiedPoolData['liquidity-fee'].value)).toStrictEqual(poolConfig.liquidityFee);
    expect(Number(verifiedPoolData['amplification-coefficient'].value)).toStrictEqual(poolConfig.ampCoeff);
    expect(Number(verifiedPoolData['convergence-threshold'].value)).toStrictEqual(poolConfig.convergenceThreshold);

    return verifiedPoolData;
}

describe("stableswap", () => {
    beforeEach(async () => {
        // Use default configuration
        await initializePool()
    })

    describe("1.1 Quotes", () => {
        it("should calculate correct swap amounts", async () => {
            const result = simnet.callPublicFn(
                "stableswap-core-v-1-1",
                "get-dy",
                [
                    Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-ststx"),
                    Cl.uint(SWAP_AMOUNT)
                ],
                deployer
            );

            expect(result.result).toHaveClarityType(ClarityType.ResponseOk);
            const outputAmount = Number(cvToJSON(result.result).value.value);

            console.log("\n=== Swap Calculation ===");
            console.log(`Input: ${formatSTX(SWAP_AMOUNT)} (${formatUSD(SWAP_AMOUNT, STX_PRICE_USD)})`);
            console.log(`Output: ${formatSTX(outputAmount)} (${formatUSD(outputAmount, STSTX_PRICE_USD)})`);
            console.log(`Effective Price: $${formatPriceRatio(outputAmount, SWAP_AMOUNT, STSTX_PRICE_USD, STX_PRICE_USD)}`);
        });
    });

    describe("1.2 Swapping", () => {
        beforeEach(async () => {
            // Mint some stSTX tokens to deployer
            await simnet.callPublicFn(
                "token-ststx",
                "mint",
                [
                    Cl.uint(INITIAL_STSTX_BALANCE),
                    Cl.principal(deployer)
                ],
                deployer
            );
        })

        it.skip("should swap STX for stSTX", async () => {
            console.log("\n=== STX to stSTX Swap ===");
            console.log(`Input: ${formatSTX(SWAP_AMOUNT)} (${formatUSD(SWAP_AMOUNT, STX_PRICE_USD)})`);

            const result = simnet.callPublicFn(
                "stableswap-core-v-1-1",
                "swap-x-for-y",
                [
                    Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-ststx"),
                    Cl.uint(SWAP_AMOUNT),
                    Cl.uint(1)
                ],
                deployer
            );

            expect(result.result).toHaveClarityType(ClarityType.ResponseOk);
            const outputAmount = Number(cvToJSON(result.result).value.value);
            console.log(`Output: ${formatStSTX(outputAmount)} (${formatUSD(outputAmount, STSTX_PRICE_USD)})`);
            console.log(`Effective Price: $${formatPriceRatio(outputAmount, SWAP_AMOUNT, STSTX_PRICE_USD, STX_PRICE_USD)}`);
        });

        it.skip("should swap stSTX for STX", async () => {
            console.log("\n=== stSTX to STX Swap ===");
            console.log(`Input: ${formatStSTX(SWAP_AMOUNT)} (${formatUSD(SWAP_AMOUNT, STSTX_PRICE_USD)})`);

            const result = simnet.callPublicFn(
                "stableswap-core-v-1-1",
                "swap-y-for-x",
                [
                    Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-ststx"),
                    Cl.uint(SWAP_AMOUNT),
                    Cl.uint(1) // min output amount
                ],
                deployer
            );

            console.log(result.result)
            expect(result.result).toHaveClarityType(ClarityType.ResponseOk);
            const data = cvToJSON(result.result)
            console.log(`Output: ${formatSTX(data.value.value)} (${formatUSD(data.value.value, STX_PRICE_USD)})`);
            console.log(`Effective Price: $${formatPriceRatio(data.value.value, SWAP_AMOUNT, STX_PRICE_USD, STSTX_PRICE_USD)}`);
        });
    });

    describe("1.3 Arbitrage Resistance Tests", () => {

        // Test configuration
        const INITIAL_BALANCE = 100000_000000; // 100k tokens
        const ATTEMPT_AMOUNT = 1000_000000; // 1k tokens for arbitrage attempt
        const MAX_ACCEPTABLE_PROFIT = 0.001; // 0.1% maximum acceptable profit

        beforeEach(async () => {
            // Mint stSTX tokens to deployer for testing
            await simnet.callPublicFn(
                "token-ststx",
                "mint",
                [
                    Cl.uint(INITIAL_BALANCE),
                    Cl.principal(deployer)
                ],
                deployer
            );
        });

        it.skip("should resist single-sided liquidity arbitrage", async () => {
            console.log("\n=== Testing Single-Sided Liquidity Resistance ===");
            console.log(`Attempting arbitrage with ${formatSTX(ATTEMPT_AMOUNT)} (${formatUSD(ATTEMPT_AMOUNT, STX_PRICE_USD)})`);

            // Step 1: Add single-sided liquidity (STX only)
            const initialInvestmentUSD = ATTEMPT_AMOUNT * STX_PRICE_USD;

            const addLiqResult = simnet.callPublicFn(
                "stableswap-core-v-1-1",
                "add-liquidity",
                [
                    Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-ststx"),
                    Cl.uint(ATTEMPT_AMOUNT),
                    Cl.uint(0),
                    Cl.uint(1)
                ],
                deployer
            );
            const lpTokensReceived = Number(cvToJSON(addLiqResult.result).value.value);

            // Step 2: Remove liquidity
            const removeLiqResult = simnet.callPublicFn(
                "stableswap-core-v-1-1",
                "withdraw-liquidity",
                [
                    Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-ststx"),
                    Cl.uint(lpTokensReceived),
                    Cl.uint(1),
                    Cl.uint(1)
                ],
                deployer
            );
            const withdrawAmount = cvToJSON(removeLiqResult.result).value.value;
            const finalSTX = Number(withdrawAmount['x-amount'].value);
            const finalStSTX = Number(withdrawAmount['y-amount'].value);

            // Calculate final position value and profit
            const finalValueUSD = (finalSTX * STX_PRICE_USD) + (finalStSTX * STSTX_PRICE_USD);
            const profitUSD = finalValueUSD - initialInvestmentUSD;
            const profitPercent = (profitUSD / initialInvestmentUSD);

            console.log("\n=== Arbitrage Attempt Results ===");
            console.log(`Initial position: ${formatSTX(ATTEMPT_AMOUNT)} (${formatUSD(ATTEMPT_AMOUNT, STX_PRICE_USD)})`);
            console.log(`Final position: ${formatSTX(finalSTX)} + ${formatStSTX(finalStSTX)} (${formatUSD(finalValueUSD, 1)})`);
            console.log(`Profit/Loss: ${formatUSD(profitUSD, 1)} (${formatProfitPercent(profitUSD, initialInvestmentUSD)})`);

            // Verify that profit is below acceptable threshold
            expect(profitPercent).toBeLessThanOrEqual(MAX_ACCEPTABLE_PROFIT);
        });
    });

    describe("1.4 Single-Sided Liquidity Protection", () => {
        const ATTEMPT_AMOUNT = 1_000 * UNIT;    // 1k tokens
        const MAX_ACCEPTABLE_PROFIT = 0.001;    // 0.1% maximum acceptable profit

        it.skip("should resist single-sided liquidity imbalance", async () => {
            console.log("\n=== Testing Single-Sided Liquidity Protection ===");
            console.log(`Market conditions: 1 stSTX = ${formatUSD(UNIT, STSTX_PRICE_USD)} (${((STSTX_PRICE_USD / STX_PRICE_USD - 1) * 100).toFixed(1)}% premium)`);

            // Step 1: Attempt single-sided liquidity addition
            console.log("\nStep 1: Testing single-sided STX addition");
            const initialInvestmentUSD = ATTEMPT_AMOUNT / UNIT * STX_PRICE_USD;
            console.log(`Adding ${formatSTX(ATTEMPT_AMOUNT)} (${formatUSD(ATTEMPT_AMOUNT, STX_PRICE_USD)})`);

            const addLiqResult = simnet.callPublicFn(
                "stableswap-core-v-1-1",
                "add-liquidity",
                [
                    Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-ststx"),
                    Cl.uint(ATTEMPT_AMOUNT),
                    Cl.uint(0),
                    Cl.uint(1)
                ],
                deployer
            );
            const lpTokensReceived = Number(cvToJSON(addLiqResult.result).value.value);

            // Step 2: Attempt immediate withdrawal
            console.log("\nStep 2: Testing immediate withdrawal");
            const removeLiqResult = simnet.callPublicFn(
                "stableswap-core-v-1-1",
                "withdraw-liquidity",
                [
                    Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-ststx"),
                    Cl.uint(lpTokensReceived),
                    Cl.uint(1),
                    Cl.uint(1)
                ],
                deployer
            );
            const withdrawAmount = cvToJSON(removeLiqResult.result).value.value;
            const finalSTX = Number(withdrawAmount['x-amount'].value);
            const finalStSTX = Number(withdrawAmount['y-amount'].value);
            console.log(`Received: ${formatSTX(finalSTX)} + ${formatStSTX(finalStSTX)}`);

            // Calculate final position value and profit
            const finalValueUSD = (finalSTX / UNIT * STX_PRICE_USD) + (finalStSTX / UNIT * STSTX_PRICE_USD);
            const profitUSD = finalValueUSD - initialInvestmentUSD;

            console.log("\n=== Protection Analysis ===");
            console.log(`${colors.subtitle('Initial investment:')} ${formatSTX(ATTEMPT_AMOUNT)} (${formatUSD(ATTEMPT_AMOUNT, STX_PRICE_USD)})`);
            console.log(`${colors.subtitle('Final position:')} ${formatSTX(finalSTX)} + ${formatStSTX(finalStSTX)} (${formatUSD(finalSTX + finalStSTX, STX_PRICE_USD)})`);
            console.log(`${colors.subtitle('Total profit/loss:')} ${formatUSD(profitUSD * UNIT, STX_PRICE_USD)} (${formatProfitPercent(profitUSD, initialInvestmentUSD)})`);

            // Verify pool protections are working
            const profitPercent = profitUSD / initialInvestmentUSD;
            expect(profitPercent).toBeLessThanOrEqual(MAX_ACCEPTABLE_PROFIT);
            console.log(`\n${colors.subtitle('Protection status:')} ${profitPercent <= MAX_ACCEPTABLE_PROFIT ? colors.success('ACTIVE') + colors.checkmark : colors.error('FAILED') + colors.xmark}`);
            console.log(`${colors.subtitle('Maximum acceptable profit:')} ${colors.info((MAX_ACCEPTABLE_PROFIT * 100).toFixed(3) + '%')}`);
            console.log(`${colors.subtitle('Actual profit:')} ${formatProfitPercent(profitUSD, initialInvestmentUSD)}`);
        });
    });

    describe("1.5 Multi-Cycle Trading Protection", () => {
        const ATTEMPT_AMOUNT = 1_000 * UNIT;    // 1k tokens
        const MAX_ACCEPTABLE_PROFIT = 0.001;    // 0.1% maximum acceptable profit
        const CYCLES = 5;                       // Number of trading cycles to test

        it.skip("should resist multi-cycle trading strategies", async () => {
            console.log("\n=== Testing Multi-Cycle Trading Protection ===");
            console.log(`Market conditions: 1 stSTX = ${formatUSD(UNIT, STSTX_PRICE_USD)} (${((STSTX_PRICE_USD / STX_PRICE_USD - 1) * 100).toFixed(1)}% premium)`);
            console.log(`Testing ${CYCLES} trading cycles with ${formatSTX(ATTEMPT_AMOUNT)} initial position`);

            let currentSTXBalance = ATTEMPT_AMOUNT;
            let totalProfit = 0;
            const initialInvestmentUSD = ATTEMPT_AMOUNT / UNIT * STX_PRICE_USD;

            for (let cycle = 1; cycle <= CYCLES; cycle++) {
                console.log(`\n${colors.title(`=== Cycle ${cycle} ===`)}`);
                console.log(`${colors.subtitle('Starting balance:')} ${formatSTX(currentSTXBalance)} (${formatUSD(currentSTXBalance, STX_PRICE_USD)})`);

                // Step 1: Add single-sided liquidity
                const addLiqResult = simnet.callPublicFn(
                    "stableswap-core-v-1-1",
                    "add-liquidity",
                    [
                        Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
                        Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
                        Cl.contractPrincipal(deployer, "token-ststx"),
                        Cl.uint(currentSTXBalance),
                        Cl.uint(0),
                        Cl.uint(1)
                    ],
                    deployer
                );
                const lpTokensReceived = Number(cvToJSON(addLiqResult.result).value.value);

                // Step 2: Remove liquidity
                const removeLiqResult = simnet.callPublicFn(
                    "stableswap-core-v-1-1",
                    "withdraw-liquidity",
                    [
                        Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
                        Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
                        Cl.contractPrincipal(deployer, "token-ststx"),
                        Cl.uint(lpTokensReceived),
                        Cl.uint(1),
                        Cl.uint(1)
                    ],
                    deployer
                );
                const withdrawAmount = cvToJSON(removeLiqResult.result).value.value;
                const receivedSTX = Number(withdrawAmount['x-amount'].value);
                const receivedStSTX = Number(withdrawAmount['y-amount'].value);

                // Step 3: Swap stSTX back to STX if any received
                let swapOutput = 0;
                if (receivedStSTX > 0) {
                    const swapResult = simnet.callPublicFn(
                        "stableswap-core-v-1-1",
                        "swap-y-for-x",
                        [
                            Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
                            Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
                            Cl.contractPrincipal(deployer, "token-ststx"),
                            Cl.uint(receivedStSTX),
                            Cl.uint(1)
                        ],
                        deployer
                    );
                    swapOutput = Number(cvToJSON(swapResult.result).value.value);
                }

                // Update position and calculate cycle results
                currentSTXBalance = receivedSTX + swapOutput;
                const cycleValueUSD = currentSTXBalance / UNIT * STX_PRICE_USD;
                const previousValueUSD = cycle === 1 ? initialInvestmentUSD : (totalProfit + initialInvestmentUSD);
                const cycleProfit = cycleValueUSD - previousValueUSD;
                totalProfit += cycleProfit;

                console.log("\n=== Cycle Results ===");
                console.log(`${colors.info('Received from withdrawal:')} ${formatSTX(receivedSTX)} + ${formatStSTX(receivedStSTX)}`);
                if (swapOutput > 0) {
                    console.log(`${colors.info('Received from swap:')} ${formatSTX(swapOutput)}`);
                }
                console.log(`${colors.info('New position:')} ${formatSTX(currentSTXBalance)} (${formatUSD(currentSTXBalance, STX_PRICE_USD)})`);
                console.log(`${colors.info('Cycle profit:')} ${formatUSD(cycleProfit * UNIT, STX_PRICE_USD)} (${formatProfitPercent(cycleProfit, initialInvestmentUSD)})`);
            }

            // Calculate final results
            const finalValueUSD = currentSTXBalance / UNIT * STX_PRICE_USD;
            const totalProfitPercent = totalProfit / initialInvestmentUSD;

            console.log("\n=== Protection Analysis ===");
            console.log(`${colors.subtitle('Initial investment:')} ${formatSTX(ATTEMPT_AMOUNT)} (${formatUSD(ATTEMPT_AMOUNT, STX_PRICE_USD)})`);
            console.log(`${colors.subtitle('Final position:')} ${formatSTX(currentSTXBalance)} (${formatUSD(currentSTXBalance, STX_PRICE_USD)})`);
            console.log(`${colors.subtitle('Total profit/loss:')} ${formatUSD(totalProfit * UNIT, STX_PRICE_USD)} (${formatProfitPercent(totalProfit, initialInvestmentUSD)})`);
            console.log(`${colors.subtitle('Average profit per cycle:')} ${formatUSD((totalProfit / CYCLES) * UNIT, STX_PRICE_USD)} (${formatProfitPercent(totalProfit / CYCLES, initialInvestmentUSD)})`);

            // Verify pool protections are working
            expect(totalProfitPercent).toBeLessThanOrEqual(MAX_ACCEPTABLE_PROFIT);
            console.log(`\n${colors.subtitle('Protection status:')} ${totalProfitPercent <= MAX_ACCEPTABLE_PROFIT ? colors.success('ACTIVE') + colors.checkmark : colors.error('FAILED') + colors.xmark}`);
            console.log(`${colors.subtitle('Maximum acceptable profit:')} ${colors.info((MAX_ACCEPTABLE_PROFIT * 100).toFixed(3) + '%')}`);
            console.log(`${colors.subtitle('Actual profit:')} ${formatProfitPercent(totalProfit, initialInvestmentUSD)}`);
        });
    });

    describe("1.6 Trading Strategy Analysis", () => {
        const ATTEMPT_AMOUNT = 1_000 * UNIT;    // 1k tokens
        const MAX_ACCEPTABLE_PROFIT = 0.001;    // 0.1% maximum acceptable profit

        it.skip("should resist various trading strategies", async () => {
            console.log("\n=== Trading Strategy Analysis ===");
            console.log(`Market conditions: 1 stSTX = ${formatUSD(UNIT, STSTX_PRICE_USD)} (${((STSTX_PRICE_USD / STX_PRICE_USD - 1) * 100).toFixed(1)}% premium)`);
            console.log(`Test amount: ${formatSTX(ATTEMPT_AMOUNT)} (${formatUSD(ATTEMPT_AMOUNT, STX_PRICE_USD)})`);

            // Strategy 1: Direct Liquidity Operations
            console.log("\n1. Direct Liquidity Strategy");
            console.log("Testing single-sided liquidity addition and removal");

            const addLiqResult1 = simnet.callPublicFn(
                "stableswap-core-v-1-1",
                "add-liquidity",
                [
                    Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-ststx"),
                    Cl.uint(ATTEMPT_AMOUNT),
                    Cl.uint(0),
                    Cl.uint(1)
                ],
                deployer
            );
            const lpTokens1 = Number(cvToJSON(addLiqResult1.result).value.value);

            const removeLiqResult1 = simnet.callPublicFn(
                "stableswap-core-v-1-1",
                "withdraw-liquidity",
                [
                    Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-ststx"),
                    Cl.uint(lpTokens1),
                    Cl.uint(1),
                    Cl.uint(1)
                ],
                deployer
            );
            const withdraw1 = cvToJSON(removeLiqResult1.result).value.value;
            const finalSTX1 = Number(withdraw1['x-amount'].value);
            const finalStSTX1 = Number(withdraw1['y-amount'].value);
            const value1 = (finalSTX1 / UNIT * STX_PRICE_USD) + (finalStSTX1 / UNIT * STSTX_PRICE_USD);
            const profit1 = value1 - (ATTEMPT_AMOUNT / UNIT * STX_PRICE_USD);

            console.log("\nStrategy 1 Results:");
            console.log(`${colors.info('Received:')} ${formatSTX(finalSTX1)} + ${formatStSTX(finalStSTX1)}`);
            console.log(`${colors.info('Final value:')} ${formatUSD(finalSTX1 + finalStSTX1, STX_PRICE_USD)}`);
            console.log(`${colors.info('Profit/Loss:')} ${formatUSD(profit1 * UNIT, STX_PRICE_USD)} (${formatProfitPercent(profit1, ATTEMPT_AMOUNT / UNIT * STX_PRICE_USD)})`);

            const profitPercent1 = profit1 / (ATTEMPT_AMOUNT / UNIT * STX_PRICE_USD);
            expect(profitPercent1).toBeLessThanOrEqual(MAX_ACCEPTABLE_PROFIT);

            // Strategy 2: Liquidity Addition + Swap
            console.log("\n2. Hybrid Strategy");
            console.log("Testing liquidity addition followed by token swap");

            const addLiqResult2 = simnet.callPublicFn(
                "stableswap-core-v-1-1",
                "add-liquidity",
                [
                    Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-ststx"),
                    Cl.uint(ATTEMPT_AMOUNT),
                    Cl.uint(0),
                    Cl.uint(1)
                ],
                deployer
            );
            const lpTokens2 = Number(cvToJSON(addLiqResult2.result).value.value);

            const removeLiqResult2 = simnet.callPublicFn(
                "stableswap-core-v-1-1",
                "withdraw-liquidity",
                [
                    Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-ststx"),
                    Cl.uint(lpTokens2),
                    Cl.uint(1),
                    Cl.uint(1)
                ],
                deployer
            );
            const withdraw2 = cvToJSON(removeLiqResult2.result).value.value;
            const initialSTX2 = Number(withdraw2['x-amount'].value);
            const initialStSTX2 = Number(withdraw2['y-amount'].value);

            // Swap stSTX back to STX
            const swapResult = simnet.callPublicFn(
                "stableswap-core-v-1-1",
                "swap-y-for-x",
                [
                    Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-ststx"),
                    Cl.uint(initialStSTX2),
                    Cl.uint(1)
                ],
                deployer
            );
            const swapOutput = Number(cvToJSON(swapResult.result).value.value);
            const finalSTX2 = initialSTX2 + swapOutput;
            const value2 = finalSTX2 / UNIT * STX_PRICE_USD;
            const profit2 = value2 - (ATTEMPT_AMOUNT / UNIT * STX_PRICE_USD);

            console.log("\nStrategy 2 Results:");
            console.log(`${colors.info('After withdrawal:')} ${formatSTX(initialSTX2)} + ${formatStSTX(initialStSTX2)}`);
            console.log(`${colors.info('After swap:')} ${formatSTX(finalSTX2)}`);
            console.log(`${colors.info('Final value:')} ${formatUSD(finalSTX2, STX_PRICE_USD)}`);
            console.log(`${colors.info('Profit/Loss:')} ${formatUSD(profit2 * UNIT, STX_PRICE_USD)} (${formatProfitPercent(profit2, ATTEMPT_AMOUNT / UNIT * STX_PRICE_USD)})`);

            const profitPercent2 = profit2 / (ATTEMPT_AMOUNT / UNIT * STX_PRICE_USD);
            expect(profitPercent2).toBeLessThanOrEqual(MAX_ACCEPTABLE_PROFIT);

            // Analysis Summary
            console.log("\n=== Protection Analysis ===");
            console.log(`${colors.subtitle('Strategy 1 (Direct Liquidity):')}`)
            console.log(`${colors.info('- Profit/Loss:')} ${formatUSD(profit1 * UNIT, STX_PRICE_USD)} (${formatProfitPercent(profit1, ATTEMPT_AMOUNT / UNIT * STX_PRICE_USD)})`);
            console.log(`${colors.info('- Protection status:')} ${profitPercent1 <= MAX_ACCEPTABLE_PROFIT ? colors.success('ACTIVE') + colors.checkmark : colors.error('FAILED') + colors.xmark}`);

            console.log(`\n${colors.subtitle('Strategy 2 (Hybrid):')}`)
            console.log(`${colors.info('- Profit/Loss:')} ${formatUSD(profit2 * UNIT, STX_PRICE_USD)} (${formatProfitPercent(profit2, ATTEMPT_AMOUNT / UNIT * STX_PRICE_USD)})`);
            console.log(`${colors.info('- Protection status:')} ${profitPercent2 <= MAX_ACCEPTABLE_PROFIT ? colors.success('ACTIVE') + colors.checkmark : colors.error('FAILED') + colors.xmark}`);

            console.log(`\n${colors.subtitle('Strategy Comparison:')}`);
            console.log("Direct Liquidity Strategy:");
            console.log("✓ Maintains exposure to both assets");
            console.log("✓ Lower fee impact");
            console.log("✓ Single transaction pair");

            console.log("\nHybrid Strategy:");
            console.log("✓ Converts to single asset");
            console.log("✗ Higher cumulative fees");
            console.log("✗ Multiple transactions required");

            console.log(`\n${colors.subtitle('Maximum acceptable profit:')} ${colors.info((MAX_ACCEPTABLE_PROFIT * 100).toFixed(3) + '%')}`);
        });
    });

    describe("1.7 External Market Protection", () => {
        const ATTEMPT_AMOUNT = 1_000 * UNIT;    // 1k tokens
        const MAX_ACCEPTABLE_PROFIT = 0.001;    // 0.1% maximum acceptable profit
        const CYCLES = 5;                       // Number of cycles to test
        const EXTERNAL_PRICE_RATIO = 1.1;       // External market price ratio (10% premium)

        it.skip("should resist arbitrage with external markets", async () => {
            console.log("\n=== Testing External Market Protection ===");
            console.log(`Pool conditions: 1 stSTX = $${STSTX_PRICE_USD} (${((STSTX_PRICE_USD / STX_PRICE_USD - 1) * 100).toFixed(1)}% premium)`);
            console.log(`External market: 1 stSTX = ${EXTERNAL_PRICE_RATIO} STX (${((EXTERNAL_PRICE_RATIO - 1) * 100).toFixed(1)}% premium)`);
            console.log(`Testing ${CYCLES} cycles with ${formatSTX(ATTEMPT_AMOUNT)} initial position`);

            let currentSTXBalance = ATTEMPT_AMOUNT;
            let totalProfit = 0;
            let totalVolume = 0;
            const initialInvestmentUSD = (ATTEMPT_AMOUNT / UNIT) * STX_PRICE_USD;

            for (let cycle = 1; cycle <= CYCLES; cycle++) {
                console.log(`\n${colors.title(`=== Cycle ${cycle} ===`)}`);
                console.log(`${colors.subtitle('Starting balance:')} ${formatSTX(currentSTXBalance)} (${formatUSD(currentSTXBalance, STX_PRICE_USD)})`);
                totalVolume += currentSTXBalance;

                // Step 1: Add single-sided liquidity
                const addLiqResult = simnet.callPublicFn(
                    "stableswap-core-v-1-1",
                    "add-liquidity",
                    [
                        Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
                        Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
                        Cl.contractPrincipal(deployer, "token-ststx"),
                        Cl.uint(currentSTXBalance),
                        Cl.uint(0),
                        Cl.uint(1)
                    ],
                    deployer
                );
                const lpTokensReceived = Number(cvToJSON(addLiqResult.result).value.value);

                // Step 2: Remove liquidity
                const removeLiqResult = simnet.callPublicFn(
                    "stableswap-core-v-1-1",
                    "withdraw-liquidity",
                    [
                        Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
                        Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
                        Cl.contractPrincipal(deployer, "token-ststx"),
                        Cl.uint(lpTokensReceived),
                        Cl.uint(1),
                        Cl.uint(1)
                    ],
                    deployer
                );
                const withdrawAmount = cvToJSON(removeLiqResult.result).value.value;
                const receivedSTX = Number(withdrawAmount['x-amount'].value);
                const receivedStSTX = Number(withdrawAmount['y-amount'].value);

                // Step 3: Simulate external market swap
                const externalSwapSTX = Math.floor(receivedStSTX * EXTERNAL_PRICE_RATIO);
                currentSTXBalance = receivedSTX + externalSwapSTX;

                // Calculate cycle results
                const cycleValueUSD = (currentSTXBalance / UNIT) * STX_PRICE_USD;
                const previousValueUSD = cycle === 1 ? initialInvestmentUSD : ((totalProfit + initialInvestmentUSD));
                const cycleProfit = cycleValueUSD - previousValueUSD;
                totalProfit += cycleProfit;

                console.log("\n=== Cycle Results ===");
                console.log(`${colors.info('Pool withdrawal:')} ${formatSTX(receivedSTX)} + ${formatStSTX(receivedStSTX)}`);
                console.log(`${colors.info('Pool withdrawal value:')} ${formatUSD(receivedSTX, STX_PRICE_USD)} + ${formatUSD(receivedStSTX, STSTX_PRICE_USD)}`);
                console.log(`${colors.info('External market:')} ${formatStSTX(receivedStSTX)} → ${formatSTX(externalSwapSTX)}`);
                console.log(`${colors.info('External market value:')} ${formatUSD(receivedStSTX, STSTX_PRICE_USD)} → ${formatUSD(externalSwapSTX, STX_PRICE_USD)}`);
                console.log(`${colors.info('New position:')} ${formatSTX(currentSTXBalance)} (${formatUSD(currentSTXBalance, STX_PRICE_USD)})`);
                console.log(`${colors.info('Cycle profit:')} ${formatUSD(cycleProfit * UNIT, STX_PRICE_USD)} (${formatProfitPercent(cycleProfit, previousValueUSD)})`);
            }

            // Calculate final results
            const finalValueUSD = (currentSTXBalance / UNIT) * STX_PRICE_USD;
            const totalProfitPercent = totalProfit / initialInvestmentUSD;

            console.log("\n=== Protection Analysis ===");
            console.log(`${colors.subtitle('Initial investment:')} ${formatSTX(ATTEMPT_AMOUNT)} (${formatUSD(ATTEMPT_AMOUNT, STX_PRICE_USD)})`);
            console.log(`${colors.subtitle('Final position:')} ${formatSTX(currentSTXBalance)} (${formatUSD(finalValueUSD, 1)})`);
            console.log(`${colors.subtitle('Total profit/loss:')} ${formatUSD(totalProfit * UNIT, STX_PRICE_USD)} (${formatProfitPercent(totalProfit, initialInvestmentUSD)})`);
            console.log(`${colors.subtitle('Average profit per cycle:')} ${formatUSD((totalProfit / CYCLES) * UNIT, STX_PRICE_USD)} (${formatProfitPercent(totalProfit / CYCLES, initialInvestmentUSD)})`);
            console.log(`${colors.subtitle('Total volume:')} ${formatSTX(totalVolume)} (${formatUSD(totalVolume, STX_PRICE_USD)})`);
            console.log(`${colors.subtitle('Profit/volume ratio:')} ${((totalProfit / (totalVolume / UNIT)) * 100).toFixed(3)}%`);

            // Verify pool protections are working
            expect(totalProfitPercent).toBeLessThanOrEqual(MAX_ACCEPTABLE_PROFIT);
            console.log(`\n${colors.subtitle('Protection status:')} ${totalProfitPercent <= MAX_ACCEPTABLE_PROFIT ? colors.success('ACTIVE') + colors.checkmark : colors.error('FAILED') + colors.xmark}`);
            console.log(`${colors.subtitle('Maximum acceptable profit:')} ${colors.info((MAX_ACCEPTABLE_PROFIT * 100).toFixed(3) + '%')}`);
            console.log(`${colors.subtitle('Actual profit:')} ${formatProfitPercent(totalProfit, initialInvestmentUSD)}`);
        });
    });

});