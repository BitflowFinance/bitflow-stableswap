import { Simulator } from './simulator';
import { describe, expect, it, beforeAll, beforeEach } from 'vitest';

// Get simulator colors for formatting
const colors = Simulator.getColors();
const unit = Simulator.getUnit();

// Test setup
let simulator: Simulator;

describe("1.1 Quotes", { timeout: 100000 }, () => {

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
});