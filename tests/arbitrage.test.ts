import { Simulator } from './simulator';
import { describe, expect, it, beforeAll, beforeEach, suite } from 'vitest';

// Get simulator colors for formatting
const colors = Simulator.getColors();
const unit = Simulator.getUnit();
// Test setup
let simulator: Simulator;

suite("Anti-Arbitrage", { timeout: 100000 }, () => {

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

    const ATTEMPT_AMOUNT = 1000_000000; // 1k tokens for arbitrage attempt
    const MAX_ACCEPTABLE_PROFIT = 0.001; // 0.1% maximum acceptable profit

    it("should resist single-sided liquidity arbitrage", async () => {
        console.log("\n=== Testing Single-Sided Liquidity Resistance ===");
        console.log(`Attempting arbitrage with ${simulator.formatSTX(ATTEMPT_AMOUNT)} (${simulator.formatUSD(ATTEMPT_AMOUNT, Simulator.getPrices().stx)})`);

        // Step 1: Add single-sided liquidity (STX only)
        const initialInvestmentUSD = ATTEMPT_AMOUNT * Simulator.getPrices().stx;
        const lpTokensReceived = simulator.addLiquidity(ATTEMPT_AMOUNT);

        // Step 2: Remove liquidity
        const { stx: finalSTX, ststx: finalStSTX } = simulator.withdrawLiquidity(lpTokensReceived);

        // Calculate final position value and profit
        const finalValueUSD = (finalSTX * Simulator.getPrices().stx) + (finalStSTX * Simulator.getPrices().ststx);
        const profitUSD = finalValueUSD - initialInvestmentUSD;
        const profitPercent = (profitUSD / initialInvestmentUSD);

        console.log("\n=== Arbitrage Attempt Results ===");
        console.log(`Initial position: ${simulator.formatSTX(ATTEMPT_AMOUNT)} (${simulator.formatUSD(ATTEMPT_AMOUNT, Simulator.getPrices().stx)})`);
        console.log(`Final position: ${simulator.formatSTX(finalSTX)} + ${simulator.formatStSTX(finalStSTX)} (${simulator.formatUSD(finalValueUSD, 1)})`);
        console.log(`Profit/Loss: ${simulator.formatUSD(profitUSD, 1)} (${simulator.formatProfitPercent(profitUSD, initialInvestmentUSD)})`);

        // Verify that profit is below acceptable threshold
        expect(profitPercent).toBeLessThanOrEqual(MAX_ACCEPTABLE_PROFIT);
    });
});

describe("2.1 Single-Sided Liquidity Protection", { timeout: 100000 }, () => {
    const ATTEMPT_AMOUNT = 1_000 * Simulator.getUnit();    // 1k tokens
    const MAX_ACCEPTABLE_PROFIT = 0.001;    // 0.1% maximum acceptable profit

    it("should resist single-sided liquidity imbalance", async () => {
        console.log("\n=== Testing Single-Sided Liquidity Protection ===");
        console.log(`Market conditions: 1 stSTX = ${simulator.formatUSD(Simulator.getUnit(), Simulator.getPrices().ststx)} (${((Simulator.getPrices().ststx / Simulator.getPrices().stx - 1) * 100).toFixed(1)}% premium)`);

        // Step 1: Attempt single-sided liquidity addition
        console.log("\nStep 1: Testing single-sided STX addition");
        const initialInvestmentUSD = ATTEMPT_AMOUNT / Simulator.getUnit() * Simulator.getPrices().stx;
        console.log(`Adding ${simulator.formatSTX(ATTEMPT_AMOUNT)} (${simulator.formatUSD(ATTEMPT_AMOUNT, Simulator.getPrices().stx)})`);

        const lpTokensReceived = simulator.addLiquidity(ATTEMPT_AMOUNT);

        // Step 2: Attempt immediate withdrawal
        console.log("\nStep 2: Testing immediate withdrawal");
        const { stx: finalSTX, ststx: finalStSTX } = simulator.withdrawLiquidity(lpTokensReceived);
        console.log(`Received: ${simulator.formatSTX(finalSTX)} + ${simulator.formatStSTX(finalStSTX)}`);

        // Calculate final position value and profit
        const finalValueUSD = (finalSTX / Simulator.getUnit() * Simulator.getPrices().stx) + (finalStSTX / Simulator.getUnit() * Simulator.getPrices().ststx);
        const profitUSD = finalValueUSD - initialInvestmentUSD;

        console.log("\n=== Protection Analysis ===");
        console.log(`${colors.subtitle('Initial investment:')} ${simulator.formatSTX(ATTEMPT_AMOUNT)} (${simulator.formatUSD(ATTEMPT_AMOUNT, Simulator.getPrices().stx)})`);
        console.log(`${colors.subtitle('Final position:')} ${simulator.formatSTX(finalSTX)} + ${simulator.formatStSTX(finalStSTX)} (${simulator.formatUSD(finalSTX + finalStSTX, Simulator.getPrices().stx)})`);
        console.log(`${colors.subtitle('Total profit/loss:')} ${simulator.formatUSD(profitUSD, Simulator.getPrices().stx)} (${simulator.formatProfitPercent(profitUSD, initialInvestmentUSD)})`);

        // Verify pool protections are working
        const profitPercent = profitUSD / initialInvestmentUSD;
        expect(profitPercent).toBeLessThanOrEqual(MAX_ACCEPTABLE_PROFIT);
        console.log(`\n${colors.subtitle('Protection status:')} ${profitPercent <= MAX_ACCEPTABLE_PROFIT ? colors.success('ACTIVE') + colors.checkmark : colors.error('FAILED') + colors.xmark}`);
        console.log(`${colors.subtitle('Maximum acceptable profit:')} ${colors.info((MAX_ACCEPTABLE_PROFIT * 100).toFixed(3) + '%')}`);
        console.log(`${colors.subtitle('Actual profit:')} ${simulator.formatProfitPercent(profitUSD, initialInvestmentUSD)}`);
    });
});

describe("2.2 Multi-Cycle Trading Protection", { timeout: 100000 }, () => {
    const ATTEMPT_AMOUNT = 1_000 * Simulator.getUnit();    // 1k tokens
    const MAX_ACCEPTABLE_PROFIT = 0.001;    // 0.1% maximum acceptable profit
    const CYCLES = 5;                       // Number of trading cycles to test

    it("should resist multi-cycle trading strategies", async () => {
        console.log("\n=== Testing Multi-Cycle Trading Protection ===");
        console.log(`Market conditions: 1 stSTX = ${simulator.formatUSD(Simulator.getUnit(), Simulator.getPrices().ststx)} (${((Simulator.getPrices().ststx / Simulator.getPrices().stx - 1) * 100).toFixed(1)}% premium)`);
        console.log(`Testing ${CYCLES} cycles with ${simulator.formatSTX(ATTEMPT_AMOUNT)} initial position`);

        let currentSTXBalance = ATTEMPT_AMOUNT;
        let totalProfit = 0;
        let totalVolume = 0;
        const initialInvestmentUSD = (ATTEMPT_AMOUNT / Simulator.getUnit() * Simulator.getPrices().stx);

        for (let cycle = 1; cycle <= CYCLES; cycle++) {
            console.log(`\n${colors.title(`=== Cycle ${cycle} ===`)}`);
            console.log(`${colors.subtitle('Starting balance:')} ${simulator.formatSTX(currentSTXBalance)} (${simulator.formatUSD(currentSTXBalance, Simulator.getPrices().stx)})`);
            totalVolume += currentSTXBalance;

            // Step 1: Add single-sided liquidity
            const lpTokensReceived = simulator.addLiquidity(currentSTXBalance);

            // Step 2: Remove liquidity
            const { stx: receivedSTX, ststx: receivedStSTX } = simulator.withdrawLiquidity(lpTokensReceived);

            // Step 3: Simulate external market swap
            const externalSwapSTX = Math.floor(receivedStSTX * 1.1);
            currentSTXBalance = receivedSTX + externalSwapSTX;

            // Calculate cycle results
            const cycleValueUSD = (currentSTXBalance / Simulator.getUnit() * Simulator.getPrices().stx);
            const previousValueUSD = cycle === 1 ? initialInvestmentUSD : ((totalProfit + initialInvestmentUSD));
            const cycleProfit = cycleValueUSD - previousValueUSD;
            totalProfit += cycleProfit;

            console.log("\n=== Cycle Results ===");
            console.log(`${colors.info('Pool withdrawal:')} ${simulator.formatSTX(receivedSTX)} + ${simulator.formatStSTX(receivedStSTX)}`);
            console.log(`${colors.info('Pool withdrawal value:')} ${simulator.formatUSD(receivedSTX, Simulator.getPrices().stx)} + ${simulator.formatUSD(receivedStSTX, Simulator.getPrices().ststx)}`);
            console.log(`${colors.info('External market:')} ${simulator.formatStSTX(receivedStSTX)} → ${simulator.formatSTX(externalSwapSTX)}`);
            console.log(`${colors.info('External market value:')} ${simulator.formatUSD(receivedStSTX, Simulator.getPrices().ststx)} → ${simulator.formatUSD(externalSwapSTX, Simulator.getPrices().stx)}`);
            console.log(`${colors.info('New position:')} ${simulator.formatSTX(currentSTXBalance)} (${simulator.formatUSD(currentSTXBalance, Simulator.getPrices().stx)})`);
            console.log(`${colors.info('Cycle profit:')} ${simulator.formatUSD(cycleProfit, Simulator.getPrices().stx)} (${simulator.formatProfitPercent(cycleProfit, previousValueUSD)})`);
        }

        // Calculate final results
        const finalValueUSD = (currentSTXBalance / Simulator.getUnit() * Simulator.getPrices().stx);
        const totalProfitPercent = totalProfit / initialInvestmentUSD;

        console.log("\n=== Protection Analysis ===");
        console.log(`${colors.subtitle('Initial investment:')} ${simulator.formatSTX(ATTEMPT_AMOUNT)} (${simulator.formatUSD(ATTEMPT_AMOUNT, Simulator.getPrices().stx)})`);
        console.log(`${colors.subtitle('Final position:')} ${simulator.formatSTX(currentSTXBalance)} (${simulator.formatUSD(finalValueUSD, 1)})`);
        console.log(`${colors.subtitle('Total profit/loss:')} ${simulator.formatUSD(totalProfit * Simulator.getUnit(), Simulator.getPrices().stx)} (${simulator.formatProfitPercent(totalProfit, initialInvestmentUSD)})`);
        console.log(`${colors.subtitle('Total volume:')} ${simulator.formatSTX(totalVolume)} (${simulator.formatUSD(totalVolume, Simulator.getPrices().stx)})`);
        console.log(`${colors.subtitle('Profit/volume ratio:')} ${((totalProfit / (totalVolume / Simulator.getUnit())) * 100).toFixed(3)}%`);

        // Verify pool protections are working
        expect(totalProfitPercent).toBeLessThanOrEqual(MAX_ACCEPTABLE_PROFIT);
        console.log(`\n${colors.subtitle('Protection status:')} ${totalProfitPercent <= MAX_ACCEPTABLE_PROFIT ? colors.success('ACTIVE') + colors.checkmark : colors.error('FAILED') + colors.xmark}`);
        console.log(`${colors.subtitle('Maximum acceptable profit:')} ${colors.info((MAX_ACCEPTABLE_PROFIT * 100).toFixed(3) + '%')}`);
        console.log(`${colors.subtitle('Actual profit:')} ${simulator.formatProfitPercent(totalProfit, initialInvestmentUSD)}`);
    });
});

describe("2.3 External Market Protection", { timeout: 100000 }, () => {
    const ATTEMPT_AMOUNT = 1_000 * Simulator.getUnit();    // 1k tokens
    const MAX_ACCEPTABLE_PROFIT = 0.001;    // 0.1% maximum acceptable profit
    const CYCLES = 5;                       // Number of cycles to test
    const EXTERNAL_PRICE_RATIO = 1.1;       // External market price ratio (10% premium)

    it("should resist arbitrage with external markets", async () => {
        console.log("\n=== Testing External Market Protection ===");
        console.log(`Pool conditions: 1 stSTX = $${Simulator.getPrices().ststx} (${((Simulator.getPrices().ststx / Simulator.getPrices().stx - 1) * 100).toFixed(1)}% premium)`);
        console.log(`External market: 1 stSTX = ${EXTERNAL_PRICE_RATIO} STX (${((EXTERNAL_PRICE_RATIO - 1) * 100).toFixed(1)}% premium)`);
        console.log(`Testing ${CYCLES} cycles with ${simulator.formatSTX(ATTEMPT_AMOUNT)} initial position`);

        let currentSTXBalance = ATTEMPT_AMOUNT;
        let totalProfit = 0;
        let totalVolume = 0;
        const initialInvestmentUSD = (ATTEMPT_AMOUNT / Simulator.getUnit() * Simulator.getPrices().stx);

        for (let cycle = 1; cycle <= CYCLES; cycle++) {
            console.log(`\n${colors.title(`=== Cycle ${cycle} ===`)}`);
            console.log(`${colors.subtitle('Starting balance:')} ${simulator.formatSTX(currentSTXBalance)} (${simulator.formatUSD(currentSTXBalance, Simulator.getPrices().stx)})`);
            totalVolume += currentSTXBalance;

            // Step 1: Add single-sided liquidity
            const lpTokensReceived = simulator.addLiquidity(currentSTXBalance);

            // Step 2: Remove liquidity
            const { stx: receivedSTX, ststx: receivedStSTX } = simulator.withdrawLiquidity(lpTokensReceived);

            // Step 3: Simulate external market swap
            const externalSwapSTX = Math.floor(receivedStSTX * EXTERNAL_PRICE_RATIO);
            currentSTXBalance = receivedSTX + externalSwapSTX;

            // Calculate cycle results
            const cycleValueUSD = (currentSTXBalance / Simulator.getUnit() * Simulator.getPrices().stx);
            const previousValueUSD = cycle === 1 ? initialInvestmentUSD : ((totalProfit + initialInvestmentUSD));
            const cycleProfit = cycleValueUSD - previousValueUSD;
            totalProfit += cycleProfit;

            console.log("\n=== Cycle Results ===");
            console.log(`${colors.info('Pool withdrawal:')} ${simulator.formatSTX(receivedSTX)} + ${simulator.formatStSTX(receivedStSTX)}`);
            console.log(`${colors.info('Pool withdrawal value:')} ${simulator.formatUSD(receivedSTX, Simulator.getPrices().stx)} + ${simulator.formatUSD(receivedStSTX, Simulator.getPrices().ststx)}`);
            console.log(`${colors.info('External market:')} ${simulator.formatStSTX(receivedStSTX)} → ${simulator.formatSTX(externalSwapSTX)}`);
            console.log(`${colors.info('External market value:')} ${simulator.formatUSD(receivedStSTX, Simulator.getPrices().ststx)} → ${simulator.formatUSD(externalSwapSTX, Simulator.getPrices().stx)}`);
            console.log(`${colors.info('New position:')} ${simulator.formatSTX(currentSTXBalance)} (${simulator.formatUSD(currentSTXBalance, Simulator.getPrices().stx)})`);
            console.log(`${colors.info('Cycle profit:')} ${simulator.formatUSD(cycleProfit * Simulator.getUnit(), Simulator.getPrices().stx)} (${simulator.formatProfitPercent(cycleProfit, previousValueUSD)})`);
        }

        // Calculate final results
        const finalValueUSD = (currentSTXBalance / Simulator.getUnit() * Simulator.getPrices().stx);
        const totalProfitPercent = totalProfit / initialInvestmentUSD;

        console.log("\n=== Protection Analysis ===");
        console.log(`${colors.subtitle('Initial investment:')} ${simulator.formatSTX(ATTEMPT_AMOUNT)} (${simulator.formatUSD(ATTEMPT_AMOUNT, Simulator.getPrices().stx)})`);
        console.log(`${colors.subtitle('Final position:')} ${simulator.formatSTX(currentSTXBalance)} (${simulator.formatUSD(finalValueUSD, 1)})`);
        console.log(`${colors.subtitle('Total profit/loss:')} ${simulator.formatUSD(totalProfit * Simulator.getUnit(), Simulator.getPrices().stx)} (${simulator.formatProfitPercent(totalProfit, initialInvestmentUSD)})`);
        console.log(`${colors.subtitle('Total volume:')} ${simulator.formatSTX(totalVolume)} (${simulator.formatUSD(totalVolume, Simulator.getPrices().stx)})`);
        console.log(`${colors.subtitle('Profit/volume ratio:')} ${((totalProfit / (totalVolume / Simulator.getUnit())) * 100).toFixed(3)}%`);

        // Verify pool protections are working
        expect(totalProfitPercent).toBeLessThanOrEqual(MAX_ACCEPTABLE_PROFIT);
        console.log(`\n${colors.subtitle('Protection status:')} ${totalProfitPercent <= MAX_ACCEPTABLE_PROFIT ? colors.success('ACTIVE') + colors.checkmark : colors.error('FAILED') + colors.xmark}`);
        console.log(`${colors.subtitle('Maximum acceptable profit:')} ${colors.info((MAX_ACCEPTABLE_PROFIT * 100).toFixed(3) + '%')}`);
        console.log(`${colors.subtitle('Actual profit:')} ${simulator.formatProfitPercent(totalProfit, initialInvestmentUSD)}`);
    });
});