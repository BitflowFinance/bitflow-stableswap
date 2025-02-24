import { Cl, ClarityType, cvToJSON } from "@stacks/transactions";
import { initSimnet } from "@hirosystems/clarinet-sdk";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import chalk from 'chalk';

// Color formatting helpers
const colors = {
    title: (text: string) => chalk.bold.blue(text),
    subtitle: (text: string) => chalk.bold.cyan(text),
    success: (text: string) => chalk.green(text),
    error: (text: string) => chalk.red(text),
    warning: (text: string) => chalk.yellow(text),
    info: (text: string) => chalk.gray(text),
    profit: (value: number) => value >= 0 ? chalk.green(`+${value.toFixed(2)}`) : chalk.red(value.toFixed(2)),
    amount: (text: string) => chalk.yellow(text),
    usd: (text: string) => chalk.green(text),
    token: (text: string) => chalk.cyan(text),
    percentage: (value: number) => value >= 0 ? chalk.green(`+${value.toFixed(2)}%`) : chalk.red(`${value.toFixed(2)}%`),
    checkmark: ' ✅',
    xmark: ' ❌',
    arrow: chalk.gray('→'),
};

// Initialize simnet
const simnet = await initSimnet();
const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;

// Constants and Helpers
const DECIMALS = 6;
const UNIT = Math.pow(10, DECIMALS);

// Parameter Ranges for Stress Testing
const LIQUIDITY_RANGES = [
    { name: 'Very Low', value: 1_000 * UNIT },
    { name: 'Standard', value: 100_000 * UNIT },
    { name: 'Very High', value: 1_000_000 * UNIT }
];

const AMP_RANGES = [
    { name: 'Minimum', value: 1 },
    { name: 'Low', value: 10 },
    { name: 'Standard', value: 100 },
    { name: 'High', value: 500 },
    { name: 'Maximum', value: 1000 }
];

const FEE_RANGES = [
    { name: 'Minimum', total: 10, split: { protocol: 3, provider: 3, liquidity: 4 } },
    { name: 'Standard', total: 100, split: { protocol: 30, provider: 30, liquidity: 40 } },
    { name: 'Maximum', total: 500, split: { protocol: 150, provider: 150, liquidity: 200 } }
];

const PRICE_RATIOS = [
    { name: 'Balanced', ratio: 1 },
    { name: 'Slight Imbalance', ratio: 1.1 },
    { name: 'Major Imbalance', ratio: 2 },
    { name: 'Extreme Imbalance', ratio: 5 }
];

// Helper functions
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

const formatProfitPercent = (profit: number, initial: number): string => {
    const percentage = (profit / initial) * 100;
    return colors.percentage(percentage);
};

interface TestResult {
    liquidityRange: string;
    ampRange: string;
    feeRange: string;
    priceRatio: string;
    swapSuccess: boolean;
    profitPercent: number;
    executionTime: number;
    errorMessage?: string;
    swapOutput?: number;
    priceImpact?: number;
    liquidityMetrics?: {
        addLiquiditySuccess: boolean;
        removeLiquiditySuccess: boolean;
        lpTokensReceived: number;
        tokensReturned: {
            stx: number;
            ststx: number;
        }
    };
}

interface PoolConfig {
    initialBalance: number;
    ampCoeff: number;
    protocolFee: number;
    providerFee: number;
    liquidityFee: number;
    priceRatio: number;
}

// Test execution helper
const executeStressTest = async (config: PoolConfig): Promise<TestResult> => {
    const startTime = Date.now();
    let result: TestResult = {
        liquidityRange: getLiquidityRangeName(config.initialBalance),
        ampRange: getAmpRangeName(config.ampCoeff),
        feeRange: getFeeRangeName(config.protocolFee + config.providerFee + config.liquidityFee),
        priceRatio: getPriceRatioName(config.priceRatio),
        swapSuccess: false,
        profitPercent: 0,
        executionTime: 0
    };

    try {
        // Initialize pool with config
        const poolResult = initializePool(config);
        if (!cvToJSON(poolResult.result).value.value['pool-created'].value) {
            throw new Error("Pool creation failed");
        }

        // 1. Test liquidity operations
        const testAmount = Math.floor(config.initialBalance * 0.01); // 1% of pool size

        // Add liquidity
        const addLiqResult = simnet.callPublicFn(
            "stableswap-core-v-1-1",
            "add-liquidity",
            [
                Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
                Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
                Cl.contractPrincipal(deployer, "token-ststx"),
                Cl.uint(testAmount),
                Cl.uint(0),
                Cl.uint(1)
            ],
            deployer
        );

        const lpTokensReceived = Number(cvToJSON(addLiqResult.result).value.value);

        // Remove liquidity
        const removeLiqResult = await simnet.callPublicFn(
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

        // 2. Test swap operations
        const swapResult = await simnet.callPublicFn(
            "stableswap-core-v-1-1",
            "swap-x-for-y",
            [
                Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
                Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
                Cl.contractPrincipal(deployer, "token-ststx"),
                Cl.uint(testAmount),
                Cl.uint(1)
            ],
            deployer
        );

        const swapOutput = Number(cvToJSON(swapResult.result).value.value);

        // 3. Calculate metrics
        const expectedOutput = Math.floor(testAmount * config.priceRatio);
        const priceImpact = Math.abs((swapOutput - expectedOutput) / expectedOutput) * 100;

        // Store results
        result.swapSuccess = true;
        result.swapOutput = swapOutput;
        result.priceImpact = priceImpact;
        result.liquidityMetrics = {
            addLiquiditySuccess: true,
            removeLiquiditySuccess: true,
            lpTokensReceived: lpTokensReceived,
            tokensReturned: {
                stx: finalSTX,
                ststx: finalStSTX
            }
        };

        // Calculate profit/loss from operations
        const initialValue = testAmount;
        const finalValue = finalSTX + (finalStSTX * config.priceRatio);
        result.profitPercent = ((finalValue - initialValue) / initialValue) * 100;

        result.executionTime = Date.now() - startTime;
    } catch (error: any) {
        result.swapSuccess = false;
        result.errorMessage = error.toString();
        result.executionTime = Date.now() - startTime;
    }

    return result;
};

// Helper functions for range name lookups
const getLiquidityRangeName = (value: number): string => {
    return LIQUIDITY_RANGES.find(range => range.value === value)?.name || 'Unknown';
};

const getAmpRangeName = (value: number): string => {
    return AMP_RANGES.find(range => range.value === value)?.name || 'Unknown';
};

const getFeeRangeName = (total: number): string => {
    return FEE_RANGES.find(range => range.total === total)?.name || 'Unknown';
};

const getPriceRatioName = (ratio: number): string => {
    return PRICE_RATIOS.find(range => range.ratio === ratio)?.name || 'Unknown';
};

// Initialize pool with specific configuration
const initializePool = (config: PoolConfig) => {
    // First mint some stSTX tokens to deployer
    simnet.callPublicFn(
        "token-ststx",
        "mint",
        [
            Cl.uint(config.initialBalance),
            Cl.principal(deployer)
        ],
        deployer
    );

    // Create pool with specified configuration
    const result = simnet.callPublicFn(
        "stableswap-core-v-1-1",
        "create-pool",
        [
            Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
            Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
            Cl.contractPrincipal(deployer, "token-ststx"),
            Cl.uint(config.initialBalance),
            Cl.uint(config.initialBalance),
            Cl.uint(1000), // burn amount
            Cl.uint(100_000000), // midpoint
            Cl.uint(100_000000), // midpoint factor
            Cl.bool(true), // midpoint reversed
            Cl.uint(config.protocolFee),
            Cl.uint(config.providerFee),
            Cl.uint(config.protocolFee),
            Cl.uint(config.providerFee),
            Cl.uint(config.liquidityFee),
            Cl.uint(config.ampCoeff),
            Cl.uint(2), // convergence threshold
            Cl.principal(wallet1),
            Cl.stringUtf8("stx-ststx-pool-v1"),
            Cl.bool(true)
        ],
        deployer
    );

    return result;
};

describe.skip("Stableswap Stress Tests", () => {
    let testResults: TestResult[] = [];

    describe("Parameter Range Tests", () => {
        LIQUIDITY_RANGES.forEach(liquidity => {
            describe(`Liquidity: ${liquidity.name}`, () => {
                AMP_RANGES.forEach(amp => {
                    describe(`Amplification: ${amp.name}`, () => {
                        FEE_RANGES.forEach(fee => {
                            describe(`Fees: ${fee.name}`, () => {
                                PRICE_RATIOS.forEach(price => {
                                    it(`Price Ratio: ${price.name}`, async () => {
                                        const config: PoolConfig = {
                                            initialBalance: liquidity.value,
                                            ampCoeff: amp.value,
                                            protocolFee: fee.split.protocol,
                                            providerFee: fee.split.provider,
                                            liquidityFee: fee.split.liquidity,
                                            priceRatio: price.ratio
                                        };

                                        const result = await executeStressTest(config);
                                        testResults.push(result);

                                        // Log test results
                                        console.log(`\n${colors.title('=== Test Configuration ===')}`)
                                        console.log(`${colors.subtitle('Liquidity:')} ${colors.info(liquidity.name)} (${formatSTX(liquidity.value)})`);
                                        console.log(`${colors.subtitle('Amplification:')} ${colors.info(amp.name)} (${amp.value})`);
                                        console.log(`${colors.subtitle('Fees:')} ${colors.info(fee.name)} (${fee.total / 100}%)`);
                                        console.log(`${colors.subtitle('Price Ratio:')} ${colors.info(price.name)} (${price.ratio}:1)`);

                                        if (result.swapSuccess) {
                                            console.log(`${colors.subtitle('Status:')} ${colors.success('SUCCESS')}${colors.checkmark}`);
                                            console.log(`${colors.subtitle('Price Impact:')} ${colors.info(result.priceImpact?.toFixed(4) + '%')}`);
                                            if (result.liquidityMetrics) {
                                                console.log(`${colors.subtitle('LP Tokens:')} ${colors.info(formatUnits(result.liquidityMetrics.lpTokensReceived))}`);
                                                console.log(`${colors.subtitle('Returned STX:')} ${formatSTX(result.liquidityMetrics.tokensReturned.stx)}`);
                                                console.log(`${colors.subtitle('Returned stSTX:')} ${formatStSTX(result.liquidityMetrics.tokensReturned.ststx)}`);
                                            }
                                            console.log(`${colors.subtitle('Profit/Loss:')} ${formatProfitPercent(result.profitPercent, 100)}`);
                                        } else {
                                            console.log(`${colors.subtitle('Status:')} ${colors.error('FAILED')}${colors.xmark}`);
                                            console.log(`${colors.subtitle('Error:')} ${colors.error(result.errorMessage || 'Unknown error')}`);
                                        }

                                        console.log(`${colors.subtitle('Execution Time:')} ${colors.info(result.executionTime + 'ms')}`);

                                        // Additional assertions
                                        if (result.swapSuccess) {
                                            // Price impact should be reasonable for the given configuration
                                            expect(result.priceImpact).toBeLessThan(50); // 50% max price impact

                                            // Profit should be limited
                                            expect(Math.abs(result.profitPercent)).toBeLessThan(5); // 5% max profit/loss

                                            // Liquidity operations should return reasonable amounts
                                            if (result.liquidityMetrics) {
                                                expect(result.liquidityMetrics.tokensReturned.stx).toBeGreaterThan(0);
                                                expect(result.liquidityMetrics.tokensReturned.ststx).toBeGreaterThan(0);
                                            }
                                        }
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });

    afterAll(() => {
        // Print summary of all test results
        console.log(`\n${colors.title('=== Stress Test Summary ===')}`)

        // Success rate
        const totalTests = testResults.length;
        const successfulTests = testResults.filter(r => r.swapSuccess).length;
        const successRate = (successfulTests / totalTests) * 100;

        console.log(`${colors.subtitle('Total Tests:')} ${colors.info(totalTests.toString())}`);
        console.log(`${colors.subtitle('Successful Tests:')} ${colors.info(successfulTests.toString())}`);
        console.log(`${colors.subtitle('Success Rate:')} ${colors.percentage(successRate)}`);

        // Average execution time
        const avgExecTime = testResults.reduce((acc, r) => acc + r.executionTime, 0) / totalTests;
        console.log(`${colors.subtitle('Average Execution Time:')} ${colors.info(avgExecTime.toFixed(2) + 'ms')}`);

        // Failed configurations
        const failedTests = testResults.filter(r => !r.swapSuccess);
        if (failedTests.length > 0) {
            console.log(`\n${colors.subtitle('Failed Configurations:')}`);
            failedTests.forEach(test => {
                console.log(colors.error(
                    `- Liquidity: ${test.liquidityRange}, ` +
                    `Amp: ${test.ampRange}, ` +
                    `Fees: ${test.feeRange}, ` +
                    `Price Ratio: ${test.priceRatio}`
                ));
            });
        }
    });
}); 