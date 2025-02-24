import { Cl, ClarityType, cvToJSON } from "@stacks/transactions";
import { initSimnet } from "@hirosystems/clarinet-sdk";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as fs from 'fs';
import * as path from 'path';

// Initialize simnet
const simnet = await initSimnet();
const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;

// Constants
const DECIMALS = 6;
const UNIT = Math.pow(10, DECIMALS);

// Parameter Ranges for Pool Creation Testing
const INITIAL_BALANCES = [
    { name: 'Tiny', value: 100 * UNIT },
    { name: 'Small', value: 1_000 * UNIT },
    { name: 'Medium', value: 10_000 * UNIT },
    { name: 'Large', value: 100_000 * UNIT },
    { name: 'Very Large', value: 1_000_000 * UNIT }
];

const MIDPOINT_VALUES = [
    { name: 'Very Low', value: 11_000000 },
    // { name: 'Low', value: 50_000000 },
    // { name: 'Standard', value: 100_000000 },
    // { name: 'High', value: 200_000000 },
    // { name: 'Very High', value: 500_000000 }
];

const MIDPOINT_FACTORS = [
    { name: 'Very Low', value: 10_000000 },
    // { name: 'Low', value: 50_000000 },
    // { name: 'Standard', value: 100_000000 },
    // { name: 'High', value: 200_000000 },
    // { name: 'Very High', value: 500_000000 }
];

const AMP_COEFFICIENTS = [
    { name: 'Minimum', value: 1 },
    // { name: 'Very Low', value: 5 },
    // { name: 'Low', value: 10 },
    // { name: 'Medium', value: 50 },
    { name: 'Standard', value: 100 },
    // { name: 'High', value: 500 },
    // { name: 'Very High', value: 1000 },
    { name: 'Maximum', value: 5000 }
];

const PROTOCOL_FEES = [
    { name: 'Zero', value: 0 },
    { name: 'Low', value: 10 },
    { name: 'Standard', value: 30 },
    { name: 'High', value: 50 }
];

const PROVIDER_FEES = [
    { name: 'Zero', value: 0 },
    { name: 'Low', value: 10 },
    { name: 'Standard', value: 30 },
    { name: 'High', value: 50 }
];

const LIQUIDITY_FEES = [
    { name: 'Zero', value: 0 },
    { name: 'Low', value: 10 },
    { name: 'Standard', value: 40 },
    { name: 'High', value: 100 }
];

// Add new parameter ranges after the existing ones
const BURN_AMOUNTS = [
    { name: 'Minimum', value: 1000 },
    // { name: 'Low', value: 5000 },
    // { name: 'Standard', value: 10000 },
    // { name: 'High', value: 50000 },
    { name: 'Very High', value: 100000 }
];

const CONVERGENCE_THRESHOLDS = [
    { name: 'Very Precise', value: 1 },
    // { name: 'Precise', value: 2 },
    { name: 'Standard', value: 5 },
    // { name: 'Relaxed', value: 10 },
    { name: 'Very Relaxed', value: 20 }
];

interface PoolCreationResult {
    initialBalance: { name: string; value: number };
    midpoint: { name: string; value: number };
    midpointFactor: { name: string; value: number };
    ampCoeff: { name: string; value: number };
    protocolFee: { name: string; value: number };
    providerFee: { name: string; value: number };
    liquidityFee: { name: string; value: number };
    burnAmount: { name: string; value: number };
    convergenceThreshold: { name: string; value: number };
    reversed: boolean;
    success: boolean;
    error?: string;
    poolData?: any;
}

// Test pool creation with given parameters
const testPoolCreation = (params: {
    initialBalance: { name: string; value: number };
    midpoint: { name: string; value: number };
    midpointFactor: { name: string; value: number };
    ampCoeff: { name: string; value: number };
    protocolFee: { name: string; value: number };
    providerFee: { name: string; value: number };
    liquidityFee: { name: string; value: number };
    burnAmount: { name: string; value: number };
    convergenceThreshold: { name: string; value: number };
    reversed: boolean;
}): PoolCreationResult => {
    try {
        // First mint some stSTX tokens to deployer
        const mintResult = simnet.callPublicFn(
            "token-ststx",
            "mint",
            [
                Cl.uint(params.initialBalance.value),
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
                Cl.uint(params.initialBalance.value),
                Cl.uint(params.initialBalance.value),
                Cl.uint(params.burnAmount.value),
                Cl.uint(params.midpoint.value),
                Cl.uint(params.midpointFactor.value),
                Cl.bool(params.reversed),
                Cl.uint(params.protocolFee.value),
                Cl.uint(params.providerFee.value),
                Cl.uint(params.protocolFee.value),
                Cl.uint(params.providerFee.value),
                Cl.uint(params.liquidityFee.value),
                Cl.uint(params.ampCoeff.value),
                Cl.uint(params.convergenceThreshold.value),
                Cl.principal(wallet1),
                Cl.stringUtf8("stx-ststx-pool-v1"),
                Cl.bool(true)
            ],
            deployer
        );

        const result = cvToJSON(poolResult.result);

        return {
            ...params,
            success: result.success,
            error: result.success ? undefined : result.value,
            poolData: result.success ? result.value : undefined
        };
    } catch (error: any) {
        return {
            ...params,
            success: false,
            error: error.toString()
        };
    }
};

describe.skip("Stableswap Pool Creation Parameter Testing", () => {
    const results: PoolCreationResult[] = [];

    // Test subset of combinations to keep test runtime reasonable
    describe("Testing Pool Creation with Parameter Combinations", () => {
        // Test each initial balance
        INITIAL_BALANCES.forEach(balance => {
            // Test each amplification coefficient
            AMP_COEFFICIENTS.forEach(amp => {
                // Test standard fees
                const standardFees = {
                    protocolFee: PROTOCOL_FEES.find(f => f.name === 'Standard')!,
                    providerFee: PROVIDER_FEES.find(f => f.name === 'Standard')!,
                    liquidityFee: LIQUIDITY_FEES.find(f => f.name === 'Standard')!
                };

                // Test burn amounts
                BURN_AMOUNTS.forEach(burn => {
                    // Test convergence thresholds
                    CONVERGENCE_THRESHOLDS.forEach(threshold => {
                        // Test midpoint combinations
                        MIDPOINT_VALUES.forEach(midpoint => {
                            MIDPOINT_FACTORS.forEach(factor => {
                                [true, false].forEach(reversed => {
                                    it(`Balance: ${balance.name}, Amp: ${amp.name}, Burn: ${burn.name}, Threshold: ${threshold.name}, M: ${midpoint.name}, F: ${factor.name}, R: ${reversed}`, () => {
                                        const result = testPoolCreation({
                                            initialBalance: balance,
                                            midpoint,
                                            midpointFactor: factor,
                                            ampCoeff: amp,
                                            protocolFee: standardFees.protocolFee,
                                            providerFee: standardFees.providerFee,
                                            liquidityFee: standardFees.liquidityFee,
                                            burnAmount: burn,
                                            convergenceThreshold: threshold,
                                            reversed
                                        });

                                        results.push(result);

                                        // Log result
                                        console.log(`\nTesting pool creation with:
                                            Initial Balance: ${balance.name} (${balance.value / UNIT})
                                            Amplification: ${amp.name} (${amp.value})
                                            Burn Amount: ${burn.name} (${burn.value})
                                            Convergence: ${threshold.name} (${threshold.value})
                                            Midpoint: ${midpoint.name} (${midpoint.value})
                                            Factor: ${factor.name} (${factor.value})
                                            Reversed: ${reversed}
                                            Result: ${result.success ? 'SUCCESS' : 'FAILED'}
                                            ${result.error ? 'Error: ' + result.error : ''}
                                        `);
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
        // Calculate statistics
        const totalTests = results.length;
        const successfulTests = results.filter(r => r.success).length;
        const failureRate = ((totalTests - successfulTests) / totalTests) * 100;

        // Group results by different parameters
        const analyzeByParameter = (param: string, getValue: (r: PoolCreationResult) => any) => {
            const grouped = results.reduce((acc, result) => {
                const key = getValue(result);
                if (!acc[key]) {
                    acc[key] = { total: 0, success: 0 };
                }
                acc[key].total++;
                if (result.success) acc[key].success++;
                return acc;
            }, {} as Record<string, { total: number; success: number }>);

            return Object.entries(grouped).map(([key, stats]) => ({
                value: key,
                successRate: (stats.success / stats.total) * 100,
                total: stats.total,
                successful: stats.success
            }));
        };

        const analysis = {
            byInitialBalance: analyzeByParameter('initialBalance', r => r.initialBalance.name),
            byAmpCoeff: analyzeByParameter('ampCoeff', r => r.ampCoeff.name),
            byMidpoint: analyzeByParameter('midpoint', r => r.midpoint.name),
            byMidpointFactor: analyzeByParameter('midpointFactor', r => r.midpointFactor.name),
            byBurnAmount: analyzeByParameter('burnAmount', r => r.burnAmount.name),
            byConvergenceThreshold: analyzeByParameter('convergenceThreshold', r => r.convergenceThreshold.name),
            byReversed: analyzeByParameter('reversed', r => r.reversed)
        };

        // Create results directory if it doesn't exist
        const resultsDir = 'test-results';
        if (!fs.existsSync(resultsDir)) {
            fs.mkdirSync(resultsDir);
        }

        // Save results to file
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = path.join(resultsDir, `pool-creation-test-${timestamp}.json`);

        const reportData = {
            timestamp,
            summary: {
                totalTests,
                successfulTests,
                failureRate,
                analysis
            },
            parameterRanges: {
                initialBalances: INITIAL_BALANCES,
                midpointValues: MIDPOINT_VALUES,
                midpointFactors: MIDPOINT_FACTORS,
                ampCoefficients: AMP_COEFFICIENTS,
                protocolFees: PROTOCOL_FEES,
                providerFees: PROVIDER_FEES,
                liquidityFees: LIQUIDITY_FEES,
                burnAmounts: BURN_AMOUNTS,
                convergenceThresholds: CONVERGENCE_THRESHOLDS
            },
            results: results.map(r => ({
                ...r,
                initialBalance: `${r.initialBalance.name} (${r.initialBalance.value})`,
                midpoint: `${r.midpoint.name} (${r.midpoint.value})`,
                midpointFactor: `${r.midpointFactor.name} (${r.midpointFactor.value})`,
                ampCoeff: `${r.ampCoeff.name} (${r.ampCoeff.value})`,
                protocolFee: `${r.protocolFee.name} (${r.protocolFee.value})`,
                providerFee: `${r.providerFee.name} (${r.providerFee.value})`,
                liquidityFee: `${r.liquidityFee.name} (${r.liquidityFee.value})`,
                burnAmount: `${r.burnAmount.name} (${r.burnAmount.value})`,
                convergenceThreshold: `${r.convergenceThreshold.name} (${r.convergenceThreshold.value})`
            }))
        };

        fs.writeFileSync(filename, JSON.stringify(reportData, null, 2));

        // Print summary
        console.log(`\n=== Pool Creation Test Summary ===`);
        console.log(`Total Tests: ${totalTests}`);
        console.log(`Successful: ${successfulTests}`);
        console.log(`Failure Rate: ${failureRate.toFixed(2)}%`);
        console.log(`\nResults saved to: ${filename}`);

        // Print analysis
        console.log('\n=== Parameter Analysis ===');
        Object.entries(analysis).forEach(([param, stats]) => {
            console.log(`\n${param}:`);
            stats.sort((a, b) => b.successRate - a.successRate)
                .forEach(stat => {
                    console.log(`  ${stat.value}: ${stat.successRate.toFixed(2)}% success (${stat.successful}/${stat.total})`);
                });
        });

        // Find optimal combinations
        const successfulResults = results.filter(r => r.success);
        if (successfulResults.length > 0) {
            console.log('\n=== Most Common Successful Combinations ===');

            // Group by combination of parameters
            const combinations = successfulResults.reduce((acc, result) => {
                const key = `${result.initialBalance.name}-${result.ampCoeff.name}-${result.burnAmount.name}-${result.convergenceThreshold.name}`;
                if (!acc[key]) {
                    acc[key] = {
                        count: 0,
                        params: {
                            initialBalance: result.initialBalance,
                            ampCoeff: result.ampCoeff,
                            burnAmount: result.burnAmount,
                            convergenceThreshold: result.convergenceThreshold
                        }
                    };
                }
                acc[key].count++;
                return acc;
            }, {} as Record<string, { count: number; params: any }>);

            // Sort and display top combinations
            Object.entries(combinations)
                .sort((a, b) => b[1].count - a[1].count)
                .slice(0, 5)
                .forEach(([key, value], index) => {
                    console.log(`\n#${index + 1} Most Common Successful Combination:`);
                    console.log(`  Initial Balance: ${value.params.initialBalance.name} (${value.params.initialBalance.value})`);
                    console.log(`  Amplification: ${value.params.ampCoeff.name} (${value.params.ampCoeff.value})`);
                    console.log(`  Burn Amount: ${value.params.burnAmount.name} (${value.params.burnAmount.value})`);
                    console.log(`  Convergence: ${value.params.convergenceThreshold.name} (${value.params.convergenceThreshold.value})`);
                    console.log(`  Success Count: ${value.count} times`);
                });
        }
    });
}); 