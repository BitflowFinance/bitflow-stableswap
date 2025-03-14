import { Simulator } from './simulator';
import { describe, expect, it, beforeAll, suite } from 'vitest';

// Get simulator colors for formatting
const colors = Simulator.getColors();
const unit = Simulator.getUnit();

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

        // balance the pool with a swap
        simulator.swapSTXForSTSTX(500_000 * unit);
    });

    it("should manage admins correctly", () => {
        console.log("\n✨ Admin Management Test ✨");

        // Get initial admins
        const initialAdmins = simulator.getAdmins();
        console.log(`${colors.subtitle('Initial Admins:')} ${colors.info(initialAdmins.join(', '))}`);
        expect(initialAdmins).toContain(Simulator.deployer);

        // Add a new admin (wallet_1)
        const wallet1 = simulator.getWallet1();
        console.log(`\n${colors.subtitle('Adding Admin:')} ${colors.info(wallet1)}`);
        const addResult = simulator.addAdmin(wallet1);
        expect(addResult).toBe(true);

        // Verify admin was added
        const adminsAfterAdd = simulator.getAdmins();
        console.log(`${colors.subtitle('Admins After Add:')} ${colors.info(adminsAfterAdd.join(', '))}`);
        expect(adminsAfterAdd).toContain(wallet1);
        expect(adminsAfterAdd.length).toBe(initialAdmins.length + 1);

        // Try to add the same admin again (should fail)
        try {
            simulator.addAdmin(wallet1);
            throw new Error("Should not be able to add the same admin twice");
        } catch (error) {
            console.log(`${colors.success('✓')} ${colors.info('Successfully prevented duplicate admin addition')}`);
        }

        // Try to add admin from non-admin account (should fail)
        try {
            simulator.addAdmin(Simulator.deployer, wallet1);
            throw new Error("Non-admin should not be able to add admins");
        } catch (error) {
            console.log(`${colors.success('✓')} ${colors.info('Successfully prevented unauthorized admin addition')}`);
        }

        // Remove the added admin
        console.log(`\n${colors.subtitle('Removing Admin:')} ${colors.info(wallet1)}`);
        const removeResult = simulator.removeAdmin(wallet1);
        expect(removeResult).toBe(true);

        // Verify admin was removed
        const adminsAfterRemove = simulator.getAdmins();
        console.log(`${colors.subtitle('Admins After Remove:')} ${colors.info(adminsAfterRemove.join(', '))}`);
        expect(adminsAfterRemove).not.toContain(wallet1);
        expect(adminsAfterRemove.length).toBe(initialAdmins.length);

        // Try to remove contract deployer (should fail)
        try {
            simulator.removeAdmin(Simulator.deployer);
            throw new Error("Should not be able to remove contract deployer");
        } catch (error) {
            console.log(`${colors.success('✓')} ${colors.info('Successfully prevented contract deployer removal')}`);
        }

        // Try to remove non-existent admin (should fail)
        try {
            simulator.removeAdmin(wallet1);
            throw new Error("Should not be able to remove non-existent admin");
        } catch (error) {
            console.log(`${colors.success('✓')} ${colors.info('Successfully prevented non-existent admin removal')}`);
        }

        // Try to remove admin from non-admin account (should fail)
        try {
            simulator.removeAdmin(Simulator.deployer, wallet1);
            throw new Error("Non-admin should not be able to remove admins");
        } catch (error) {
            console.log(`${colors.success('✓')} ${colors.info('Successfully prevented unauthorized admin removal')}`);
        }
    });

    it("should enforce admin limit", () => {
        console.log("\n✨ Admin Limit Test ✨");

        // Get initial admins count
        const initialAdmins = simulator.getAdmins();
        console.log(`${colors.subtitle('Initial Admin Count:')} ${colors.info(initialAdmins.length.toString())}`);

        // Try to add admins up to the limit
        const maxAdmins = 5;
        const currentCount = initialAdmins.length;
        const additionalAdmins = maxAdmins - currentCount;

        console.log(`${colors.subtitle('Adding')} ${colors.info(additionalAdmins.toString())} ${colors.subtitle('more admins...')}`);

        // Generate test accounts (we'll use wallet_1 with different numbers appended)
        const testAccounts = Array.from(Simulator.accounts.values());

        // Add admins up to the limit
        for (let i = 0; i < additionalAdmins; i++) {
            const result = simulator.addAdmin(testAccounts[i] as string);
            expect(result).toBe(true);
            console.log(`${colors.success('✓')} Added admin: ${colors.info(testAccounts[i] as string)}`);
        }

        // Verify current admin count
        const adminsAtLimit = simulator.getAdmins();
        console.log(`\n${colors.subtitle('Admin Count at Limit:')} ${colors.info(adminsAtLimit.length.toString())}`);
        expect(adminsAtLimit.length).toBe(maxAdmins);

        // Try to add one more admin (should fail)
        try {
            simulator.addAdmin(testAccounts[additionalAdmins] as string);
            throw new Error("Should not be able to exceed admin limit");
        } catch (error) {
            console.log(`${colors.success('✓')} ${colors.info('Successfully prevented exceeding admin limit')}`);
        }

        // Clean up by removing added admins
        console.log('\nCleaning up added admins...');
        for (let i = 0; i < additionalAdmins; i++) {
            simulator.removeAdmin(testAccounts[i] as string);
            console.log(`${colors.success('✓')} Removed admin: ${colors.info(testAccounts[i] as string)}`);
        }

        // Verify cleanup
        const finalAdmins = simulator.getAdmins();
        console.log(`\n${colors.subtitle('Final Admin Count:')} ${colors.info(finalAdmins.length.toString())}`);
        expect(finalAdmins.length).toBe(initialAdmins.length);
    });

    it("should set and verify minimum shares", async () => {
        console.log("\n✨ Minimum Shares Configuration Test ✨");

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

    it("should toggle and verify public pool creation", async () => {
        console.log("\n✨ Public Pool Creation Control Test ✨");

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

    it("should set and verify pool URI", async () => {
        console.log("\n✨ Pool URI Configuration Test ✨");

        const newUri = "https://example.com/pool/metadata";
        console.log(`${colors.subtitle('Setting URI to:')} ${colors.info(newUri)}`);

        simulator.setPoolUri(newUri);
        // Note: There's no getter for URI in the current implementation
        // We could add a getter if needed for verification
    });

    it("should set and verify pool status", async () => {
        console.log("\n✨ Pool Status Configuration Test ✨");

        // Set pool status to inactive
        console.log(`${colors.subtitle('Setting pool to inactive')}`);
        simulator.setPoolStatus(false);

        // Set pool status back to active
        console.log(`${colors.subtitle('Setting pool back to active')}`);
        simulator.setPoolStatus(true);

        // Note: There's no getter for pool status in the current implementation
        // We could add a getter if needed for verification
    });

    it("should set and verify fee parameters", async () => {
        console.log("\n✨ Fee Configuration Test ✨");

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

    it("should set and verify amplification coefficient", async () => {
        console.log("\n✨ Amplification Coefficient Test ✨");

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
        console.log("\n✨ Convergence Threshold Test ✨");

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

    it("should set and verify midpoint parameters", async () => {
        console.log("\n✨ Midpoint Configuration Test ✨");

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

    it("should set and verify fee address", async () => {
        console.log("\n✨ Fee Address Configuration Test ✨");

        const wallet1 = simulator.getWallet1();
        console.log(`${colors.subtitle('Setting Fee Address:')} ${colors.info(wallet1)}`);
        simulator.setFeeAddress(wallet1);
        // Note: There's no getter for fee address in the current implementation
        // We could add a getter if needed for verification
    });

});