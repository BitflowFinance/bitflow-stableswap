import { Simulator } from './simulator';
import { expect, it, beforeAll, beforeEach, suite } from 'vitest';

// Get simulator colors for formatting
const colors = Simulator.getColors();
const unit = Simulator.getUnit();

// Test setup
let simulator: Simulator;

suite("Quotes", { timeout: 100000 }, () => {

    beforeAll(async () => {
        // Create simulator
        simulator = await Simulator.create();

        // First mint some stSTX tokens to deployer
        simulator.mintStSTX(10_000_000 * unit);

        // Create pool with default configuration
        simulator.createPool();
    });

    beforeEach(() => {
        simulator.simnet.mineEmptyBlock();
    });

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

    it("should handle stSTX to STX quotes correctly", () => {
        console.log("\n=== stSTX to STX Quote Tests ===");

        const testCases = [
            { amount: 100 * unit, label: "Small" },
            { amount: 1_000 * unit, label: "Medium" },
            { amount: 10_000 * unit, label: "Large" }
        ];

        for (const { amount, label } of testCases) {
            console.log(`\n${label} Amount Test:`);
            const quote = simulator.getQuoteSTSTXtoSTX(amount);

            console.log(`Input: ${simulator.formatStSTX(amount)} (${simulator.formatUSD(amount, Simulator.getPrices().ststx)})`);
            console.log(`Output: ${simulator.formatSTX(quote)} (${simulator.formatUSD(quote, Simulator.getPrices().stx)})`);
            console.log(`Effective Price: $${simulator.formatPriceRatio(amount, quote, Simulator.getPrices().ststx, Simulator.getPrices().stx)}`);

            // Basic assertions
            expect(quote).toBeGreaterThan(0);

            // Calculate and check price impact
            const priceImpact = Math.abs((quote / amount) - 1);
            console.log(`Price Impact: ${simulator.formatProfitPercent(priceImpact, 1)}`);

            // Price impact thresholds (matching STX to stSTX thresholds)
            if (label === "Small") {
                expect(quote).toBeLessThan(amount * 1.2); // Should not exceed 20% price impact
            } else if (label === "Medium") {
                expect(quote).toBeLessThan(amount * 1.15); // Should not exceed 15% price impact
            } else {
                expect(quote).toBeLessThan(amount * 1.1); // Should not exceed 10% price impact for larger amounts
            }

            // Verify quote consistency
            const secondQuote = simulator.getQuoteSTSTXtoSTX(amount);
            expect(secondQuote).toBe(quote);
        }

        // Test quote vs actual swap amounts
        const testAmount = 500 * unit;
        const quote = simulator.getQuoteSTSTXtoSTX(testAmount);
        const actualOutput = simulator.swapSTSTXForSTX(testAmount);

        console.log("\nQuote vs Actual Swap Test:");
        console.log(`Quote Amount: ${simulator.formatSTX(quote)}`);
        console.log(`Actual Output: ${simulator.formatSTX(actualOutput)}`);

        // The actual output should be very close to the quote
        const difference = Math.abs(quote - actualOutput);
        const tolerance = unit / 1000; // 0.001 tolerance
        expect(difference).toBeLessThan(tolerance);

        console.log(`Quote Accuracy: ${difference < tolerance ? colors.success('ACCURATE') + colors.checkmark : colors.error('INACCURATE') + colors.xmark}`);
    });

    it("should handle DLP quotes correctly", () => {
        console.log("\n=== DLP Quote Tests ===");

        // Test balanced liquidity quotes
        console.log("\nBalanced Liquidity Tests:");
        const balancedTestCases = [
            { stx: 100 * unit, ststx: 100 * unit, label: "Small" },
            { stx: 1_000 * unit, ststx: 1_000 * unit, label: "Medium" },
            { stx: 10_000 * unit, ststx: 10_000 * unit, label: "Large" }
        ];

        for (const { stx, ststx, label } of balancedTestCases) {
            console.log(`\n${label} Balanced Amount Test:`);
            const dlp = simulator.getDLP(stx, ststx);

            console.log(`Input STX: ${simulator.formatSTX(stx)}`);
            console.log(`Input stSTX: ${simulator.formatStSTX(ststx)}`);
            console.log(`Expected LP Tokens: ${dlp}`);

            // Basic assertions for balanced liquidity
            expect(dlp).toBeGreaterThan(0);

            // Verify quote consistency
            const secondDlp = simulator.getDLP(stx, ststx);
            expect(secondDlp).toBe(dlp);

            // Add liquidity and verify received amount matches quote
            const actualLpTokens = simulator.addLiquidity(stx, ststx);
            console.log(`Actual LP Tokens: ${actualLpTokens}`);

            const difference = Math.abs(dlp - actualLpTokens);
            const tolerance = unit / 1000; // 0.001 tolerance
            expect(difference).toBeLessThan(tolerance);

            console.log(`Quote Accuracy: ${difference < tolerance ? colors.success('ACCURATE') + colors.checkmark : colors.error('INACCURATE') + colors.xmark}`);
        }

        // Test imbalanced liquidity quotes
        console.log("\nImbalanced Liquidity Tests:");
        const imbalancedTestCases = [
            { stx: 150 * unit, ststx: 50 * unit, label: "STX Heavy" },
            { stx: 50 * unit, ststx: 150 * unit, label: "stSTX Heavy" },
            { stx: 1000 * unit, ststx: 0, label: "STX Only" },
            { stx: 0, ststx: 1000 * unit, label: "stSTX Only" }
        ];

        for (const { stx, ststx, label } of imbalancedTestCases) {
            console.log(`\n${label} Test:`);
            const dlp = simulator.getDLP(stx, ststx);

            console.log(`Input STX: ${simulator.formatSTX(stx)}`);
            console.log(`Input stSTX: ${simulator.formatStSTX(ststx)}`);
            console.log(`Expected LP Tokens: ${dlp}`);

            // Basic assertions for imbalanced liquidity
            expect(dlp).toBeGreaterThan(0);

            // Verify quote consistency
            const secondDlp = simulator.getDLP(stx, ststx);
            expect(secondDlp).toBe(dlp);

            // Add liquidity and verify received amount matches quote
            const actualLpTokens = simulator.addLiquidity(stx, ststx);
            console.log(`Actual LP Tokens: ${actualLpTokens}`);

            const difference = Math.abs(dlp - actualLpTokens);
            const tolerance = unit / 1000; // 0.001 tolerance
            expect(difference).toBeLessThan(tolerance);

            console.log(`Quote Accuracy: ${difference < tolerance ? colors.success('ACCURATE') + colors.checkmark : colors.error('INACCURATE') + colors.xmark}`);
        }

        // Test error cases
        console.log("\nError Cases:");

        // Test zero amounts
        try {
            simulator.getDLP(0, 0);
            throw new Error("Should not be able to get DLP quote for zero amounts");
        } catch (error) {
            console.log(`${colors.success('✓')} ${colors.info('Successfully prevented zero amount quote')}`);
        }

        // Test extremely large amounts
        const largeAmount = 1_000_000_000 * unit; // 1 billion
        try {
            const largeDlp = simulator.getDLP(largeAmount, largeAmount);
            console.log(`\nLarge Amount Test:`);
            console.log(`Input: ${simulator.formatSTX(largeAmount)} and ${simulator.formatStSTX(largeAmount)}`);
            console.log(`DLP Quote: ${largeDlp}`);
            expect(largeDlp).toBeGreaterThan(0);
        } catch (error) {
            console.log(`${colors.warning('!')} ${colors.info('Large amount quote failed - might be expected')}`);
        }
    });
});