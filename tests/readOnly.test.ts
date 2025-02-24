import { Simulator } from './simulator';
import { expect, it, beforeAll, suite } from 'vitest';

// Get simulator colors for formatting
const colors = Simulator.getColors();
const unit = Simulator.getUnit();

// Test setup
let simulator: Simulator;

suite("Read-Only", () => {

    beforeAll(async () => {
        // Create simulator
        simulator = await Simulator.create();

        // First mint some stSTX tokens to deployer
        simulator.mintStSTX(10_000_000 * unit);

        // Create pool with default configuration
        simulator.createPool();
    });

    it("should get admin information", () => {
        console.log("\n✨ Admin Information ✨");

        const admins = simulator.getAdmins();
        const adminHelper = simulator.getAdminHelper();

        console.log(`${colors.subtitle('Admins:')} ${colors.info(admins.join(', '))}`);
        console.log(`${colors.subtitle('Admin Helper:')} ${colors.info(adminHelper)}`);

        expect(admins).toBeDefined();
        expect(adminHelper).toBeDefined();
        expect(admins).toContain(simulator.deployer);
    });

    it("should verify read-only functions return expected values", () => {
        console.log("\n✨ Read-Only Functions Test ✨");

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
        console.log("\n✨ Pool Configuration ✨");

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
        console.log("\n✨ Pool State Verification ✨");

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
        console.log("\n✨ Pool Change Tracking ✨");

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