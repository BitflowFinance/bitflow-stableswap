import { Simulator } from './simulator';
import { describe, expect, it, beforeAll, beforeEach, suite } from 'vitest';

// Get simulator colors for formatting
const colors = Simulator.getColors();
const unit = Simulator.getUnit();

// Test setup
let simulator: Simulator;

suite("Swaps", { timeout: 100000 }, () => {

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