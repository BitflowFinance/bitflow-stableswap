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

// Helper functions for common operations
const mintStSTX = (amount: number, recipient: string = deployer) => {
    const result = simnet.callPublicFn(
        "token-ststx",
        "mint",
        [
            Cl.uint(amount),
            Cl.principal(recipient)
        ],
        deployer
    );
    expect(result.result).toHaveClarityType(ClarityType.ResponseOk);
    return result;
};

const addLiquidity = (stxAmount: number, ststxAmount: number = 0, minLpTokens: number = 1) => {
    const result = simnet.callPublicFn(
        "stableswap-core-v-1-1",
        "add-liquidity",
        [
            Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
            Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
            Cl.contractPrincipal(deployer, "token-ststx"),
            Cl.uint(stxAmount),
            Cl.uint(ststxAmount),
            Cl.uint(minLpTokens)
        ],
        deployer
    );
    expect(result.result).toHaveClarityType(ClarityType.ResponseOk);
    return Number(cvToJSON(result.result).value.value);
};

const withdrawLiquidity = (lpTokens: number, minStx: number = 1, minStSTX: number = 1) => {
    const result = simnet.callPublicFn(
        "stableswap-core-v-1-1",
        "withdraw-liquidity",
        [
            Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
            Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
            Cl.contractPrincipal(deployer, "token-ststx"),
            Cl.uint(lpTokens),
            Cl.uint(minStx),
            Cl.uint(minStSTX)
        ],
        deployer
    );
    expect(result.result).toHaveClarityType(ClarityType.ResponseOk);
    const withdrawAmount = cvToJSON(result.result).value.value;
    return {
        stx: Number(withdrawAmount['x-amount'].value),
        ststx: Number(withdrawAmount['y-amount'].value)
    };
};

const swapSTXForSTSTX = (amount: number, minOutput: number = 1) => {
    const result = simnet.callPublicFn(
        "stableswap-core-v-1-1",
        "swap-x-for-y",
        [
            Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
            Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
            Cl.contractPrincipal(deployer, "token-ststx"),
            Cl.uint(amount),
            Cl.uint(minOutput)
        ],
        deployer
    );
    expect(result.result).toHaveClarityType(ClarityType.ResponseOk);
    return Number(cvToJSON(result.result).value.value);
};

const swapSTSTXForSTX = (amount: number, minOutput: number = 1) => {
    const result = simnet.callPublicFn(
        "stableswap-core-v-1-1",
        "swap-y-for-x",
        [
            Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
            Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
            Cl.contractPrincipal(deployer, "token-ststx"),
            Cl.uint(amount),
            Cl.uint(minOutput)
        ],
        deployer
    );
    expect(result.result).toHaveClarityType(ClarityType.ResponseOk);
    return Number(cvToJSON(result.result).value.value);
};

const getPoolState = () => {
    const result = simnet.callReadOnlyFn(
        "stableswap-pool-stx-ststx-v-1-1",
        "get-pool",
        [],
        deployer
    );
    const poolDetails = cvToJSON(result.result).value.value;
    return {
        stxBalance: Number(poolDetails['x-balance'].value),
        ststxBalance: Number(poolDetails['y-balance'].value),
        protocolFee: Number(poolDetails['x-protocol-fee'].value),
        providerFee: Number(poolDetails['x-provider-fee'].value),
        liquidityFee: Number(poolDetails['liquidity-fee'].value),
        ampCoeff: Number(poolDetails['amplification-coefficient'].value),
        convergenceThreshold: Number(poolDetails['convergence-threshold'].value)
    };
};

const getQuoteSTXtostSTX = (amount: number) => {
    const result = simnet.callPublicFn(
        "stableswap-core-v-1-1",
        "get-dy",
        [
            Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
            Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
            Cl.contractPrincipal(deployer, "token-ststx"),
            Cl.uint(amount)
        ],
        deployer
    );
    expect(result.result).toHaveClarityType(ClarityType.ResponseOk);
    const outputAmount = Number(cvToJSON(result.result).value.value);
    console.log(`Swap Quote: ${formatSTX(amount)} -> ${formatStSTX(outputAmount)}`);
    return outputAmount;
};

// Read-only function wrappers
const getAdmins = () => {
    const result = simnet.callReadOnlyFn(
        "stableswap-core-v-1-1",
        "get-admins",
        [],
        deployer
    );
    expect(result.result).toHaveClarityType(ClarityType.ResponseOk);
    return cvToJSON(result.result).value.value.map((cv: any) => cv.value);
};

const getAdminHelper = () => {
    const result = simnet.callReadOnlyFn(
        "stableswap-core-v-1-1",
        "get-admin-helper",
        [],
        deployer
    );
    expect(result.result).toHaveClarityType(ClarityType.ResponseOk);
    return cvToJSON(result.result).value.value;
};

const getLastPoolId = () => {
    const result = simnet.callReadOnlyFn(
        "stableswap-core-v-1-1",
        "get-last-pool-id",
        [],
        deployer
    );
    expect(result.result).toHaveClarityType(ClarityType.ResponseOk);
    return Number(cvToJSON(result.result).value.value);
};

const getPoolById = (id: number) => {
    const result = simnet.callReadOnlyFn(
        "stableswap-core-v-1-1",
        "get-pool-by-id",
        [Cl.uint(id)],
        deployer
    );
    expect(result.result).toHaveClarityType(ClarityType.ResponseOk);
    const cvPoolData = cvToJSON(result.result).value.value.value;
    return {
        id: Number(cvPoolData['id'].value),
        name: String(cvPoolData['name'].value),
        poolContract: String(cvPoolData['pool-contract'].value),
        symbol: String(cvPoolData['symbol'].value)
    };
};

const getMinimumTotalShares = () => {
    const result = simnet.callReadOnlyFn(
        "stableswap-core-v-1-1",
        "get-minimum-total-shares",
        [],
        deployer
    );
    expect(result.result).toHaveClarityType(ClarityType.ResponseOk);
    return Number(cvToJSON(result.result).value.value);
};

const getMinimumBurntShares = () => {
    const result = simnet.callReadOnlyFn(
        "stableswap-core-v-1-1",
        "get-minimum-burnt-shares",
        [],
        deployer
    );
    expect(result.result).toHaveClarityType(ClarityType.ResponseOk);
    return Number(cvToJSON(result.result).value.value);
};

const getPublicPoolCreation = () => {
    const result = simnet.callReadOnlyFn(
        "stableswap-core-v-1-1",
        "get-public-pool-creation",
        [],
        deployer
    );
    expect(result.result).toHaveClarityType(ClarityType.ResponseOk);
    return cvToJSON(result.result).value.value;
};

const createPool = (config: Partial<PoolConfig> = {}) => {
    // Merge provided config with defaults
    const poolConfig = { ...DEFAULT_POOL_CONFIG, ...config };

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

    beforeAll(() => {
        // First mint some stSTX tokens to deployer
        mintStSTX(INITIAL_POOL_BALANCE * 10);
    })

    // Initialize the pool before each test
    beforeAll(() => {
        // Use default configuration
        createPool()
    })

    describe("1.0 Read-Only Functions", () => {
        it("should get admin information", () => {
            console.log("\n=== Admin Information ===");

            const admins = getAdmins();
            const adminHelper = getAdminHelper();

            console.log(`${colors.subtitle('Admins:')} ${colors.info(admins.join(', '))}`);
            console.log(`${colors.subtitle('Admin Helper:')} ${colors.info(adminHelper)}`);

            expect(admins).toBeDefined();
            expect(adminHelper).toBeDefined();
            expect(admins).toContain(deployer);
        });

        it("should get pool configuration", () => {
            console.log("\n=== Pool Configuration ===");

            const lastPoolId = getLastPoolId();
            const poolData = getPoolById(lastPoolId);
            const minTotalShares = getMinimumTotalShares();
            const minBurntShares = getMinimumBurntShares();
            const isPublicCreation = getPublicPoolCreation();

            console.log(`${colors.subtitle('Last Pool ID:')} ${colors.info(lastPoolId.toString())}`);
            console.log(`${colors.subtitle('Pool Data:')} ${colors.info(JSON.stringify(poolData, null, 2))}`);
            console.log(`${colors.subtitle('Minimum Total Shares:')} ${colors.info(minTotalShares.toString())}`);
            console.log(`${colors.subtitle('Minimum Burnt Shares:')} ${colors.info(minBurntShares.toString())}`);
            console.log(`${colors.subtitle('Public Pool Creation:')} ${colors.info(isPublicCreation.toString())}`);

            expect(lastPoolId).toBeGreaterThanOrEqual(0);
            expect(poolData).toBeDefined();
            expect(minTotalShares).toBeGreaterThan(0);
            expect(minBurntShares).toBeGreaterThan(0);
            expect(typeof isPublicCreation).toBe('boolean');
        });

        it("should verify pool state matches configuration", () => {
            console.log("\n=== Pool State Verification ===");

            const lastPoolId = getLastPoolId();
            const poolData = getPoolById(lastPoolId);
            const poolState = getPoolState();

            console.log(`${colors.subtitle('Pool State:')}`);
            console.log(`${colors.info('STX Balance:')} ${formatSTX(poolState.stxBalance)}`);
            console.log(`${colors.info('stSTX Balance:')} ${formatStSTX(poolState.ststxBalance)}`);
            console.log(`${colors.info('Protocol Fee:')} ${poolState.protocolFee / 100}%`);
            console.log(`${colors.info('Provider Fee:')} ${poolState.providerFee / 100}%`);
            console.log(`${colors.info('Liquidity Fee:')} ${poolState.liquidityFee / 100}%`);
            console.log(`${colors.info('Amplification Coefficient:')} ${poolState.ampCoeff}`);
            console.log(`${colors.info('Convergence Threshold:')} ${poolState.convergenceThreshold}`);

            // Verify pool state matches our configuration
            expect(poolState.protocolFee).toBe(PROTOCOL_FEE);
            expect(poolState.providerFee).toBe(PROVIDER_FEE);
            expect(poolState.liquidityFee).toBe(LIQUIDITY_FEE);
            expect(poolState.ampCoeff).toBe(AMP_COEFF);
            expect(poolState.convergenceThreshold).toBe(CONVERGENCE_THRESHOLD);

            // Verify balances are as expected after initialization
            expect(poolState.stxBalance).toBe(INITIAL_POOL_BALANCE);
            expect(poolState.ststxBalance).toBe(INITIAL_POOL_BALANCE);
        });

        it("should track pool changes", async () => {
            console.log("\n=== Pool Change Tracking ===");

            // Get initial state
            const initialState = getPoolState();
            console.log(`${colors.subtitle('Initial State:')}`);
            console.log(`${colors.info('STX Balance:')} ${formatSTX(initialState.stxBalance)}`);
            console.log(`${colors.info('stSTX Balance:')} ${formatStSTX(initialState.ststxBalance)}`);

            // Perform a swap
            const swapAmount = 1000 * UNIT;
            console.log(`\n${colors.subtitle('Performing Swap:')} ${formatSTX(swapAmount)}`);
            const outputAmount = swapSTXForSTSTX(swapAmount);

            // Get final state
            const finalState = getPoolState();
            console.log(`\n${colors.subtitle('Final State:')}`);
            console.log(`${colors.info('STX Balance:')} ${formatSTX(finalState.stxBalance)}`);
            console.log(`${colors.info('stSTX Balance:')} ${formatStSTX(finalState.ststxBalance)}`);

            // Verify changes
            const stxDiff = finalState.stxBalance - initialState.stxBalance;
            const ststxDiff = finalState.ststxBalance - initialState.ststxBalance;

            console.log(`\n${colors.subtitle('Changes:')}`);
            console.log(`${colors.info('STX Change:')} ${formatSTX(stxDiff)}`);
            console.log(`${colors.info('stSTX Change:')} ${formatStSTX(ststxDiff)}`);

            expect(stxDiff).toBeCloseTo(swapAmount, -7);
            expect(ststxDiff).toBeCloseTo(-outputAmount, -7);
        });
    });

    describe("1.1 Quotes", () => {
        it("should handle small amount quotes correctly", async () => {
            console.log("\n=== Small Amount Quote Test ===");
            const smallAmount = 100 * UNIT;
            const smallQuote = getQuoteSTXtostSTX(smallAmount);

            console.log(`Input: ${formatSTX(smallAmount)} (${formatUSD(smallAmount, STX_PRICE_USD)})`);
            console.log(`Output: ${formatStSTX(smallQuote)} (${formatUSD(smallQuote, STSTX_PRICE_USD)})`);
            console.log(`Effective Price: $${formatPriceRatio(smallQuote, smallAmount, STSTX_PRICE_USD, STX_PRICE_USD)}`);

            // Small amount assertions
            expect(smallQuote).toBeGreaterThan(0);
            expect(smallQuote).toBeLessThan(smallAmount * 1.2); // Should not exceed 20% price impact

            const priceImpact = (smallQuote / smallAmount) - 1;
            console.log(`Price Impact: ${formatProfitPercent(priceImpact, 1)}`);
        });

        it("should handle medium amount quotes correctly", async () => {
            console.log("\n=== Medium Amount Quote Test ===");
            const mediumAmount = SWAP_AMOUNT; // 1k tokens
            const mediumQuote = getQuoteSTXtostSTX(mediumAmount);

            console.log(`Input: ${formatSTX(mediumAmount)} (${formatUSD(mediumAmount, STX_PRICE_USD)})`);
            console.log(`Output: ${formatStSTX(mediumQuote)} (${formatUSD(mediumQuote, STSTX_PRICE_USD)})`);
            console.log(`Effective Price: $${formatPriceRatio(mediumQuote, mediumAmount, STSTX_PRICE_USD, STX_PRICE_USD)}`);

            // Medium amount assertions
            expect(mediumQuote).toBeGreaterThan(0);
            expect(mediumQuote).toBeLessThan(mediumAmount * 1.15); // Should not exceed 15% price impact

            const priceImpact = (mediumQuote / mediumAmount) - 1;
            console.log(`Price Impact: ${formatProfitPercent(priceImpact, 1)}`);
        });

        it("should handle large amount quotes correctly", async () => {
            console.log("\n=== Large Amount Quote Test ===");
            const largeAmount = 10_000 * UNIT;
            const largeQuote = getQuoteSTXtostSTX(largeAmount);

            console.log(`Input: ${formatSTX(largeAmount)} (${formatUSD(largeAmount, STX_PRICE_USD)})`);
            console.log(`Output: ${formatStSTX(largeQuote)} (${formatUSD(largeQuote, STSTX_PRICE_USD)})`);
            console.log(`Effective Price: $${formatPriceRatio(largeQuote, largeAmount, STSTX_PRICE_USD, STX_PRICE_USD)}`);

            // Large amount assertions
            expect(largeQuote).toBeGreaterThan(0);
            expect(largeQuote).toBeLessThan(largeAmount * 1.1); // Should not exceed 10% price impact for larger amounts

            const priceImpact = (largeQuote / largeAmount) - 1;
            console.log(`Price Impact: ${formatProfitPercent(priceImpact, 1)}`);
        });

        it("should demonstrate increasing price impact with size", async () => {
            console.log("\n=== Price Impact Progression Test ===");

            const amounts = [
                { size: 100 * UNIT, label: "Small" },
                { size: SWAP_AMOUNT, label: "Medium" },
                { size: 10_000 * UNIT, label: "Large" }
            ];

            const impacts = amounts.map(({ size, label }) => {
                const quote = getQuoteSTXtostSTX(size);
                const impact = (quote / size) - 1;
                console.log(`${label} Amount Impact (${formatSTX(size)}): ${formatProfitPercent(impact, 1)}`);
                return Math.abs(impact);
            });

            // Verify increasing price impact
            expect(impacts[0]).toBeLessThan(impacts[1]);
            expect(impacts[1]).toBeLessThan(impacts[2]);

            console.log("\nPrice Impact Verification:");
            console.log(`Small → Medium: ${colors.success('✓')} Impact increases`);
            console.log(`Medium → Large: ${colors.success('✓')} Impact increases further`);
        });

        it("should provide consistent quotes for same amount", async () => {
            console.log("\n=== Quote Consistency Test ===");
            const testAmount = 500 * UNIT;

            console.log(`Testing amount: ${formatSTX(testAmount)}`);

            // Get multiple quotes for the same amount
            const quotes = Array.from({ length: 3 }, (_, i) => {
                const quote = getQuoteSTXtostSTX(testAmount);
                console.log(`Quote ${i + 1}: ${formatStSTX(quote)}`);
                return quote;
            });

            // Verify all quotes are identical
            const allEqual = quotes.every(q => q === quotes[0]);
            expect(allEqual).toBe(true);

            console.log(`\nQuote Consistency: ${allEqual ? colors.success('MATCHED') + colors.checkmark : colors.error('MISMATCHED') + colors.xmark}`);
        });

        it("should not affect pool state when getting quotes", async () => {
            console.log("\n=== Pool State Invariance Test ===");

            // Get initial pool state
            const initialState = getPoolState();
            console.log("\nInitial Pool State:");
            console.log(`STX Balance: ${formatSTX(initialState.stxBalance)}`);
            console.log(`stSTX Balance: ${formatStSTX(initialState.ststxBalance)}`);

            // Get multiple quotes of different sizes
            console.log("\nGetting multiple quotes...");
            const testAmounts = [100, 1000, 10000].map(a => a * UNIT);
            testAmounts.forEach(amount => {
                const quote = getQuoteSTXtostSTX(amount);
                console.log(`Quote for ${formatSTX(amount)}: ${formatStSTX(quote)}`);
            });

            // Verify pool state hasn't changed
            const finalState = getPoolState();
            console.log("\nFinal Pool State:");
            console.log(`STX Balance: ${formatSTX(finalState.stxBalance)}`);
            console.log(`stSTX Balance: ${formatStSTX(finalState.ststxBalance)}`);

            // State assertions
            expect(finalState.stxBalance).toBe(initialState.stxBalance);
            expect(finalState.ststxBalance).toBe(initialState.ststxBalance);

            const stateUnchanged = finalState.stxBalance === initialState.stxBalance &&
                finalState.ststxBalance === initialState.ststxBalance;

            console.log(`\nPool State Check: ${stateUnchanged ? colors.success('UNCHANGED') + colors.checkmark : colors.error('CHANGED') + colors.xmark}`);
        });
    });

    describe.skip("1.2 Liquidity Operations", () => {
        it("should handle single-sided STX liquidity", async () => {
            console.log("\n=== Single-Sided STX Liquidity Test ===");
            const amount = 1_000 * UNIT;

            // Get initial pool state
            const initialState = getPoolState();
            console.log("\nInitial Pool State:");
            console.log(`STX Balance: ${formatSTX(initialState.stxBalance)}`);
            console.log(`stSTX Balance: ${formatStSTX(initialState.ststxBalance)}`);

            // Add liquidity
            console.log(`\nAdding ${formatSTX(amount)} single-sided`);
            const lpTokensReceived = addLiquidity(amount);
            console.log(`LP Tokens Received: ${formatUnits(lpTokensReceived)}`);

            // Verify pool state after addition
            const midState = getPoolState();
            console.log("\nPool State After Addition:");
            console.log(`STX Balance: ${formatSTX(midState.stxBalance)}`);
            console.log(`stSTX Balance: ${formatStSTX(midState.ststxBalance)}`);

            // Verify balance changes
            expect(midState.stxBalance).toBe(initialState.stxBalance + amount);
            expect(midState.ststxBalance).toBe(initialState.ststxBalance);

            // Withdraw liquidity
            console.log("\nWithdrawing all LP tokens");
            const { stx, ststx } = withdrawLiquidity(lpTokensReceived);
            console.log(`Received: ${formatSTX(stx)} + ${formatStSTX(ststx)}`);

            // Verify final state
            const finalState = getPoolState();
            console.log("\nFinal Pool State:");
            console.log(`STX Balance: ${formatSTX(finalState.stxBalance)}`);
            console.log(`stSTX Balance: ${formatStSTX(finalState.ststxBalance)}`);

            // Calculate and display results
            const totalValueReceived = (stx / UNIT * STX_PRICE_USD) + (ststx / UNIT * STSTX_PRICE_USD);
            const initialValue = amount / UNIT * STX_PRICE_USD;
            const profitLoss = totalValueReceived - initialValue;

            console.log("\n=== Operation Results ===");
            console.log(`Initial Value: ${formatUSD(amount, STX_PRICE_USD)}`);
            console.log(`Final Value: ${formatUSD(stx + ststx, STX_PRICE_USD)}`);
            console.log(`Profit/Loss: ${formatUSD(profitLoss * UNIT, 1)} (${formatProfitPercent(profitLoss, initialValue)})`);
        });

        it("should handle balanced liquidity addition", async () => {
            console.log("\n=== Balanced Liquidity Test ===");
            const stxAmount = 1_000 * UNIT;
            const ststxAmount = 1_000 * UNIT;

            // Get initial pool state
            const initialState = getPoolState();
            console.log("\nInitial Pool State:");
            console.log(`STX Balance: ${formatSTX(initialState.stxBalance)}`);
            console.log(`stSTX Balance: ${formatStSTX(initialState.ststxBalance)}`);

            // Add balanced liquidity
            console.log(`\nAdding ${formatSTX(stxAmount)} + ${formatStSTX(ststxAmount)}`);
            const lpTokensReceived = addLiquidity(stxAmount, ststxAmount);
            console.log(`LP Tokens Received: ${formatUnits(lpTokensReceived)}`);

            // Verify pool state after addition
            const midState = getPoolState();
            console.log("\nPool State After Addition:");
            console.log(`STX Balance: ${formatSTX(midState.stxBalance)}`);
            console.log(`stSTX Balance: ${formatStSTX(midState.ststxBalance)}`);

            // Verify balance changes
            expect(midState.stxBalance).toBe(initialState.stxBalance + stxAmount);
            expect(midState.ststxBalance).toBe(initialState.ststxBalance + ststxAmount);

            // Withdraw liquidity
            console.log("\nWithdrawing all LP tokens");
            const { stx, ststx } = withdrawLiquidity(lpTokensReceived);
            console.log(`Received: ${formatSTX(stx)} + ${formatStSTX(ststx)}`);

            // Calculate and display results
            const initialValue = (stxAmount / UNIT * STX_PRICE_USD) + (ststxAmount / UNIT * STSTX_PRICE_USD);
            const finalValue = (stx / UNIT * STX_PRICE_USD) + (ststx / UNIT * STSTX_PRICE_USD);
            const profitLoss = finalValue - initialValue;

            console.log("\n=== Operation Results ===");
            console.log(`Initial Value: ${formatUSD(stxAmount + ststxAmount, STX_PRICE_USD)}`);
            console.log(`Final Value: ${formatUSD(stx + ststx, STX_PRICE_USD)}`);
            console.log(`Profit/Loss: ${formatUSD(profitLoss * UNIT, 1)} (${formatProfitPercent(profitLoss, initialValue)})`);
        });

        it("should handle partial liquidity withdrawal", async () => {
            console.log("\n=== Partial Withdrawal Test ===");
            const amount = 1_000 * UNIT;

            // Add initial liquidity
            console.log(`\nAdding initial liquidity: ${formatSTX(amount)}`);
            const lpTokensReceived = addLiquidity(amount);
            console.log(`LP Tokens Received: ${formatUnits(lpTokensReceived)}`);

            // Withdraw 50% of LP tokens
            const withdrawalAmount = Math.floor(lpTokensReceived / 2);
            console.log(`\nWithdrawing 50% (${formatUnits(withdrawalAmount)} LP tokens)`);
            const { stx: stx1, ststx: ststx1 } = withdrawLiquidity(withdrawalAmount);
            console.log(`First Withdrawal: ${formatSTX(stx1)} + ${formatStSTX(ststx1)}`);

            // Withdraw remaining LP tokens
            console.log(`\nWithdrawing remaining ${formatUnits(lpTokensReceived - withdrawalAmount)} LP tokens`);
            const { stx: stx2, ststx: ststx2 } = withdrawLiquidity(lpTokensReceived - withdrawalAmount);
            console.log(`Second Withdrawal: ${formatSTX(stx2)} + ${formatStSTX(ststx2)}`);

            // Calculate and verify total amounts
            const totalStx = stx1 + stx2;
            const totalStSTX = ststx1 + ststx2;
            const initialValue = amount / UNIT * STX_PRICE_USD;
            const finalValue = (totalStx / UNIT * STX_PRICE_USD) + (totalStSTX / UNIT * STSTX_PRICE_USD);
            const profitLoss = finalValue - initialValue;

            console.log("\n=== Operation Results ===");
            console.log(`Total STX Received: ${formatSTX(totalStx)}`);
            console.log(`Total stSTX Received: ${formatStSTX(totalStSTX)}`);
            console.log(`Initial Value: ${formatUSD(amount, STX_PRICE_USD)}`);
            console.log(`Final Value: ${formatUSD(totalStx + totalStSTX, STX_PRICE_USD)}`);
            console.log(`Profit/Loss: ${formatUSD(profitLoss * UNIT, 1)} (${formatProfitPercent(profitLoss, initialValue)})`);

            // Verify proportional withdrawal
            const firstWithdrawalRatio = (stx1 + ststx1) / (totalStx + totalStSTX);
            expect(firstWithdrawalRatio).toBeCloseTo(0.5, 1);
            console.log(`\nFirst Withdrawal Ratio: ${(firstWithdrawalRatio * 100).toFixed(2)}% (Expected: 50%)`);
        });

        it("should maintain pool balance ratios", async () => {
            console.log("\n=== Pool Balance Ratio Test ===");

            // Get initial ratios
            const initialState = getPoolState();
            const initialRatio = initialState.stxBalance / initialState.ststxBalance;
            console.log(`Initial STX/stSTX Ratio: ${initialRatio.toFixed(4)}`);

            // Add unbalanced liquidity
            const stxAmount = 1_000 * UNIT;
            const ststxAmount = 800 * UNIT;
            console.log(`\nAdding ${formatSTX(stxAmount)} + ${formatStSTX(ststxAmount)}`);

            const lpTokensReceived = addLiquidity(stxAmount, ststxAmount);

            // Check ratio after addition
            const midState = getPoolState();
            const midRatio = midState.stxBalance / midState.ststxBalance;
            console.log(`Ratio After Addition: ${midRatio.toFixed(4)}`);

            // Withdraw all liquidity
            const { stx, ststx } = withdrawLiquidity(lpTokensReceived);

            // Check final ratio
            const finalState = getPoolState();
            const finalRatio = finalState.stxBalance / finalState.ststxBalance;
            console.log(`Final STX/stSTX Ratio: ${finalRatio.toFixed(4)}`);

            // Verify ratio stability
            const ratioDeviation = Math.abs(finalRatio - initialRatio) / initialRatio;
            expect(ratioDeviation).toBeLessThan(0.01); // Less than 1% deviation

            console.log("\n=== Ratio Analysis ===");
            console.log(`Maximum Ratio Deviation: ${(ratioDeviation * 100).toFixed(4)}%`);
            console.log(`Ratio Stability: ${ratioDeviation < 0.01 ? colors.success('MAINTAINED') + colors.checkmark : colors.error('DEVIATED') + colors.xmark}`);
        });
    });

    describe("1.3 Swapping", () => {
        it("should swap STX for stSTX", async () => {
            console.log("\n=== STX to stSTX Swap ===");
            console.log(`Input: ${formatSTX(SWAP_AMOUNT)} (${formatUSD(SWAP_AMOUNT, STX_PRICE_USD)})`);

            const outputAmount = swapSTXForSTSTX(SWAP_AMOUNT);
            console.log(`Output: ${formatStSTX(outputAmount)} (${formatUSD(outputAmount, STSTX_PRICE_USD)})`);
            console.log(`Effective Price: $${formatPriceRatio(outputAmount, SWAP_AMOUNT, STSTX_PRICE_USD, STX_PRICE_USD)}`);
        });

        it("should swap stSTX for STX", async () => {
            console.log("\n=== stSTX to STX Swap ===");
            console.log(`Input: ${formatStSTX(SWAP_AMOUNT)} (${formatUSD(SWAP_AMOUNT, STSTX_PRICE_USD)})`);

            const outputAmount = swapSTSTXForSTX(SWAP_AMOUNT);
            console.log(`Output: ${formatSTX(outputAmount)} (${formatUSD(outputAmount, STX_PRICE_USD)})`);
            console.log(`Effective Price: $${formatPriceRatio(outputAmount, SWAP_AMOUNT, STX_PRICE_USD, STSTX_PRICE_USD)}`);
        });
    });

    describe.skip("1.4 Arbitrage Resistance Tests", () => {
        const ATTEMPT_AMOUNT = 1000_000000; // 1k tokens for arbitrage attempt
        const MAX_ACCEPTABLE_PROFIT = 0.001; // 0.1% maximum acceptable profit

        it("should resist single-sided liquidity arbitrage", async () => {
            console.log("\n=== Testing Single-Sided Liquidity Resistance ===");
            console.log(`Attempting arbitrage with ${formatSTX(ATTEMPT_AMOUNT)} (${formatUSD(ATTEMPT_AMOUNT, STX_PRICE_USD)})`);

            // Step 1: Add single-sided liquidity (STX only)
            const initialInvestmentUSD = ATTEMPT_AMOUNT * STX_PRICE_USD;
            const lpTokensReceived = addLiquidity(ATTEMPT_AMOUNT);

            // Step 2: Remove liquidity
            const { stx: finalSTX, ststx: finalStSTX } = withdrawLiquidity(lpTokensReceived);

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

    describe.skip("1.5 Single-Sided Liquidity Protection", () => {
        const ATTEMPT_AMOUNT = 1_000 * UNIT;    // 1k tokens
        const MAX_ACCEPTABLE_PROFIT = 0.001;    // 0.1% maximum acceptable profit

        it("should resist single-sided liquidity imbalance", async () => {
            console.log("\n=== Testing Single-Sided Liquidity Protection ===");
            console.log(`Market conditions: 1 stSTX = ${formatUSD(UNIT, STSTX_PRICE_USD)} (${((STSTX_PRICE_USD / STX_PRICE_USD - 1) * 100).toFixed(1)}% premium)`);

            // Step 1: Attempt single-sided liquidity addition
            console.log("\nStep 1: Testing single-sided STX addition");
            const initialInvestmentUSD = ATTEMPT_AMOUNT / UNIT * STX_PRICE_USD;
            console.log(`Adding ${formatSTX(ATTEMPT_AMOUNT)} (${formatUSD(ATTEMPT_AMOUNT, STX_PRICE_USD)})`);

            const lpTokensReceived = addLiquidity(ATTEMPT_AMOUNT);

            // Step 2: Attempt immediate withdrawal
            console.log("\nStep 2: Testing immediate withdrawal");
            const { stx: finalSTX, ststx: finalStSTX } = withdrawLiquidity(lpTokensReceived);
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

    describe.skip("1.6 Multi-Cycle Trading Protection", () => {
        const ATTEMPT_AMOUNT = 1_000 * UNIT;    // 1k tokens
        const MAX_ACCEPTABLE_PROFIT = 0.001;    // 0.1% maximum acceptable profit
        const CYCLES = 5;                       // Number of trading cycles to test

        it("should resist multi-cycle trading strategies", async () => {
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
                const lpTokensReceived = addLiquidity(currentSTXBalance);

                // Step 2: Remove liquidity
                const { stx: receivedSTX, ststx: receivedStSTX } = withdrawLiquidity(lpTokensReceived);

                // Step 3: Swap stSTX back to STX if any received
                let swapOutput = 0;
                if (receivedStSTX > 0) {
                    swapOutput = swapSTSTXForSTX(receivedStSTX);
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

    describe.skip("1.7 Trading Strategy Analysis", () => {
        const ATTEMPT_AMOUNT = 1_000 * UNIT;    // 1k tokens
        const MAX_ACCEPTABLE_PROFIT = 0.001;    // 0.1% maximum acceptable profit

        it("should resist various trading strategies", async () => {
            console.log("\n=== Trading Strategy Analysis ===");
            console.log(`Market conditions: 1 stSTX = ${formatUSD(UNIT, STSTX_PRICE_USD)} (${((STSTX_PRICE_USD / STX_PRICE_USD - 1) * 100).toFixed(1)}% premium)`);
            console.log(`Test amount: ${formatSTX(ATTEMPT_AMOUNT)} (${formatUSD(ATTEMPT_AMOUNT, STX_PRICE_USD)})`);

            // Strategy 1: Direct Liquidity Operations
            console.log("\n1. Direct Liquidity Strategy");
            console.log("Testing single-sided liquidity addition and removal");

            const lpTokens1 = addLiquidity(ATTEMPT_AMOUNT);
            const { stx: finalSTX1, ststx: finalStSTX1 } = withdrawLiquidity(lpTokens1);
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

            const lpTokens2 = addLiquidity(ATTEMPT_AMOUNT);
            const { stx: initialSTX2, ststx: initialStSTX2 } = withdrawLiquidity(lpTokens2);

            // Swap stSTX back to STX
            const swapOutput = swapSTSTXForSTX(initialStSTX2);
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

    describe.skip("1.8 External Market Protection", () => {
        const ATTEMPT_AMOUNT = 1_000 * UNIT;    // 1k tokens
        const MAX_ACCEPTABLE_PROFIT = 0.001;    // 0.1% maximum acceptable profit
        const CYCLES = 5;                       // Number of cycles to test
        const EXTERNAL_PRICE_RATIO = 1.1;       // External market price ratio (10% premium)

        it("should resist arbitrage with external markets", async () => {
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