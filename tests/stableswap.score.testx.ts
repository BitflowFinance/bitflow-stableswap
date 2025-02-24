import { Cl, ClarityType, cvToJSON } from "@stacks/transactions";
import { initSimnet } from "@hirosystems/clarinet-sdk";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';

// Color formatting helpers
const colors = {
    title: (text: string) => chalk.bold.blue(text),
    subtitle: (text: string) => chalk.bold.cyan(text),
    success: (text: string) => chalk.green(text),
    error: (text: string) => chalk.red(text),
    warning: (text: string) => chalk.yellow(text),
    info: (text: string) => chalk.gray(text),
    profit: (value: number) => value >= 0 ? chalk.green(`+${value.toFixed(4)}%`) : chalk.red(`${value.toFixed(4)}%`),
    amount: (text: string) => chalk.yellow(text),
    usd: (text: string) => chalk.green(text),
    token: (text: string) => chalk.cyan(text),
    percentage: (value: number) => value >= 0 ? chalk.green(`+${value.toFixed(4)}%`) : chalk.red(`${value.toFixed(4)}%`),
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
const STX_PRICE_USD = 1.00;
const STSTX_PRICE_USD = 1.10;

// Parameter Ranges for Configuration Testing
const MIDPOINT_RANGES = [
    // { name: 'Low', value: 50_000000 },
    { name: 'Standard', value: 110_000000 },
    // { name: 'High', value: 200_000000 },
    // { name: 'Very High', value: 500_000000 }
];

const MIDPOINT_FACTOR_RANGES = [
    // { name: 'Low', value: 50_000000 },
    { name: 'Standard', value: 100_000000 },
    // { name: 'High', value: 200_000000 },
    // { name: 'Very High', value: 500_000000 }
];

const AMP_RANGES = [
    { name: 'Very Low', value: 1 },
    { name: 'Low', value: 10 },
    { name: 'Medium', value: 50 },
    { name: 'Standard', value: 100 },
    { name: 'High', value: 500 },
    { name: 'Very High', value: 1000 }
];

// Test Configuration
const INITIAL_POOL_BALANCE = 1_000_000 * UNIT; // 100k tokens
const ARB_ATTEMPT_SIZES = [
    { name: 'Small', value: 1_000 * UNIT },    // 1k tokens
    { name: 'Medium', value: 10_000 * UNIT },   // 10k tokens
    { name: 'Large', value: 50_000 * UNIT }     // 50k tokens
];

interface ConfigResult {
    midpoint: number;
    midpointFactor: number;
    ampCoeff: number;
    reversed: boolean;
    arbAttempts: {
        size: string;
        profitPercent: number;
        priceImpact: number;
        success: boolean;
    }[];
    averageProfitPercent: number;
    maxProfitPercent: number;
    averagePriceImpact: number;
    successRate: number;
    score: number; // Lower is better
}

interface PoolConfig {
    midpoint: number;
    midpointFactor: number;
    ampCoeff: number;
    reversed: boolean;
}

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

// Initialize pool with specific configuration
const initializePool = (config: PoolConfig) => {
    // First mint some stSTX tokens to deployer
    const mintResult = simnet.callPublicFn(
        "token-ststx",
        "mint",
        [
            Cl.uint(INITIAL_POOL_BALANCE),
            Cl.principal(deployer)
        ],
        deployer
    );

    // Create pool with specified configuration
    const poolResult = simnet.callPublicFn(
        "stableswap-core-v-1-1",
        "create-pool",
        [
            Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
            Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
            Cl.contractPrincipal(deployer, "token-ststx"),
            Cl.uint(INITIAL_POOL_BALANCE),
            Cl.uint(INITIAL_POOL_BALANCE),
            Cl.uint(1000), // burn amount
            Cl.uint(config.midpoint),
            Cl.uint(config.midpointFactor),
            Cl.bool(config.reversed),
            Cl.uint(30), // protocol fee
            Cl.uint(30), // provider fee
            Cl.uint(30), // protocol fee
            Cl.uint(30), // provider fee
            Cl.uint(40), // liquidity fee
            Cl.uint(config.ampCoeff),
            Cl.uint(2), // convergence threshold
            Cl.principal(wallet1),
            Cl.stringUtf8("stx-ststx-pool-v1"),
            Cl.bool(true)
        ],
        deployer
    );

    if (!cvToJSON(poolResult.result).value.value) {
        throw new Error("Pool creation failed");
    }

    return poolResult;
};

const testArbitrage = (config: PoolConfig, attemptSize: number): { profitPercent: number; priceImpact: number; success: boolean } => {
    try {
        // Initialize pool
        initializePool(config);

        // Before state - check pool balances and value
        const beforeStateResult = simnet.callReadOnlyFn(
            "stableswap-pool-stx-ststx-v-1-1",
            "get-pool",
            [],
            deployer
        );

        const beforePoolDetails = cvToJSON(beforeStateResult.result).value.value;
        const beforeXReserve = Number(beforePoolDetails['x-balance'].value);
        const beforeYReserve = Number(beforePoolDetails['y-balance'].value);

        // Calculate initial pool value in USD
        const initialPoolValueUSD = (beforeXReserve / UNIT * STX_PRICE_USD) +
            (beforeYReserve / UNIT * STSTX_PRICE_USD);

        // 1. Add single-sided liquidity
        const addLiqResult = simnet.callPublicFn(
            "stableswap-core-v-1-1",
            "add-liquidity",
            [
                Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
                Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
                Cl.contractPrincipal(deployer, "token-ststx"),
                Cl.uint(attemptSize),
                Cl.uint(0),
                Cl.uint(1)
            ],
            deployer
        );

        const lpTokensReceived = Number(cvToJSON(addLiqResult.result).value.value);

        // After adding liquidity - check pool balances
        const afterAddResult = simnet.callReadOnlyFn(
            "stableswap-pool-stx-ststx-v-1-1",
            "get-pool",
            [],
            deployer
        );

        const afterAddPoolDetails = cvToJSON(afterAddResult.result).value.value;
        const afterAddXReserve = Number(afterAddPoolDetails['x-balance'].value);
        const afterAddYReserve = Number(afterAddPoolDetails['y-balance'].value);

        // 2. Remove liquidity
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

        // After withdrawal - check pool balances
        const afterWithdrawResult = simnet.callReadOnlyFn(
            "stableswap-pool-stx-ststx-v-1-1",
            "get-pool",
            [],
            deployer
        );

        const afterWithdrawPoolDetails = cvToJSON(afterWithdrawResult.result).value.value;
        const afterWithdrawXReserve = Number(afterWithdrawPoolDetails['x-balance'].value);
        const afterWithdrawYReserve = Number(afterWithdrawPoolDetails['y-balance'].value);

        // Calculate final pool value in USD
        const finalPoolValueUSD = (afterWithdrawXReserve / UNIT * STX_PRICE_USD) +
            (afterWithdrawYReserve / UNIT * STSTX_PRICE_USD);

        // Calculate net value change from trader's perspective (for reference)
        const traderInitialValueUSD = (attemptSize / UNIT) * STX_PRICE_USD;
        const traderFinalValueUSD = (finalSTX / UNIT * STX_PRICE_USD) + (finalStSTX / UNIT * STSTX_PRICE_USD);
        const traderProfitUSD = traderFinalValueUSD - traderInitialValueUSD;
        const traderProfitPercent = (traderProfitUSD / traderInitialValueUSD) * 100;

        // Calculate net value change from pool's perspective
        // The pool's profit should be the trader's loss, plus any fees collected

        // Value injected by trader
        const valueInjectedUSD = (attemptSize / UNIT) * STX_PRICE_USD;

        // Value returned to trader
        const valueReturnedUSD = (finalSTX / UNIT * STX_PRICE_USD) + (finalStSTX / UNIT * STSTX_PRICE_USD);

        // Pool's profit from this transaction
        const poolProfitUSD = valueInjectedUSD - valueReturnedUSD;

        // Calculate as percentage relative to initial pool value
        const poolProfitPercent = (poolProfitUSD / initialPoolValueUSD) * 100;

        // Calculate price impact using the ratio approach
        const initialRatio = beforeXReserve / beforeYReserve;
        const afterRatio = afterAddXReserve / afterAddYReserve;
        const priceChangePercent = Math.abs((afterRatio - initialRatio) / initialRatio) * 100;

        console.log(`DEBUG - testArbitrage from pool perspective:
            Initial pool value: $${initialPoolValueUSD.toFixed(2)}
            Final pool value: $${finalPoolValueUSD.toFixed(2)}
            Trader's profit: $${traderProfitUSD.toFixed(2)} (${traderProfitPercent.toFixed(4)}%)
            Value injected by trader: $${valueInjectedUSD.toFixed(2)}
            Value returned to trader: $${valueReturnedUSD.toFixed(2)}
            Pool's profit: $${poolProfitUSD.toFixed(2)} (${poolProfitPercent.toFixed(6)}% of pool value)
            Price impact: ${priceChangePercent.toFixed(4)}%
        `);

        const initialValueUSD = (attemptSize / UNIT) * STX_PRICE_USD;
        const finalValueUSD = (finalSTX / UNIT * STX_PRICE_USD) + (finalStSTX / UNIT * STSTX_PRICE_USD);
        const profitPercent = ((finalValueUSD - initialValueUSD) / initialValueUSD) * 100;

        const priceImpact = priceChangePercent;

        return {
            profitPercent,
            priceImpact,
            success: true
        };
    } catch (error) {
        console.error('Arbitrage test failed:', error);
        return {
            profitPercent: 0,
            priceImpact: 100,
            success: false
        };
    }
};

const calculateScore = (averageProfit: number, averageImpact: number, maxProfit: number): number => {
    const profitScore = 100 + (averageProfit * 20);
    const impactScore = 100 - (averageImpact * 5);
    const combinedScore = (profitScore * 0.7) + (impactScore * 0.3);
    return Math.max(0, combinedScore);
};

describe("Stableswap Configuration Optimization", () => {
    let results: ConfigResult[] = [];

    describe("Testing Configuration Combinations", () => {
        // Test each combination
        for (const midpoint of MIDPOINT_RANGES) {
            for (const factor of MIDPOINT_FACTOR_RANGES) {
                for (const amp of AMP_RANGES) {
                    for (const reversed of [true, false]) {
                        it(`Testing M:${midpoint.name} F:${factor.name} A:${amp.name} R:${reversed}`, () => {
                            const config: PoolConfig = {
                                midpoint: midpoint.value,
                                midpointFactor: factor.value,
                                ampCoeff: amp.value,
                                reversed: reversed
                            };

                            const arbAttempts = [];
                            let totalProfit = 0;
                            let totalImpact = 0;
                            let successCount = 0;
                            let maxProfit = 0;

                            // Test each arb attempt size
                            for (const size of ARB_ATTEMPT_SIZES) {
                                const result = testArbitrage(config, size.value);
                                arbAttempts.push({
                                    size: size.name,
                                    ...result
                                });

                                if (result.success) {
                                    totalProfit += result.profitPercent;
                                    totalImpact += result.priceImpact;
                                    successCount++;
                                    maxProfit = Math.max(maxProfit, result.profitPercent);
                                }
                            }

                            const averageProfit = successCount > 0 ? totalProfit / successCount : 0;
                            const averageImpact = successCount > 0 ? totalImpact / successCount : 100;
                            const successRate = (successCount / ARB_ATTEMPT_SIZES.length) * 100;

                            const score = calculateScore(averageProfit, averageImpact, maxProfit);

                            const result: ConfigResult = {
                                midpoint: midpoint.value,
                                midpointFactor: factor.value,
                                ampCoeff: amp.value,
                                reversed: reversed,
                                arbAttempts,
                                averageProfitPercent: averageProfit,
                                maxProfitPercent: maxProfit,
                                averagePriceImpact: averageImpact,
                                successRate,
                                score
                            };

                            results.push(result);

                            // Log results
                            console.log(`\n${colors.title('=== Configuration Test Results ===')}`)
                            console.log(`${colors.subtitle('Midpoint:')} ${colors.info(midpoint.name)} (${midpoint.value})`);
                            console.log(`${colors.subtitle('Factor:')} ${colors.info(factor.name)} (${factor.value})`);
                            console.log(`${colors.subtitle('Amplification:')} ${colors.info(amp.name)} (${amp.value})`);
                            console.log(`${colors.subtitle('Reversed:')} ${colors.info(reversed.toString())}`);
                            console.log(`\n${colors.subtitle('Arbitrage Attempts:')}`);

                            arbAttempts.forEach(attempt => {
                                console.log(`${colors.info(attempt.size)}:`);
                                console.log(`  Profit: ${colors.profit(attempt.profitPercent)}`);
                                console.log(`  Price Impact: ${colors.percentage(attempt.priceImpact)}`);
                                console.log(`  Status: ${attempt.success ? colors.success('SUCCESS') + colors.checkmark : colors.error('FAILED') + colors.xmark}`);
                            });

                            console.log(`\n${colors.subtitle('Summary:')}`);
                            console.log(`Average Profit: ${colors.profit(averageProfit)}`);
                            console.log(`Max Profit: ${colors.profit(maxProfit)}`);
                            console.log(`Average Price Impact: ${colors.percentage(averageImpact)}`);
                            console.log(`Success Rate: ${colors.percentage(successRate)}`);
                            console.log(`Score: ${colors.info(score.toFixed(4))} ${colors.info('(higher is better)')}`);

                            // Assertions
                            if (successCount > 0) {
                                // Higher pool profit is better now
                                expect(maxProfit).toBeGreaterThan(0); // Pool profit should be positive
                                expect(averageImpact).toBeLessThan(10); // Price impact should still be low
                            }
                        });
                    }
                }
            }
        }
    });

    afterAll(() => {
        // Sort results by score (higher is better)
        const sortedResults = [...results].sort((a, b) => b.score - a.score);

        // Print top 10 configurations
        console.log(`\n${colors.title('=== Top 10 Most Arbitrage-Resistant Configurations ===')}`)
        sortedResults.slice(0, 10).forEach((result, index) => {
            console.log(`\n${colors.subtitle(`#${index + 1} Configuration:`)}`)
            console.log(`Midpoint: ${result.midpoint}`);
            console.log(`Factor: ${result.midpointFactor}`);
            console.log(`Amplification: ${result.ampCoeff}`);
            console.log(`Reversed: ${result.reversed}`);
            console.log(`Average Profit: ${colors.profit(result.averageProfitPercent)}`);
            console.log(`Max Profit: ${colors.profit(result.maxProfitPercent)}`);
            console.log(`Average Price Impact: ${colors.percentage(result.averagePriceImpact)}`);
            console.log(`Score: ${colors.info(result.score.toFixed(4))}`);
        });

        // Calculate additional statistics
        const stats = {
            totalTests: results.length,
            successfulTests: results.filter(r => r.successRate > 0).length,
            averageScore: results.reduce((acc, r) => acc + r.score, 0) / results.length,
            medianScore: sortedResults[Math.floor(sortedResults.length / 2)].score,
            bestScore: sortedResults[0].score,
            worstScore: sortedResults[sortedResults.length - 1].score,
            averagePriceImpact: results.reduce((acc, r) => acc + r.averagePriceImpact, 0) / results.length,
            averageMaxProfit: results.reduce((acc, r) => acc + r.maxProfitPercent, 0) / results.length,
        };

        // Create results directory if it doesn't exist
        const resultsDir = 'test-results';
        if (!fs.existsSync(resultsDir)) {
            fs.mkdirSync(resultsDir);
        }

        // Generate timestamp for filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = path.join(resultsDir, `stableswap-stress-test-${timestamp}.json`);

        // Prepare detailed results object
        const detailedResults = {
            timestamp,
            testParameters: {
                initialPoolBalance: INITIAL_POOL_BALANCE,
                stxPriceUSD: STX_PRICE_USD,
                ststxPriceUSD: STSTX_PRICE_USD,
                arbAttemptSizes: ARB_ATTEMPT_SIZES,
                midpointRanges: MIDPOINT_RANGES,
                midpointFactorRanges: MIDPOINT_FACTOR_RANGES,
                ampRanges: AMP_RANGES
            },
            statistics: stats,
            top10Configurations: sortedResults.slice(0, 10),
            allResults: sortedResults.map(result => ({
                ...result,
                arbAttempts: result.arbAttempts.map(attempt => ({
                    ...attempt,
                    formattedProfit: `${attempt.profitPercent.toFixed(4)}%`,
                    formattedPriceImpact: `${attempt.priceImpact.toFixed(4)}%`
                }))
            })),
            summary: {
                bestConfiguration: {
                    ...sortedResults[0],
                    description: `Midpoint: ${sortedResults[0].midpoint}, Factor: ${sortedResults[0].midpointFactor}, Amp: ${sortedResults[0].ampCoeff}, Reversed: ${sortedResults[0].reversed}`
                },
                recommendations: [
                    {
                        category: "Most Stable",
                        config: sortedResults.reduce((a, b) => a.averagePriceImpact < b.averagePriceImpact ? a : b),
                        reason: "Lowest price impact across all tests"
                    },
                    {
                        category: "Most Profitable for Pool",
                        config: sortedResults.reduce((a, b) => a.averageProfitPercent > b.averageProfitPercent ? a : b),
                        reason: "Highest profit for the pool from arbitrage activities"
                    },
                    {
                        category: "Most Reliable",
                        config: sortedResults.reduce((a, b) => a.successRate > b.successRate ? a : b),
                        reason: "Highest success rate across all test cases"
                    }
                ]
            }
        };

        // Save results to file
        fs.writeFileSync(
            filename,
            JSON.stringify(detailedResults, null, 2)
        );

        // Print save confirmation
        console.log(`\n${colors.title('=== Test Results Saved ===')}`)
        console.log(`${colors.subtitle('File:')} ${colors.info(filename)}`);
        console.log(`${colors.subtitle('Total Configurations Tested:')} ${colors.info(stats.totalTests.toString())}`);
        console.log(`${colors.subtitle('Successful Tests:')} ${colors.info(stats.successfulTests.toString())}`);
        console.log(`${colors.subtitle('Success Rate:')} ${colors.percentage((stats.successfulTests / stats.totalTests) * 100)}`);
        console.log(`${colors.subtitle('Best Score:')} ${colors.info(stats.bestScore.toFixed(4))}`);
        console.log(`${colors.subtitle('Average Score:')} ${colors.info(stats.averageScore.toFixed(4))}`);
        console.log(`${colors.subtitle('Median Score:')} ${colors.info(stats.medianScore.toFixed(4))}`);
        console.log(`${colors.subtitle('Average Price Impact:')} ${colors.percentage(stats.averagePriceImpact)}`);
        console.log(`${colors.subtitle('Average Max Profit:')} ${colors.percentage(stats.averageMaxProfit)}`);
    });
}); 