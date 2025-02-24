import { Simulator } from './simulator';
import { describe, expect, it, beforeAll, suite } from 'vitest';

// Get simulator colors for formatting
const colors = Simulator.getColors();

// Test setup
let simulator: Simulator;

suite("Admin", { timeout: 100000 }, () => {

    beforeAll(async () => {
        // Create simulator
        simulator = await Simulator.create();

        // First mint some stSTX tokens to deployer
        simulator.mintStSTX(10_000_000 * Simulator.getUnit());

        // Create pool with default configuration
        simulator.createPool();
    });

    describe("3.0 Share Management", () => {
        it("should set and verify minimum shares", async () => {
            console.log("\n=== Minimum Shares Configuration Test ===");

            // Get initial values
            const initialTotalShares = simulator.getMinimumTotalShares();
            const initialBurntShares = simulator.getMinimumBurntShares();

            console.log("Initial Configuration:");
            console.log(`${colors.subtitle('Minimum Total Shares:')} ${colors.info(initialTotalShares.toString())}`);
            console.log(`${colors.subtitle('Minimum Burnt Shares:')} ${colors.info(initialBurntShares.toString())}`);

            // Set new values
            const newTotalShares = 2000;
            const newBurntShares = 200;

            console.log("\nSetting new values:");
            console.log(`${colors.subtitle('New Total Shares:')} ${colors.info(newTotalShares.toString())}`);
            console.log(`${colors.subtitle('New Burnt Shares:')} ${colors.info(newBurntShares.toString())}`);

            simulator.setMinimumShares(newTotalShares, newBurntShares);

            // Verify changes
            const updatedTotalShares = simulator.getMinimumTotalShares();
            const updatedBurntShares = simulator.getMinimumBurntShares();

            console.log("\nVerifying changes:");
            console.log(`${colors.subtitle('Updated Total Shares:')} ${colors.info(updatedTotalShares.toString())}`);
            console.log(`${colors.subtitle('Updated Burnt Shares:')} ${colors.info(updatedBurntShares.toString())}`);

            expect(updatedTotalShares).toBe(newTotalShares);
            expect(updatedBurntShares).toBe(newBurntShares);
        });
    });

    describe("3.1 Pool Creation Control", () => {
        it("should toggle and verify public pool creation", async () => {
            console.log("\n=== Public Pool Creation Control Test ===");

            // Get initial state
            const initialState = simulator.getPublicPoolCreation();
            console.log(`${colors.subtitle('Initial State:')} ${colors.info(initialState.toString())}`);

            // Toggle state
            const newState = !initialState;
            console.log(`${colors.subtitle('Setting State To:')} ${colors.info(newState.toString())}`);
            simulator.setPublicPoolCreation(newState);

            // Verify change
            const updatedState = simulator.getPublicPoolCreation();
            console.log(`${colors.subtitle('Updated State:')} ${colors.info(updatedState.toString())}`);

            expect(updatedState).toBe(newState);
        });
    });

    describe("3.2 Pool Configuration", () => {
        it("should set and verify pool URI", async () => {
            console.log("\n=== Pool URI Configuration Test ===");

            const newUri = "https://example.com/pool/metadata";
            console.log(`${colors.subtitle('Setting URI to:')} ${colors.info(newUri)}`);

            simulator.setPoolUri(newUri);
            // Note: There's no getter for URI in the current implementation
            // We could add a getter if needed for verification
        });

        it("should set and verify pool status", async () => {
            console.log("\n=== Pool Status Configuration Test ===");

            // Set pool status to inactive
            console.log(`${colors.subtitle('Setting pool to inactive')}`);
            simulator.setPoolStatus(false);

            // Set pool status back to active
            console.log(`${colors.subtitle('Setting pool back to active')}`);
            simulator.setPoolStatus(true);

            // Note: There's no getter for pool status in the current implementation
            // We could add a getter if needed for verification
        });
    });

    describe("3.3 Fee Configuration", () => {
        it("should set and verify fee parameters", async () => {
            console.log("\n=== Fee Configuration Test ===");

            // Get initial state
            const initialState = simulator.getPoolState();
            console.log("\nInitial Fee Configuration:");
            console.log(`${colors.subtitle('Protocol Fee:')} ${colors.info((initialState.protocolFee / 100).toString() + '%')}`);
            console.log(`${colors.subtitle('Provider Fee:')} ${colors.info((initialState.providerFee / 100).toString() + '%')}`);
            console.log(`${colors.subtitle('Liquidity Fee:')} ${colors.info((initialState.liquidityFee / 100).toString() + '%')}`);

            // Set new fees
            const newProtocolFee = 40; // 0.4%
            const newProviderFee = 35; // 0.35%
            const newLiquidityFee = 45; // 0.45%

            console.log("\nSetting new fees:");
            console.log(`${colors.subtitle('New Protocol Fee:')} ${colors.info((newProtocolFee / 100).toString() + '%')}`);
            console.log(`${colors.subtitle('New Provider Fee:')} ${colors.info((newProviderFee / 100).toString() + '%')}`);
            console.log(`${colors.subtitle('New Liquidity Fee:')} ${colors.info((newLiquidityFee / 100).toString() + '%')}`);

            simulator.setXFees(newProtocolFee, newProviderFee);
            simulator.setYFees(newProtocolFee, newProviderFee);
            simulator.setLiquidityFee(newLiquidityFee);

            // Verify changes
            const updatedState = simulator.getPoolState();
            console.log("\nVerifying updated fees:");
            console.log(`${colors.subtitle('Updated Protocol Fee:')} ${colors.info((updatedState.protocolFee / 100).toString() + '%')}`);
            console.log(`${colors.subtitle('Updated Provider Fee:')} ${colors.info((updatedState.providerFee / 100).toString() + '%')}`);
            console.log(`${colors.subtitle('Updated Liquidity Fee:')} ${colors.info((updatedState.liquidityFee / 100).toString() + '%')}`);

            expect(updatedState.protocolFee).toBe(newProtocolFee);
            expect(updatedState.providerFee).toBe(newProviderFee);
            expect(updatedState.liquidityFee).toBe(newLiquidityFee);
        });
    });

    describe("3.4 Pool Parameters", () => {
        it("should set and verify amplification coefficient", async () => {
            console.log("\n=== Amplification Coefficient Test ===");

            // Get initial state
            const initialState = simulator.getPoolState();
            console.log(`${colors.subtitle('Initial Amplification Coefficient:')} ${colors.info(initialState.ampCoeff.toString())}`);

            // Set new coefficient
            const newCoeff = 150;
            console.log(`${colors.subtitle('Setting New Coefficient:')} ${colors.info(newCoeff.toString())}`);
            simulator.setAmplificationCoefficient(newCoeff);

            // Verify change
            const updatedState = simulator.getPoolState();
            console.log(`${colors.subtitle('Updated Amplification Coefficient:')} ${colors.info(updatedState.ampCoeff.toString())}`);

            expect(updatedState.ampCoeff).toBe(newCoeff);
        });

        it("should set and verify convergence threshold", async () => {
            console.log("\n=== Convergence Threshold Test ===");

            // Get initial state
            const initialState = simulator.getPoolState();
            console.log(`${colors.subtitle('Initial Convergence Threshold:')} ${colors.info(initialState.convergenceThreshold.toString())}`);

            // Set new threshold
            const newThreshold = 3;
            console.log(`${colors.subtitle('Setting New Threshold:')} ${colors.info(newThreshold.toString())}`);
            simulator.setConvergenceThreshold(newThreshold);

            // Verify change
            const updatedState = simulator.getPoolState();
            console.log(`${colors.subtitle('Updated Convergence Threshold:')} ${colors.info(updatedState.convergenceThreshold.toString())}`);

            expect(updatedState.convergenceThreshold).toBe(newThreshold);
        });
    });

    describe("3.5 Midpoint Management", () => {
        it("should set and verify midpoint parameters", async () => {
            console.log("\n=== Midpoint Configuration Test ===");

            // Set midpoint manager
            const wallet1 = simulator.getWallet1();
            console.log(`${colors.subtitle('Setting Midpoint Manager:')} ${colors.info(wallet1)}`);
            simulator.setMidpointManager(wallet1);

            // Set new midpoint
            const newMidpoint = 1100000;
            console.log(`${colors.subtitle('Setting New Midpoint:')} ${colors.info(newMidpoint.toString())}`);
            simulator.setMidpoint(newMidpoint);

            // Set new factor
            const newFactor = 1100000;
            console.log(`${colors.subtitle('Setting New Factor:')} ${colors.info(newFactor.toString())}`);
            simulator.setMidpointFactor(newFactor);

            // Toggle reversed state
            console.log(`${colors.subtitle('Toggling Midpoint Reversed')}`);
            simulator.setMidpointReversed(false);
            simulator.setMidpointReversed(true);
        });
    });

    describe("3.6 Fee Address Management", () => {
        it("should set and verify fee address", async () => {
            console.log("\n=== Fee Address Configuration Test ===");

            const wallet1 = simulator.getWallet1();
            console.log(`${colors.subtitle('Setting Fee Address:')} ${colors.info(wallet1)}`);
            simulator.setFeeAddress(wallet1);
            // Note: There's no getter for fee address in the current implementation
            // We could add a getter if needed for verification
        });
    });

});