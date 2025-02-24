import { Simulator } from './simulator';
import { describe, expect, it, beforeAll, beforeEach } from 'vitest';

// Get simulator colors for formatting
const colors = Simulator.getColors();
const unit = Simulator.getUnit();

// Test setup
let simulator: Simulator;

beforeAll(async () => {
    // Create simulator
    simulator = await Simulator.create();

    // First mint some stSTX tokens to deployer
    simulator.mintStSTX(10_000_000 * unit);

    // Create pool with default configuration
    simulator.createPool();
});

describe("Basic Pool Operations", () => {

    describe("1.0 Read-Only Functions", () => {
        it("should get admin information", () => {
            console.log("\n=== Admin Information ===");

            const admins = simulator.getAdmins();
            const adminHelper = simulator.getAdminHelper();

            console.log(`${colors.subtitle('Admins:')} ${colors.info(admins.join(', '))}`);
            console.log(`${colors.subtitle('Admin Helper:')} ${colors.info(adminHelper)}`);

            expect(admins).toBeDefined();
            expect(adminHelper).toBeDefined();
            expect(admins).toContain(simulator.deployer);
        });

        it("should verify read-only functions return expected values", () => {
            console.log("\n=== Read-Only Functions Test ===");

            // Test get-admins
            const admins = simulator.getAdmins();
            console.log(`${colors.subtitle('Admins List:')} ${colors.info(admins.join(', '))}`);
            expect(Array.isArray(admins)).toBe(true);
            expect(admins.length).toBeGreaterThan(0);

            // Test get-admin-helper
            const adminHelper = simulator.getAdminHelper();
            console.log(`${colors.subtitle('Admin Helper:')} ${colors.info(adminHelper)}`);
            expect(adminHelper).toBeDefined();
            expect(typeof adminHelper).toBe('string');

            // Test get-last-pool-id
            const lastPoolId = simulator.getLastPoolId();
            console.log(`${colors.subtitle('Last Pool ID:')} ${colors.info(lastPoolId.toString())}`);
            expect(typeof lastPoolId).toBe('number');
            expect(lastPoolId).toBeGreaterThanOrEqual(0);

            // Test get-pool-by-id with valid and invalid IDs
            const validPool = simulator.getPoolById(lastPoolId);
            console.log(`${colors.subtitle('Valid Pool Data:')} ${colors.info(JSON.stringify(validPool, null, 2))}`);
            expect(validPool).toBeDefined();
            expect(validPool).not.toBeNull();
        });

        it("should get pool configuration", () => {
            console.log("\n=== Pool Configuration ===");

            const lastPoolId = simulator.getLastPoolId();
            const poolData = simulator.getPoolById(lastPoolId);
            const minTotalShares = simulator.getMinimumTotalShares();
            const minBurntShares = simulator.getMinimumBurntShares();
            const isPublicCreation = simulator.getPublicPoolCreation();

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

            const lastPoolId = simulator.getLastPoolId();
            const poolData = simulator.getPoolById(lastPoolId);
            const poolState = simulator.getPoolState();

            console.log(`${colors.subtitle('Pool State:')}`);
            console.log(`${colors.info('STX Balance:')} ${simulator.formatSTX(poolState.stxBalance)}`);
            console.log(`${colors.info('stSTX Balance:')} ${simulator.formatStSTX(poolState.ststxBalance)}`);
            console.log(`${colors.info('Protocol Fee:')} ${poolState.protocolFee / 100}%`);
            console.log(`${colors.info('Provider Fee:')} ${poolState.providerFee / 100}%`);
            console.log(`${colors.info('Liquidity Fee:')} ${poolState.liquidityFee / 100}%`);
            console.log(`${colors.info('Amplification Coefficient:')} ${poolState.ampCoeff}`);
            console.log(`${colors.info('Convergence Threshold:')} ${poolState.convergenceThreshold}`);

            // Verify pool state matches our configuration
            expect(poolState.protocolFee).toBe(Simulator.getDefaultConfig().protocolFee);
            expect(poolState.providerFee).toBe(Simulator.getDefaultConfig().providerFee);
            expect(poolState.liquidityFee).toBe(Simulator.getDefaultConfig().liquidityFee);
            expect(poolState.ampCoeff).toBe(Simulator.getDefaultConfig().ampCoeff);
            expect(poolState.convergenceThreshold).toBe(Simulator.getDefaultConfig().convergenceThreshold);

            // Verify balances are as expected after initialization
            expect(poolState.stxBalance).toBe(Simulator.getDefaultConfig().initialBalance);
            expect(poolState.ststxBalance).toBe(Simulator.getDefaultConfig().initialBalance);
        });

        it("should track pool changes", () => {
            console.log("\n=== Pool Change Tracking ===");

            // Get initial state
            const initialState = simulator.getPoolState();
            console.log(`${colors.subtitle('Initial State:')}`);
            console.log(`${colors.info('STX Balance:')} ${simulator.formatSTX(initialState.stxBalance)}`);
            console.log(`${colors.info('stSTX Balance:')} ${simulator.formatStSTX(initialState.ststxBalance)}`);

            // Perform a swap
            const swapAmount = 1000 * unit;
            console.log(`\n${colors.subtitle('Performing Swap:')} ${simulator.formatSTX(swapAmount)}`);
            const outputAmount = simulator.swapSTXForSTSTX(swapAmount);

            // Get final state
            const finalState = simulator.getPoolState();
            console.log(`\n${colors.subtitle('Final State:')}`);
            console.log(`${colors.info('STX Balance:')} ${simulator.formatSTX(finalState.stxBalance)}`);
            console.log(`${colors.info('stSTX Balance:')} ${simulator.formatStSTX(finalState.ststxBalance)}`);

            // Verify changes
            const stxDiff = finalState.stxBalance - initialState.stxBalance;
            const ststxDiff = finalState.ststxBalance - initialState.ststxBalance;

            console.log(`\n${colors.subtitle('Changes:')}`);
            console.log(`${colors.info('STX Change:')} ${simulator.formatSTX(stxDiff)}`);
            console.log(`${colors.info('stSTX Change:')} ${simulator.formatStSTX(ststxDiff)}`);

            expect(stxDiff).toBeCloseTo(swapAmount, -7);
            expect(ststxDiff).toBeCloseTo(-outputAmount, -7);
        });
    });

    describe("1.1 Quotes", { timeout: 100000 }, () => {

        it("should handle small amount quotes correctly", () => {
            console.log("\n=== Small Amount Quote Test ===");
            const smallAmount = 100 * unit;
            const smallQuote = simulator.getQuoteSTXtostSTX(smallAmount);

            console.log(`Input: ${simulator.formatSTX(smallAmount)} (${simulator.formatUSD(smallAmount, Simulator.getPrices().stx)})`);
            console.log(`Output: ${simulator.formatStSTX(smallQuote)} (${simulator.formatUSD(smallQuote, Simulator.getPrices().ststx)})`);
            console.log(`Effective Price: $${simulator.formatPriceRatio(smallQuote, smallAmount, Simulator.getPrices().ststx, Simulator.getPrices().stx)}`);

            // Small amount assertions
            expect(smallQuote).toBeGreaterThan(0);
            expect(smallQuote).toBeLessThan(smallAmount * 1.2); // Should not exceed 20% price impact

            const priceImpact = (smallQuote / smallAmount) - 1;
            console.log(`Price Impact: ${simulator.formatProfitPercent(priceImpact, 1)}`);
        });

        it("should handle medium amount quotes correctly", () => {
            console.log("\n=== Medium Amount Quote Test ===");
            const mediumAmount = 1_000 * unit; // 1k tokens
            const mediumQuote = simulator.getQuoteSTXtostSTX(mediumAmount);

            console.log(`Input: ${simulator.formatSTX(mediumAmount)} (${simulator.formatUSD(mediumAmount, Simulator.getPrices().stx)})`);
            console.log(`Output: ${simulator.formatStSTX(mediumQuote)} (${simulator.formatUSD(mediumQuote, Simulator.getPrices().ststx)})`);
            console.log(`Effective Price: $${simulator.formatPriceRatio(mediumQuote, mediumAmount, Simulator.getPrices().ststx, Simulator.getPrices().stx)}`);

            // Medium amount assertions
            expect(mediumQuote).toBeGreaterThan(0);
            expect(mediumQuote).toBeLessThan(mediumAmount * 1.15); // Should not exceed 15% price impact

            const priceImpact = (mediumQuote / mediumAmount) - 1;
            console.log(`Price Impact: ${simulator.formatProfitPercent(priceImpact, 1)}`);
        });

        it("should handle large amount quotes correctly", () => {
            console.log("\n=== Large Amount Quote Test ===");
            const largeAmount = 10_000 * unit;
            const largeQuote = simulator.getQuoteSTXtostSTX(largeAmount);

            console.log(`Input: ${simulator.formatSTX(largeAmount)} (${simulator.formatUSD(largeAmount, Simulator.getPrices().stx)})`);
            console.log(`Output: ${simulator.formatStSTX(largeQuote)} (${simulator.formatUSD(largeQuote, Simulator.getPrices().ststx)})`);
            console.log(`Effective Price: $${simulator.formatPriceRatio(largeQuote, largeAmount, Simulator.getPrices().ststx, Simulator.getPrices().stx)}`);

            // Large amount assertions
            expect(largeQuote).toBeGreaterThan(0);
            expect(largeQuote).toBeLessThan(largeAmount * 1.1); // Should not exceed 10% price impact for larger amounts

            const priceImpact = (largeQuote / largeAmount) - 1;
            console.log(`Price Impact: ${simulator.formatProfitPercent(priceImpact, 1)}`);
        });

        it("should demonstrate increasing price impact with size", () => {
            console.log("\n=== Price Impact Analysis ===");
            const testAmounts = [
                { amount: 100 * unit, label: "Small" },
                { amount: 1_000 * unit, label: "Medium" },
                { amount: 10_000 * unit, label: "Large" },
                { amount: 50_000 * unit, label: "Very Large" }
            ];

            const impacts = [];
            for (const { amount, label } of testAmounts) {
                console.log(`\n${label} Trade:`);
                console.log(`Input: ${simulator.formatSTX(amount)}`);

                const quote = simulator.getQuoteSTXtostSTX(amount);
                const output = simulator.swapSTXForSTSTX(amount);
                const priceImpact = Math.abs((output / amount) - 1);
                impacts.push(priceImpact);

                console.log(`Expected Output: ${simulator.formatStSTX(quote)}`);
                console.log(`Actual Output: ${simulator.formatStSTX(output)}`);
                console.log(`Price Impact: ${simulator.formatProfitPercent(priceImpact, 1)}`);
            }

            // Verify increasing price impact
            for (let i = 1; i < impacts.length; i++) {
                expect(impacts[i]).toBeGreaterThan(impacts[i - 1]);
            }
        });

        it("should provide consistent quotes for same amount", () => {
            console.log("\n=== Quote Consistency Test ===");
            const testAmount = 500 * unit;

            console.log(`Testing amount: ${simulator.formatSTX(testAmount)}`);

            // Get multiple quotes for the same amount
            const quotes = Array.from({ length: 3 }, (_, i) => {
                const quote = simulator.getQuoteSTXtostSTX(testAmount);
                console.log(`Quote ${i + 1}: ${simulator.formatStSTX(quote)}`);
                return quote;
            });

            // Verify all quotes are identical
            const allEqual = quotes.every(q => q === quotes[0]);
            expect(allEqual).toBe(true);

            console.log(`\nQuote Consistency: ${allEqual ? colors.success('MATCHED') + colors.checkmark : colors.error('MISMATCHED') + colors.xmark}`);
        });

        it("should not affect pool state when getting quotes", () => {
            console.log("\n=== Pool State Invariance Test ===");

            // Get initial pool state
            const initialState = simulator.getPoolState();
            console.log("\nInitial Pool State:");
            console.log(`STX Balance: ${simulator.formatSTX(initialState.stxBalance)}`);
            console.log(`stSTX Balance: ${simulator.formatStSTX(initialState.ststxBalance)}`);

            // Get multiple quotes of different sizes
            console.log("\nGetting multiple quotes...");
            const testAmounts = [100, 1000, 10000].map(a => a * unit);
            testAmounts.forEach(amount => {
                const quote = simulator.getQuoteSTXtostSTX(amount);
                console.log(`Quote for ${simulator.formatSTX(amount)}: ${simulator.formatStSTX(quote)}`);
            });

            // Verify pool state hasn't changed
            const finalState = simulator.getPoolState();
            console.log("\nFinal Pool State:");
            console.log(`STX Balance: ${simulator.formatSTX(finalState.stxBalance)}`);
            console.log(`stSTX Balance: ${simulator.formatStSTX(finalState.ststxBalance)}`);

            // State assertions
            expect(finalState.stxBalance).toBe(initialState.stxBalance);
            expect(finalState.ststxBalance).toBe(initialState.ststxBalance);

            const stateUnchanged = finalState.stxBalance === initialState.stxBalance &&
                finalState.ststxBalance === initialState.ststxBalance;

            console.log(`\nPool State Check: ${stateUnchanged ? colors.success('UNCHANGED') + colors.checkmark : colors.error('CHANGED') + colors.xmark}`);
        });
    });

    describe("1.2 Liquidity Operations", { skip: true, timeout: 100000 }, () => {
        it("should handle single-sided STX liquidity", () => {
            console.log("\n=== Single-Sided STX Liquidity Test ===");
            const amount = 1_000 * unit;

            // Get initial pool state
            const initialState = simulator.getPoolState();
            console.log("\nInitial Pool State:");
            console.log(`STX Balance: ${simulator.formatSTX(initialState.stxBalance)}`);
            console.log(`stSTX Balance: ${simulator.formatStSTX(initialState.ststxBalance)}`);

            // Add liquidity
            console.log(`\nAdding ${simulator.formatSTX(amount)} single-sided`);
            const lpTokensReceived = simulator.addLiquidity(amount);
            console.log(`LP Tokens Received: ${simulator.formatUnits(lpTokensReceived)}`);

            // Verify pool state after addition
            const midState = simulator.getPoolState();
            console.log("\nPool State After Addition:");
            console.log(`STX Balance: ${simulator.formatSTX(midState.stxBalance)}`);
            console.log(`stSTX Balance: ${simulator.formatStSTX(midState.ststxBalance)}`);

            // Verify balance changes
            expect(midState.stxBalance).toBe(initialState.stxBalance + amount);
            expect(midState.ststxBalance).toBe(initialState.ststxBalance);

            // Withdraw liquidity
            console.log("\nWithdrawing all LP tokens");
            const { stx, ststx } = simulator.withdrawLiquidity(lpTokensReceived);
            console.log(`Received: ${simulator.formatSTX(stx)} + ${simulator.formatStSTX(ststx)}`);

            // Calculate and display results
            const totalValueReceived = (stx / unit * Simulator.getPrices().stx) + (ststx / unit * Simulator.getPrices().ststx);
            const initialValue = amount / unit * Simulator.getPrices().stx;
            const profitLoss = totalValueReceived - initialValue;

            console.log("\n=== Operation Results ===");
            console.log(`Initial Value: ${simulator.formatUSD(amount, Simulator.getPrices().stx)}`);
            console.log(`Final Value: ${simulator.formatUSD(stx + ststx, Simulator.getPrices().stx)}`);
            console.log(`Profit/Loss: ${simulator.formatUSD(profitLoss * unit, 1)} (${simulator.formatProfitPercent(profitLoss, initialValue)})`);
        });

        it("should handle balanced liquidity addition", () => {
            console.log("\n=== Balanced Liquidity Test ===");
            const stxAmount = 1_000 * unit;
            const ststxAmount = 1_000 * unit;

            // Get initial pool state
            const initialState = simulator.getPoolState();
            console.log("\nInitial Pool State:");
            console.log(`STX Balance: ${simulator.formatSTX(initialState.stxBalance)}`);
            console.log(`stSTX Balance: ${simulator.formatStSTX(initialState.ststxBalance)}`);

            // Add balanced liquidity
            console.log(`\nAdding ${simulator.formatSTX(stxAmount)} + ${simulator.formatStSTX(ststxAmount)}`);
            const lpTokensReceived = simulator.addLiquidity(stxAmount, ststxAmount);
            console.log(`LP Tokens Received: ${simulator.formatUnits(lpTokensReceived)}`);

            // Verify pool state after addition
            const midState = simulator.getPoolState();
            console.log("\nPool State After Addition:");
            console.log(`STX Balance: ${simulator.formatSTX(midState.stxBalance)}`);
            console.log(`stSTX Balance: ${simulator.formatStSTX(midState.ststxBalance)}`);

            // Verify balance changes
            expect(midState.stxBalance).toBe(initialState.stxBalance + stxAmount);
            expect(midState.ststxBalance).toBe(initialState.ststxBalance + ststxAmount);

            // Withdraw liquidity
            console.log("\nWithdrawing all LP tokens");
            const { stx, ststx } = simulator.withdrawLiquidity(lpTokensReceived);
            console.log(`Received: ${simulator.formatSTX(stx)} + ${simulator.formatStSTX(ststx)}`);

            // Calculate and display results
            const initialValue = (stxAmount / unit * Simulator.getPrices().stx) + (ststxAmount / unit * Simulator.getPrices().ststx);
            const finalValue = (stx / unit * Simulator.getPrices().stx) + (ststx / unit * Simulator.getPrices().ststx);
            const profitLoss = finalValue - initialValue;

            console.log("\n=== Operation Results ===");
            console.log(`Initial Value: ${simulator.formatUSD(stxAmount + ststxAmount, Simulator.getPrices().stx)}`);
            console.log(`Final Value: ${simulator.formatUSD(stx + ststx, Simulator.getPrices().stx)}`);
            console.log(`Profit/Loss: ${simulator.formatUSD(profitLoss * unit, 1)} (${simulator.formatProfitPercent(profitLoss, initialValue)})`);
        });

        it("should handle partial liquidity withdrawal", () => {
            console.log("\n=== Partial Withdrawal Test ===");
            const amount = 1_000 * unit;

            // Add initial liquidity
            console.log(`\nAdding initial liquidity: ${simulator.formatSTX(amount)}`);
            const lpTokensReceived = simulator.addLiquidity(amount);
            console.log(`LP Tokens Received: ${simulator.formatUnits(lpTokensReceived)}`);

            // Withdraw 50% of LP tokens
            const withdrawalAmount = Math.floor(lpTokensReceived / 2);
            console.log(`\nWithdrawing 50% (${simulator.formatUnits(withdrawalAmount)} LP tokens)`);
            const { stx: stx1, ststx: ststx1 } = simulator.withdrawLiquidity(withdrawalAmount);
            console.log(`First Withdrawal: ${simulator.formatSTX(stx1)} + ${simulator.formatStSTX(ststx1)}`);

            // Withdraw remaining LP tokens
            console.log(`\nWithdrawing remaining ${simulator.formatUnits(lpTokensReceived - withdrawalAmount)} LP tokens`);
            const { stx: stx2, ststx: ststx2 } = simulator.withdrawLiquidity(lpTokensReceived - withdrawalAmount);
            console.log(`Second Withdrawal: ${simulator.formatSTX(stx2)} + ${simulator.formatStSTX(ststx2)}`);

            // Calculate and verify total amounts
            const totalStx = stx1 + stx2;
            const totalStSTX = ststx1 + ststx2;
            const initialValue = amount / unit * Simulator.getPrices().stx;
            const finalValue = (totalStx / unit * Simulator.getPrices().stx) + (totalStSTX / unit * Simulator.getPrices().ststx);
            const profitLoss = finalValue - initialValue;

            console.log("\n=== Operation Results ===");
            console.log(`Total STX Received: ${simulator.formatSTX(totalStx)}`);
            console.log(`Total stSTX Received: ${simulator.formatStSTX(totalStSTX)}`);
            console.log(`Initial Value: ${simulator.formatUSD(amount, Simulator.getPrices().stx)}`);
            console.log(`Final Value: ${simulator.formatUSD(totalStx + totalStSTX, Simulator.getPrices().stx)}`);
            console.log(`Profit/Loss: ${simulator.formatUSD(profitLoss * unit, 1)} (${simulator.formatProfitPercent(profitLoss, initialValue)})`);

            // Verify proportional withdrawal
            const firstWithdrawalRatio = (stx1 + ststx1) / (totalStx + totalStSTX);
            expect(firstWithdrawalRatio).toBeCloseTo(0.5, 1);
            console.log(`\nFirst Withdrawal Ratio: ${(firstWithdrawalRatio * 100).toFixed(2)}% (Expected: 50%)`);
        });

        it("should maintain pool balance ratios", () => {
            console.log("\n=== Pool Balance Ratio Test ===");

            // Get initial ratios
            const initialState = simulator.getPoolState();
            const initialRatio = initialState.stxBalance / initialState.ststxBalance;
            console.log(`Initial STX/stSTX Ratio: ${initialRatio.toFixed(4)}`);

            // Add unbalanced liquidity
            const stxAmount = 1_000 * unit;
            const ststxAmount = 800 * unit;
            console.log(`\nAdding ${simulator.formatSTX(stxAmount)} + ${simulator.formatStSTX(ststxAmount)}`);

            const lpTokensReceived = simulator.addLiquidity(stxAmount, ststxAmount);

            // Check ratio after addition
            const midState = simulator.getPoolState();
            const midRatio = midState.stxBalance / midState.ststxBalance;
            console.log(`Ratio After Addition: ${midRatio.toFixed(4)}`);

            // Withdraw all liquidity
            const { stx, ststx } = simulator.withdrawLiquidity(lpTokensReceived);
            console.log(`Received: ${simulator.formatSTX(stx)} + ${simulator.formatStSTX(ststx)}`);

            // Check final ratio
            const finalState = simulator.getPoolState();
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

    describe("1.3 Swapping", { timeout: 100000 }, () => {

        beforeEach(() => {
            simulator.simnet.mineEmptyBlock();
        });

        describe("Quote Consistency", { timeout: 100000 }, () => {
            it("should match quote and swap outcomes for STX to stSTX", { timeout: 100000 }, () => {
                console.log("\n=== STX to stSTX Quote vs Swap Test ===");

                const testAmounts = [
                    { amount: 100 * unit, label: "Small" },
                    // { amount: 1_000 * unit, label: "Medium" },
                    { amount: 10_000 * unit, label: "Large" }
                ];

                for (const { amount, label } of testAmounts) {
                    console.log(`\n${colors.subtitle(`Testing ${label} Amount:`)}`);
                    console.log(`Input: ${simulator.formatSTX(amount)}`);

                    // Get quote first
                    const quotedAmount = simulator.getQuoteSTXtostSTX(amount);
                    console.log(`Quote output: ${simulator.formatStSTX(quotedAmount)}`);

                    // Execute swap
                    const swapAmount = simulator.swapSTXForSTSTX(amount);
                    console.log(`Actual swap output: ${simulator.formatStSTX(swapAmount)}`);

                    // Calculate and display difference
                    const difference = Math.abs(quotedAmount - swapAmount);
                    const percentDiff = (difference / quotedAmount) * 100;
                    console.log(`Difference: ${simulator.formatStSTX(difference)} (${percentDiff.toFixed(6)}%)`);

                    // Verify the difference is minimal
                    expect(difference).toBe(0);
                    console.log(`Match status: ${difference === 0 ? colors.success('EXACT') + colors.checkmark : colors.error('MISMATCHED') + colors.xmark}`);
                }
            });

            it("should match quote and swap outcomes for stSTX to STX", { timeout: 100000 }, () => {
                console.log("\n=== stSTX to STX Quote vs Swap Test ===");

                const testAmounts = [
                    { amount: 100 * unit, label: "Small" },
                    // { amount: 1_000 * unit, label: "Medium" },
                    { amount: 10_000 * unit, label: "Large" }
                ];

                for (const { amount, label } of testAmounts) {
                    console.log(`\n${colors.subtitle(`Testing ${label} Amount:`)}`);
                    console.log(`Input: ${simulator.formatStSTX(amount)}`);

                    // Get quote first
                    const quotedAmount = simulator.getQuoteSTXtostSTX(amount);
                    console.log(`Quote output: ${simulator.formatSTX(quotedAmount)}`);

                    // Execute swap
                    const swapAmount = simulator.swapSTSTXForSTX(amount);
                    console.log(`Actual swap output: ${simulator.formatSTX(swapAmount)}`);

                    // Calculate and display difference
                    const difference = Math.abs(quotedAmount - swapAmount);
                    const percentDiff = (difference / quotedAmount) * 100;
                    console.log(`Difference: ${simulator.formatSTX(difference)} (${percentDiff.toFixed(6)}%)`);

                    // Verify the difference is minimal
                    expect(difference).toBe(0);
                    console.log(`Match status: ${difference === 0 ? colors.success('EXACT') + colors.checkmark : colors.error('MISMATCHED') + colors.xmark}`);
                }
            });

            it("should maintain quote consistency under pool state changes", { timeout: 100000 }, () => {
                console.log("\n=== Quote Consistency Under State Changes ===");

                const testAmount = unit;
                console.log(`Test amount: ${simulator.formatSTX(testAmount)}`);

                // Initial quote
                console.log("\n1. Initial state:");
                const initialQuote = simulator.getQuoteSTXtostSTX(testAmount);
                console.log(`Initial quote: ${simulator.formatStSTX(initialQuote)}`);

                // Perform a swap to change pool state
                console.log("\n2. Performing state-changing swap:");
                const stateChangeAmount = 5_000 * unit;
                const stateChangeSwap = simulator.swapSTXForSTSTX(stateChangeAmount);
                console.log(`State change: Swapped ${simulator.formatSTX(stateChangeAmount)} → ${simulator.formatStSTX(stateChangeSwap)}`);

                // Get new quote
                console.log("\n3. New state quote:");
                const newQuote = simulator.getQuoteSTXtostSTX(testAmount);
                console.log(`New quote: ${simulator.formatStSTX(newQuote)}`);

                // Execute swap
                console.log("\n4. Executing swap:");
                const actualSwap = simulator.swapSTXForSTSTX(testAmount);
                console.log(`Actual swap: ${simulator.formatStSTX(actualSwap)}`);

                // Verify quote matches actual swap
                const difference = Math.abs(newQuote - actualSwap);
                const percentDiff = (difference / newQuote) * 100;
                console.log(`\nQuote vs Actual difference: ${simulator.formatStSTX(difference)} (${percentDiff.toFixed(6)}%)`);

                expect(difference).toBe(0);
                console.log(`Match status: ${difference === 0 ? colors.success('EXACT') + colors.checkmark : colors.error('MISMATCHED') + colors.xmark}`);

                // Compare quotes
                const quoteDiff = Math.abs(initialQuote - newQuote);
                const quotePercentDiff = (quoteDiff / initialQuote) * 100;
                console.log(`\nQuote change after state change: ${simulator.formatStSTX(quoteDiff)} (${quotePercentDiff.toFixed(2)}%)`);
                console.log(`Price impact visible in quotes: ${quotePercentDiff > 0 ? colors.success('YES') + colors.checkmark : colors.error('NO') + colors.xmark}`);
            });
        })

        describe("Standard Cases", { timeout: 100000 }, () => {
            it("should handle small STX to stSTX swaps", { timeout: 100000 }, () => {
                console.log("\n=== Small STX to stSTX Swap ===");
                const amount = 100 * unit; // 100 tokens
                console.log(`Input: ${simulator.formatSTX(amount)} (${simulator.formatUSD(amount, Simulator.getPrices().stx)})`);

                const outputAmount = simulator.swapSTXForSTSTX(amount);
                console.log(`Output: ${simulator.formatStSTX(outputAmount)} (${simulator.formatUSD(outputAmount, Simulator.getPrices().ststx)})`);
                console.log(`Effective Price: $${simulator.formatPriceRatio(outputAmount, amount, Simulator.getPrices().ststx, Simulator.getPrices().stx)}`);

                expect(outputAmount).toBeGreaterThan(0);
                const priceImpact = Math.abs((outputAmount / amount) - 1);
                console.log(`Price Impact: ${simulator.formatProfitPercent(priceImpact, 1)}`);
                expect(priceImpact).toBeLessThan(0.2); // Less than 20% impact for small trades
            });

            it("should handle medium STX to stSTX swaps", () => {
                console.log("\n=== Medium STX to stSTX Swap ===");
                const amount = 1_000 * unit; // 1k tokens
                console.log(`Input: ${simulator.formatSTX(amount)} (${simulator.formatUSD(amount, Simulator.getPrices().stx)})`);

                const outputAmount = simulator.swapSTXForSTSTX(amount);
                console.log(`Output: ${simulator.formatStSTX(outputAmount)} (${simulator.formatUSD(outputAmount, Simulator.getPrices().ststx)})`);
                console.log(`Effective Price: $${simulator.formatPriceRatio(outputAmount, amount, Simulator.getPrices().ststx, Simulator.getPrices().stx)}`);

                expect(outputAmount).toBeGreaterThan(0);
                const priceImpact = Math.abs((outputAmount / amount) - 1);
                console.log(`Price Impact: ${simulator.formatProfitPercent(priceImpact, 1)}`);
                expect(priceImpact).toBeLessThan(0.15); // Less than 15% impact for medium trades
            });

            it("should handle large STX to stSTX swaps", () => {
                console.log("\n=== Large STX to stSTX Swap ===");
                const amount = 10_000 * unit; // 10k tokens
                console.log(`Input: ${simulator.formatSTX(amount)} (${simulator.formatUSD(amount, Simulator.getPrices().stx)})`);

                const outputAmount = simulator.swapSTXForSTSTX(amount);
                console.log(`Output: ${simulator.formatStSTX(outputAmount)} (${simulator.formatUSD(outputAmount, Simulator.getPrices().ststx)})`);
                console.log(`Effective Price: $${simulator.formatPriceRatio(outputAmount, amount, Simulator.getPrices().ststx, Simulator.getPrices().stx)}`);

                expect(outputAmount).toBeGreaterThan(0);
                const priceImpact = Math.abs((outputAmount / amount) - 1);
                console.log(`Price Impact: ${simulator.formatProfitPercent(priceImpact, 1)}`);
                expect(priceImpact).toBeLessThan(0.1); // Less than 10% impact for large trades
            });

            it("should handle reverse swaps (stSTX to STX)", () => {
                console.log("\n=== Reverse Swap Test ===");
                const amounts = [
                    { amount: 100 * unit, label: "Small" },
                    { amount: 1_000 * unit, label: "Medium" },
                    { amount: 10_000 * unit, label: "Large" }
                ];

                for (const { amount, label } of amounts) {
                    console.log(`\n${label} stSTX to STX Swap:`);

                    const outputAmount = simulator.swapSTSTXForSTX(amount);
                    console.log(`Effective Price: $${simulator.formatPriceRatio(outputAmount, amount, Simulator.getPrices().stx, Simulator.getPrices().ststx)}`);

                    expect(outputAmount).toBeGreaterThan(0);
                    const priceImpact = Math.abs((outputAmount / amount) - 1);
                    console.log(`Price Impact: ${simulator.formatProfitPercent(priceImpact, 1)}`);
                }
            });
        });

        describe("Market Impact", { timeout: 100000 }, () => {
            it("should maintain reasonable slippage for quoted swaps", { timeout: 100000 }, () => {
                console.log("\n=== Quote vs Actual Execution Test ===");
                const amount = 5_000 * unit;

                // Get quote first
                console.log(`\nGetting quote for ${simulator.formatSTX(amount)}`);
                const quotedAmount = simulator.getQuoteSTXtostSTX(amount);
                console.log(`Quote: ${simulator.formatStSTX(quotedAmount)}`);

                // Execute the swap
                console.log("\nExecuting swap");
                const actualAmount = simulator.swapSTXForSTSTX(amount);
                console.log(`Actual: ${simulator.formatStSTX(actualAmount)}`);

                // Calculate and verify slippage
                const slippage = Math.abs((actualAmount - quotedAmount) / quotedAmount);
                console.log(`\nSlippage: ${simulator.formatProfitPercent(slippage, 1)}`);
                expect(slippage).toBeLessThan(0.01); // Less than 1% slippage
            });
        });

        describe("Pool State Impact", { timeout: 100000 }, () => {
            it("should maintain pool balance ratios within limits", { timeout: 100000 }, () => {
                console.log("\n=== Pool Balance Ratio Test ===");

                // Get initial state
                const initialState = simulator.getPoolState();
                const initialRatio = initialState.stxBalance / initialState.ststxBalance;
                console.log(`Initial STX/stSTX ratio: ${initialRatio.toFixed(4)}`);

                // Perform a significant swap
                const swapAmount = Math.floor(initialState.stxBalance * 0.1); // 10% of pool
                console.log(`\nSwapping ${simulator.formatSTX(swapAmount)}`);
                const outputAmount = simulator.swapSTXForSTSTX(swapAmount);
                console.log(`Output: ${simulator.formatStSTX(outputAmount)}`);

                // Check final ratio
                const finalState = simulator.getPoolState();
                const finalRatio = finalState.stxBalance / finalState.ststxBalance;
                console.log(`Final STX/stSTX ratio: ${finalRatio.toFixed(4)}`);

                // Calculate and verify ratio change
                const ratioChange = Math.abs(finalRatio - initialRatio) / initialRatio;
                console.log(`Ratio change: ${simulator.formatProfitPercent(ratioChange, 1)}`);
                expect(ratioChange).toBeLessThan(0.15); // Less than 15% ratio change
            });

            it("should verify fee accumulation", { timeout: 100000 }, () => {
                console.log("\n=== Fee Accumulation Test ===");

                // Get initial state
                const initialState = simulator.getPoolState();
                console.log("\nInitial State:");
                console.log(`Protocol Fee: ${simulator.formatSTX(initialState.protocolFee)}`);
                console.log(`Provider Fee: ${simulator.formatSTX(initialState.providerFee)}`);
                console.log(`Liquidity Fee: ${simulator.formatSTX(initialState.liquidityFee)}`);

                // Perform multiple swaps
                const swapAmount = 1_000 * unit;
                const swapCount = 5;
                console.log(`\nPerforming ${swapCount} swaps of ${simulator.formatSTX(swapAmount)} each`);

                for (let i = 0; i < swapCount; i++) {
                    simulator.swapSTXForSTSTX(swapAmount);
                }

                // Check final state
                const finalState = simulator.getPoolState();
                console.log("\nFinal State:");
                console.log(`Protocol Fee: ${simulator.formatSTX(finalState.protocolFee)}`);
                console.log(`Provider Fee: ${simulator.formatSTX(finalState.providerFee)}`);
                console.log(`Liquidity Fee: ${simulator.formatSTX(finalState.liquidityFee)}`);

                // Verify fee accumulation
                expect(finalState.protocolFee).toBeGreaterThan(initialState.protocolFee);
                expect(finalState.providerFee).toBeGreaterThan(initialState.providerFee);
                expect(finalState.liquidityFee).toBeGreaterThan(initialState.liquidityFee);

                // Calculate fee accumulation
                const protocolFeeAccumulated = finalState.protocolFee - initialState.protocolFee;
                const providerFeeAccumulated = finalState.providerFee - initialState.providerFee;
                const liquidityFeeAccumulated = finalState.liquidityFee - initialState.liquidityFee;

                console.log("\nFee Accumulation:");
                console.log(`Protocol Fee: +${simulator.formatSTX(protocolFeeAccumulated)}`);
                console.log(`Provider Fee: +${simulator.formatSTX(providerFeeAccumulated)}`);
                console.log(`Liquidity Fee: +${simulator.formatSTX(liquidityFeeAccumulated)}`);
            });
        });

        describe("Edge Cases", { timeout: 100000 }, () => {
            it("should handle minimum swap amounts", { timeout: 100000 }, () => {
                console.log("\n=== Minimum Swap Amount Test ===");
                const minAmount = unit / 100; // 0.01 tokens
                console.log(`Testing minimum swap amount: ${simulator.formatSTX(minAmount)}`);

                // Test both directions
                const stxToStSTX = simulator.swapSTXForSTSTX(minAmount);
                console.log(`STX to stSTX: ${simulator.formatStSTX(stxToStSTX)}`);
                expect(stxToStSTX).toBeGreaterThan(0);

                const stSTXToSTX = simulator.swapSTSTXForSTX(minAmount);
                console.log(`stSTX to STX: ${simulator.formatSTX(stSTXToSTX)}`);
                expect(stSTXToSTX).toBeGreaterThan(0);
            });

            it("should handle maximum swap amounts", () => {
                console.log("\n=== Maximum Swap Amount Test ===");
                const poolState = simulator.getPoolState();
                const maxAmount = Math.floor(poolState.stxBalance * 0.5); // 50% of pool
                console.log(`Testing large swap amount: ${simulator.formatSTX(maxAmount)}`);

                // Test both directions
                const stxToStSTX = simulator.swapSTXForSTSTX(maxAmount);
                console.log(`STX to stSTX: ${simulator.formatStSTX(stxToStSTX)}`);
                expect(stxToStSTX).toBeGreaterThan(0);

                const stSTXToSTX = simulator.swapSTSTXForSTX(maxAmount);
                console.log(`stSTX to STX: ${simulator.formatSTX(stSTXToSTX)}`);
                expect(stSTXToSTX).toBeGreaterThan(0);
            });

            it("should maintain price stability during sequential swaps", { timeout: 100000 }, () => {
                console.log("\n=== Sequential Swap Stability Test ===");
                const amount = 1_000 * unit;
                const swaps = 5;

                console.log(`Performing ${swaps} sequential swaps of ${simulator.formatSTX(amount)}`);
                const results = [];

                for (let i = 0; i < swaps; i++) {
                    console.log(`\nSwap ${i + 1}:`);
                    const output = simulator.swapSTXForSTSTX(amount);
                    const priceRatio = output / amount;
                    results.push(priceRatio);

                    console.log(`Input: ${simulator.formatSTX(amount)}`);
                    console.log(`Output: ${simulator.formatStSTX(output)}`);
                    console.log(`Price Ratio: ${priceRatio.toFixed(4)}`);
                }

                // Check price stability
                const maxDeviation = Math.max(...results) - Math.min(...results);
                console.log(`\nMaximum price deviation: ${(maxDeviation * 100).toFixed(2)}%`);
                expect(maxDeviation).toBeLessThan(0.1); // Less than 10% deviation
            });

            it("should handle back-and-forth swaps efficiently", { timeout: 100000 }, () => {
                console.log("\n=== Back-and-Forth Swap Test ===");
                const initialAmount = 1_000 * unit;
                console.log(`Initial: ${simulator.formatSTX(initialAmount)}`);

                // STX -> stSTX
                const stSTXAmount = simulator.swapSTXForSTSTX(initialAmount);
                console.log(`After first swap: ${simulator.formatStSTX(stSTXAmount)}`);

                // stSTX -> STX
                const finalAmount = simulator.swapSTSTXForSTX(stSTXAmount);
                console.log(`After second swap: ${simulator.formatSTX(finalAmount)}`);

                // Calculate round-trip efficiency
                const efficiency = finalAmount / initialAmount;
                console.log(`\nRound-trip efficiency: ${(efficiency * 100).toFixed(2)}%`);
                console.log(`Value retained: ${simulator.formatSTX(finalAmount)} (from ${simulator.formatSTX(initialAmount)})`);
                console.log(`Loss: ${simulator.formatSTX(initialAmount - finalAmount)} (${simulator.formatProfitPercent((finalAmount - initialAmount) / initialAmount, 1)})`);

                // Verify the loss is within acceptable limits (due to fees)
                expect(efficiency).toBeGreaterThan(0.97); // No more than 3% loss
            });
        });
    });
});
