import { Simulator } from './simulator';
import { describe, expect, it, beforeAll, beforeEach, suite } from 'vitest';

// Get simulator colors for formatting
const colors = Simulator.getColors();
const unit = Simulator.getUnit();

// Test setup
let simulator: Simulator;

suite("Sanity Tests", { timeout: 100000 }, () => {

    beforeAll(async () => {
        // Create simulator
        simulator = await Simulator.create();

        // First mint some stSTX tokens to deployer
        simulator.mintStSTX(20_000_000 * unit);

        // Create pool with default configuration
        // This will create a pool with midpoint ratio of 1.1 (stSTX:STX) and reversed=false
        simulator.createPool();

        // Verify initial pool configuration
        const poolState = simulator.getPoolState();
        console.log("\n✨ Initial Pool Configuration ✨");
        console.log(`STX Balance: ${simulator.formatSTX(poolState.stxBalance)}`);
        console.log(`stSTX Balance: ${simulator.formatStSTX(poolState.ststxBalance)}`);
        console.log(`Midpoint: ${poolState.midpoint / 1_000_000}`);
        console.log(`Midpoint Reversed: ${poolState.midpointReversed}`);

        // Verify midpoint ratio is 1.1
        expect(poolState.midpoint).toBe(1100000);
        expect(poolState.midpointReversed).toBe(false);
    });

    beforeEach(() => {
        simulator.simnet.mineEmptyBlock();
    });

    it("Test 1: Swap 1 stSTX for ~1.1 STX", () => {
        console.log("\n✨ Test 1: Swap 1 stSTX for ~1.1 STX ✨");

        const inputAmount = 1 * unit;
        console.log(`Input: ${simulator.formatStSTX(inputAmount)}`);

        // Execute swap
        const outputAmount = simulator.swapSTSTXForSTX(inputAmount);
        console.log(`Output: ${simulator.formatSTX(outputAmount)}`);

        // Calculate ratio
        const ratio = outputAmount / inputAmount;
        console.log(`Ratio (STX/stSTX): ${ratio.toFixed(6)}`);

        // The ratio should be close to 1.1 (with some slippage)
        expect(ratio).toBeCloseTo(1.1, 1);
        console.log(`Expected ~1.1, got ${ratio.toFixed(6)} ${Math.abs(ratio - 1.1) < 0.1 ? colors.success('PASSED') + colors.checkmark : colors.error('FAILED') + colors.xmark}`);
    });

    it("Test 2: Swap 1 STX for ~0.9 stSTX", () => {
        console.log("\n✨ Test 2: Swap 1 STX for ~0.9 stSTX ✨");

        const inputAmount = 1 * unit;
        console.log(`Input: ${simulator.formatSTX(inputAmount)}`);

        // Execute swap
        const outputAmount = simulator.swapSTXForSTSTX(inputAmount);
        console.log(`Output: ${simulator.formatStSTX(outputAmount)}`);

        // Calculate ratio
        const ratio = outputAmount / inputAmount;
        console.log(`Ratio (stSTX/STX): ${ratio.toFixed(6)}`);

        // The ratio should be close to 0.9 (with some slippage)
        expect(ratio).toBeCloseTo(0.9, 1);
        console.log(`Expected ~0.9, got ${ratio.toFixed(6)} ${Math.abs(ratio - 0.9) < 0.1 ? colors.success('PASSED') + colors.checkmark : colors.error('FAILED') + colors.xmark}`);
    });

    it("Test 3: Add stSTX liquidity single sided, then remove, total value of token received is same minus ~0.5%", () => {
        console.log("\n✨ Test 3: Single-Sided stSTX Liquidity Test ✨");

        const amount = 100 * unit;
        console.log(`Adding ${simulator.formatStSTX(amount)} single-sided`);

        // Get initial pool state
        const initialState = simulator.getPoolState();
        console.log("\nInitial Pool State:");
        console.log(`STX Balance: ${simulator.formatSTX(initialState.stxBalance)}`);
        console.log(`stSTX Balance: ${simulator.formatStSTX(initialState.ststxBalance)}`);

        // Add liquidity (0 STX, 100 stSTX)
        const lpTokensReceived = simulator.addLiquidity(0, amount);
        console.log(`LP Tokens Received: ${simulator.formatUnits(lpTokensReceived)}`);

        // Verify pool state after addition
        const midState = simulator.getPoolState();
        console.log("\nPool State After Addition:");
        console.log(`STX Balance: ${simulator.formatSTX(midState.stxBalance)}`);
        console.log(`stSTX Balance: ${simulator.formatStSTX(midState.ststxBalance)}`);

        // Verify stSTX balance increased
        expect(midState.ststxBalance).toBeGreaterThan(initialState.ststxBalance);

        // Withdraw liquidity
        console.log("\nWithdrawing all LP tokens");
        const { stx, ststx } = simulator.withdrawLiquidity(lpTokensReceived);
        console.log(`Received: ${simulator.formatSTX(stx)} + ${simulator.formatStSTX(ststx)}`);

        // Calculate total value in USD
        const initialValueUSD = amount / unit * Simulator.getPrices().ststx;
        const finalValueUSD = (stx / unit * Simulator.getPrices().stx) + (ststx / unit * Simulator.getPrices().ststx);

        // Calculate fee percentage
        const feePct = 100 * (1 - finalValueUSD / initialValueUSD);

        console.log("\n=== Operation Results ===");
        console.log(`Initial Value: $${initialValueUSD.toFixed(6)}`);
        console.log(`Final Value: $${finalValueUSD.toFixed(6)}`);
        console.log(`Fee: ${feePct.toFixed(4)}%`);

        // Verify fee is around 0.5% (10 basis points)
        expect(feePct).toBeCloseTo(0.5, 1);
        console.log(`Expected ~0.5%, got ${feePct.toFixed(4)}% ${Math.abs(feePct - 0.5) < 0.5 ? colors.success('PASSED') + colors.checkmark : colors.error('FAILED') + colors.xmark}`);
    });

    it("Test 4: Add STX liquidity single sided, then remove, total value of token received is same minus ~0.5%", () => {
        console.log("\n✨ Test 4: Single-Sided STX Liquidity Test ✨");

        const amount = 100 * unit;
        console.log(`Adding ${simulator.formatSTX(amount)} single-sided`);

        // Get initial pool state
        const initialState = simulator.getPoolState();
        console.log("\nInitial Pool State:");
        console.log(`STX Balance: ${simulator.formatSTX(initialState.stxBalance)}`);
        console.log(`stSTX Balance: ${simulator.formatStSTX(initialState.ststxBalance)}`);

        // Add liquidity (100 STX, 0 stSTX)
        const lpTokensReceived = simulator.addLiquidity(amount, 0);
        console.log(`LP Tokens Received: ${simulator.formatUnits(lpTokensReceived)}`);

        // Verify pool state after addition
        const midState = simulator.getPoolState();
        console.log("\nPool State After Addition:");
        console.log(`STX Balance: ${simulator.formatSTX(midState.stxBalance)}`);
        console.log(`stSTX Balance: ${simulator.formatStSTX(midState.ststxBalance)}`);

        // Verify STX balance increased
        expect(midState.stxBalance).toBeGreaterThan(initialState.stxBalance);

        // Withdraw liquidity
        console.log("\nWithdrawing all LP tokens");
        const { stx, ststx } = simulator.withdrawLiquidity(lpTokensReceived);
        console.log(`Received: ${simulator.formatSTX(stx)} + ${simulator.formatStSTX(ststx)}`);

        // Calculate total value in USD
        const initialValueUSD = amount / unit * Simulator.getPrices().stx;
        const finalValueUSD = (stx / unit * Simulator.getPrices().stx) + (ststx / unit * Simulator.getPrices().ststx);

        // Calculate fee percentage
        const feePct = 100 * (1 - finalValueUSD / initialValueUSD);

        console.log("\n=== Operation Results ===");
        console.log(`Initial Value: $${initialValueUSD.toFixed(6)}`);
        console.log(`Final Value: $${finalValueUSD.toFixed(6)}`);
        console.log(`Fee: ${feePct.toFixed(4)}%`);

        // Verify fee is around 0.5% (10 basis points)
        expect(feePct).toBeCloseTo(0.5, 1);
        console.log(`Expected ~0.5%, got ${feePct.toFixed(4)}% ${Math.abs(feePct - 0.5) < 0.5 ? colors.success('PASSED') + colors.checkmark : colors.error('FAILED') + colors.xmark}`);
    });
});
