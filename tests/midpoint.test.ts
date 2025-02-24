import { describe, expect, test, beforeEach } from 'vitest';
import { Simulator } from './simulator';

// Get simulator colors for formatting
const unit = Simulator.getUnit();

// Test setup
let simulator: Simulator;

describe('midpoint and liquidity tests', () => {

    beforeEach(async () => {
        // Create simulator
        simulator = await Simulator.create();

        // First mint some stSTX tokens to deployer
        simulator.mintStSTX(10_000_000 * unit);

        // wait 1 second
        await new Promise(resolve => setTimeout(resolve, 1000));
    });


    test('normal midpoint with 1.1 to 1 ratio', { timeout: 100000 }, () => {

        console.log("\n✨ Normal Midpoint Test ✨");

        // First mint some stSTX tokens to deployer
        simulator.mintStSTX(10_000_000 * unit);

        // Default configuration
        simulator.createPool({ midpoint: 1100000, midpointFactor: 1000000, midpointReversed: false });
        const initialPoolState = simulator.getPoolState();

        // Add balanced liquidity
        const stxAmount = 1_000_000 * simulator.getUnit();
        const ststxAmount = 1_000_000 * simulator.getUnit();

        // Add liquidity
        const lpTokens = simulator.addLiquidity(stxAmount, ststxAmount);
        expect(lpTokens).toBeGreaterThan(0);

        // Withdraw liquidity
        const { stx, ststx } = simulator.withdrawLiquidity(lpTokens);
        expect(stx).toBeLessThan(stxAmount);
        expect(ststx).toBeLessThan(ststxAmount);

        // Verify pool state
        const poolState = simulator.getPoolState();
        expect(poolState.stxBalance).toBeLessThan(initialPoolState.stxBalance + stxAmount);
        expect(poolState.ststxBalance).toBeLessThan(initialPoolState.ststxBalance + ststxAmount);
    });

    test('reversed midpoint with 1 to 1.1 ratio', { timeout: 100000 }, () => {

        console.log("\n✨ Higher Midpoint Factor Test ✨");

        // First mint some stSTX tokens to deployer
        simulator.mintStSTX(10_000_000 * unit);

        // Default configuration
        simulator.createPool({ midpoint: 1000000, midpointFactor: 1100000, midpointReversed: true });
        const initialPoolState = simulator.getPoolState();

        // Add balanced liquidity
        const stxAmount = 1_000_000 * simulator.getUnit();
        const ststxAmount = 1_000_000 * simulator.getUnit();

        // console.log(Array.from(simulator.simnet.getAssetsMap().entries()));

        // Add liquidity
        const lpTokens = simulator.addLiquidity(stxAmount, ststxAmount);
        expect(lpTokens).toBeGreaterThan(0);

        // Withdraw liquidity
        const { stx, ststx } = simulator.withdrawLiquidity(lpTokens);
        expect(stx).toBeLessThan(stxAmount);
        expect(ststx).toBeLessThan(ststxAmount);

        // Verify pool state
        const poolState = simulator.getPoolState();
        expect(poolState.stxBalance).toBeLessThan(initialPoolState.stxBalance + stxAmount);
        expect(poolState.ststxBalance).toBeLessThan(initialPoolState.ststxBalance + ststxAmount);
    });

    test('reversed midpoint with 1.1 to 1 ratio', { timeout: 100000 }, () => {

        // First mint some stSTX tokens to deployer
        simulator.mintStSTX(10_000_000 * unit);

        // Default configuration
        simulator.createPool({ midpoint: 1100000, midpointFactor: 1000000, midpointReversed: true });
        const initialPoolState = simulator.getPoolState();

        // Add balanced liquidity
        const stxAmount = 1_000_000 * simulator.getUnit();
        const ststxAmount = 1_000_000 * simulator.getUnit();

        // Add liquidity
        const lpTokens = simulator.addLiquidity(stxAmount, ststxAmount);
        expect(lpTokens).toBeGreaterThan(0);

        // Withdraw liquidity
        const { stx, ststx } = simulator.withdrawLiquidity(lpTokens);
        expect(stx).toBeLessThan(stxAmount);
        expect(ststx).toBeLessThan(ststxAmount);

        // Verify pool state
        const poolState = simulator.getPoolState();
        expect(poolState.stxBalance).toBeLessThan(initialPoolState.stxBalance + stxAmount);
        expect(poolState.ststxBalance).toBeLessThan(initialPoolState.ststxBalance + ststxAmount);
    });

    test('normal midpoint with 1 to 1.1 ratio', { timeout: 100000 }, () => {

        // First mint some stSTX tokens to deployer
        simulator.mintStSTX(10_000_000 * unit);

        // Default configuration
        simulator.createPool({ midpoint: 1000000, midpointFactor: 1100000, midpointReversed: false });
        const initialPoolState = simulator.getPoolState();

        // Add balanced liquidity
        const stxAmount = 1_000_000 * simulator.getUnit();
        const ststxAmount = 1_000_000 * simulator.getUnit();

        // Add liquidity
        const lpTokens = simulator.addLiquidity(stxAmount, ststxAmount);
        expect(lpTokens).toBeGreaterThan(0);

        // Withdraw liquidity
        const { stx, ststx } = simulator.withdrawLiquidity(lpTokens);
        expect(stx).toBeLessThan(stxAmount);
        expect(ststx).toBeLessThan(ststxAmount);

        // Verify pool state
        const poolState = simulator.getPoolState();
        expect(poolState.stxBalance).toBeLessThan(initialPoolState.stxBalance + stxAmount);
        expect(poolState.ststxBalance).toBeLessThan(initialPoolState.ststxBalance + ststxAmount);
    });


}); 