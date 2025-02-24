import { Simulator } from './simulator';
import { expect, it, beforeAll, suite } from 'vitest';

// Get simulator colors for formatting
const colors = Simulator.getColors();
const unit = Simulator.getUnit();

// Test setup
let simulator: Simulator;

suite("Liquidity", { timeout: 100000 }, () => {

    beforeAll(async () => {
        // Create simulator
        simulator = await Simulator.create();

        // First mint some stSTX tokens to deployer
        simulator.mintStSTX(10_000_000 * unit);

        // Create pool with default configuration
        simulator.createPool();
    });

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