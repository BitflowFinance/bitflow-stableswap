import { Cl, ClarityType, cvToJSON } from "@stacks/transactions";
import { initSimnet, Simnet } from "@hirosystems/clarinet-sdk";
import chalk from 'chalk';
import { expect } from 'vitest';

export class Simulator {
    // Color formatting helpers
    private static readonly colors = {
        title: (text: string) => chalk.bold.blue(text),
        subtitle: (text: string) => chalk.bold.cyan(text),
        success: (text: string) => chalk.green(text),
        error: (text: string) => chalk.red(text),
        warning: (text: string) => chalk.yellow(text),
        info: (text: string) => chalk.yellow(text),
        profit: (value: number) => value >= 0 ? chalk.green(`+${value.toFixed(2)}`) : chalk.red(value.toFixed(2)),
        amount: (text: string) => chalk.yellow(text),
        usd: (text: string) => chalk.green(text),
        token: (text: string) => chalk.cyan(text),
        percentage: (value: number) => value >= 0 ? chalk.green(`+${value.toFixed(2)}%`) : chalk.red(`${value.toFixed(2)}%`),
        checkmark: ' ✅',
        xmark: ' ❌',
        arrow: chalk.gray('→')
    } as const;

    // Core Constants
    private static readonly DECIMALS = 6;
    private static readonly UNIT = Math.pow(10, Simulator.DECIMALS);

    // Price Constants
    private static readonly ONE_DOLLAR = 1.00;
    private static readonly STX_PRICE_USD = 1.00;
    private static readonly STSTX_PRICE_USD = 1.10;

    public simnet: Simnet;
    static readonly accounts = simnet.getAccounts();
    static readonly deployer = this.accounts.get("deployer")!;
    static readonly wallet1 = this.accounts.get("wallet_1")!;;
    static readonly wallet2 = this.accounts.get("wallet_2")!;
    static readonly wallet3 = this.accounts.get("wallet_3")!;
    static readonly wallet4 = this.accounts.get("wallet_4")!;
    readonly UNIT = Simulator.UNIT;

    // Default Pool Configuration
    private static readonly DEFAULT_POOL_CONFIG = {
        initialBalance: 10_000_000 * this.UNIT, // 10M tokens
        burnAmount: 100000,
        midpoint: 1100000,
        midpointFactor: 1000000,
        midpointReversed: false,
        protocolFee: 4,
        providerFee: 6,
        liquidityFee: 10,
        ampCoeff: 25,
        convergenceThreshold: 2,
        feeAddress: this.wallet1
    } as any;

    constructor(simnet: Simnet) {
        this.simnet = simnet;
    }

    public static async create(): Promise<Simulator> {
        console.log("Creating new simulation...");
        const simnet = await initSimnet();
        return new Simulator(simnet);
    }

    // Static getters for configuration
    public static getDefaultConfig() {
        return this.DEFAULT_POOL_CONFIG;
    }

    public static getPrices() {
        return {
            stx: this.STX_PRICE_USD,
            ststx: this.STSTX_PRICE_USD
        };
    }

    public static getDecimals() {
        return this.DECIMALS;
    }

    public static getUnit() {
        return this.UNIT;
    }

    // Helper Functions
    public getUnit(): number {
        return this.UNIT;
    }

    public getWallet1(): string {
        return Simulator.wallet1;
    }

    public formatUnits(microAmount: number): string {
        return (microAmount / this.UNIT).toFixed(Simulator.DECIMALS);
    }

    public toMicroUnits(amount: number): number {
        return amount * this.UNIT;
    }

    // Token Operations
    public mintStSTX(
        amount: number = 100 * this.UNIT,
        recipient: string = Simulator.deployer
    ): void {
        const result = this.simnet.callPublicFn(
            "token-ststx",
            "mint",
            [
                Cl.uint(amount),
                Cl.principal(recipient)
            ],
            Simulator.deployer
        );
        expect(result.result.type, "Failed to mint stSTX").toBe(ClarityType.ResponseOk);
    }

    // Liquidity Operations
    public addLiquidity(
        stxAmount: number,
        ststxAmount: number,
        minLpTokens: number = 1
    ): number {
        const result = this.simnet.callPublicFn(
            "stableswap-core-v-1-1",
            "add-liquidity",
            [
                Cl.contractPrincipal(Simulator.deployer, "stableswap-pool-stx-ststx-v-1-1"),
                Cl.contractPrincipal(Simulator.deployer, "token-stx-v-1-1"),
                Cl.contractPrincipal(Simulator.deployer, "token-ststx"),
                Cl.uint(stxAmount),
                Cl.uint(ststxAmount),
                Cl.uint(minLpTokens)
            ],
            Simulator.deployer
        );
        expect(result.result.type, "Failed to add liquidity").toBe(ClarityType.ResponseOk);
        return Number(cvToJSON(result.result).value.value);
    }

    public withdrawLiquidity(lpTokens: number, minStx: number = 1, minStSTX: number = 1): { stx: number; ststx: number } {
        const result = this.simnet.callPublicFn(
            "stableswap-core-v-1-1",
            "withdraw-liquidity",
            [
                Cl.contractPrincipal(Simulator.deployer, "stableswap-pool-stx-ststx-v-1-1"),
                Cl.contractPrincipal(Simulator.deployer, "token-stx-v-1-1"),
                Cl.contractPrincipal(Simulator.deployer, "token-ststx"),
                Cl.uint(lpTokens),
                Cl.uint(minStx),
                Cl.uint(minStSTX)
            ],
            Simulator.deployer
        );
        expect(result.result.type, "Failed to withdraw liquidity").toBe(ClarityType.ResponseOk);
        const withdrawAmount = cvToJSON(result.result).value.value;
        return {
            stx: Number(withdrawAmount['x-amount'].value),
            ststx: Number(withdrawAmount['y-amount'].value)
        };
    }

    // Swap Operations
    public swapSTXForSTSTX(
        amount: number = 100 * this.UNIT,
        minOutput: number = 1
    ): number {
        const result = this.simnet.callPublicFn(
            "stableswap-core-v-1-1",
            "swap-x-for-y",
            [
                Cl.contractPrincipal(Simulator.deployer, "stableswap-pool-stx-ststx-v-1-1"),
                Cl.contractPrincipal(Simulator.deployer, "token-stx-v-1-1"),
                Cl.contractPrincipal(Simulator.deployer, "token-ststx"),
                Cl.uint(amount),
                Cl.uint(minOutput)
            ],
            Simulator.deployer
        );
        expect(result.result.type, "Failed to swap STX for stSTX").toBe(ClarityType.ResponseOk);
        return Number(cvToJSON(result.result).value.value);
    }

    public swapSTSTXForSTX(
        amount: number = 100 * this.UNIT,
        minOutput: number = 1
    ): number {
        const result = this.simnet.callPublicFn(
            "stableswap-core-v-1-1",
            "swap-y-for-x",
            [
                Cl.contractPrincipal(Simulator.deployer, "stableswap-pool-stx-ststx-v-1-1"),
                Cl.contractPrincipal(Simulator.deployer, "token-stx-v-1-1"),
                Cl.contractPrincipal(Simulator.deployer, "token-ststx"),
                Cl.uint(amount),
                Cl.uint(minOutput)
            ],
            Simulator.deployer
        );
        expect(result.result.type, "Failed to swap stSTX for STX").toBe(ClarityType.ResponseOk);
        return Number(cvToJSON(result.result).value.value);
    }

    // Pool State and Configuration
    public getPoolState() {
        const result = this.simnet.callReadOnlyFn(
            "stableswap-pool-stx-ststx-v-1-1",
            "get-pool",
            [],
            Simulator.deployer
        );
        expect(result.result.type, "Failed to get pool state").toBe(ClarityType.ResponseOk);
        const cvPoolDetails = cvToJSON(result.result).value.value;
        const poolDetails = {
            stxBalance: Number(cvPoolDetails['x-balance'].value),
            ststxBalance: Number(cvPoolDetails['y-balance'].value),
            protocolFee: Number(cvPoolDetails['x-protocol-fee'].value),
            providerFee: Number(cvPoolDetails['x-provider-fee'].value),
            liquidityFee: Number(cvPoolDetails['liquidity-fee'].value),
            midpoint: Number(cvPoolDetails['midpoint'].value),
            midpointFactor: Number(cvPoolDetails['midpoint-factor'].value),
            midpointReversed: Boolean(cvPoolDetails['midpoint-reversed'].value),
            ampCoeff: Number(cvPoolDetails['amplification-coefficient'].value),
            convergenceThreshold: Number(cvPoolDetails['convergence-threshold'].value)
        }
        // console.log("Pool State:", poolDetails);
        return poolDetails;
    }

    public getQuoteSTXtoSTSTX(amount: number): number {
        const result = this.simnet.callPublicFn(
            "stableswap-core-v-1-1",
            "get-dy",
            [
                Cl.contractPrincipal(Simulator.deployer, "stableswap-pool-stx-ststx-v-1-1"),
                Cl.contractPrincipal(Simulator.deployer, "token-stx-v-1-1"),
                Cl.contractPrincipal(Simulator.deployer, "token-ststx"),
                Cl.uint(amount)
            ],
            Simulator.deployer
        );
        expect(result.result.type, "Failed to get quote").toBe(ClarityType.ResponseOk);
        return Number(cvToJSON(result.result).value.value);
    }

    public getQuoteSTSTXtoSTX(amount: number): number {
        const result = this.simnet.callPublicFn(
            "stableswap-core-v-1-1",
            "get-dx",
            [
                Cl.contractPrincipal(Simulator.deployer, "stableswap-pool-stx-ststx-v-1-1"),
                Cl.contractPrincipal(Simulator.deployer, "token-stx-v-1-1"),
                Cl.contractPrincipal(Simulator.deployer, "token-ststx"),
                Cl.uint(amount)
            ],
            Simulator.deployer
        );
        expect(result.result.type, "Failed to get quote").toBe(ClarityType.ResponseOk);
        return Number(cvToJSON(result.result).value.value);
    }

    // Admin Operations
    public getAdmins(): string[] {
        const result = this.simnet.callReadOnlyFn(
            "stableswap-core-v-1-1",
            "get-admins",
            [],
            Simulator.deployer
        );
        expect(result.result.type, "Failed to get admins").toBe(ClarityType.ResponseOk);
        return cvToJSON(result.result).value.value.map((cv: any) => cv.value);
    }

    public getAdminHelper(): string {
        const result = this.simnet.callReadOnlyFn(
            "stableswap-core-v-1-1",
            "get-admin-helper",
            [],
            Simulator.deployer
        );
        expect(result.result.type, "Failed to get admin helper").toBe(ClarityType.ResponseOk);
        return cvToJSON(result.result).value.value;
    }

    public getLastPoolId(): number {
        const result = this.simnet.callReadOnlyFn(
            "stableswap-core-v-1-1",
            "get-last-pool-id",
            [],
            Simulator.deployer
        );
        expect(result.result.type, "Failed to get last pool ID").toBe(ClarityType.ResponseOk);
        return Number(cvToJSON(result.result).value.value);
    }

    public getPoolById(id: number): {
        id: number;
        name: string;
        poolContract: string;
        symbol: string;
    } {
        const result = this.simnet.callReadOnlyFn(
            "stableswap-core-v-1-1",
            "get-pool-by-id",
            [Cl.uint(id)],
            Simulator.deployer
        );
        expect(result.result.type, "Failed to get pool by ID").toBe(ClarityType.ResponseOk);
        const cvPoolData = cvToJSON(result.result).value.value.value;
        return {
            id: Number(cvPoolData['id'].value),
            name: String(cvPoolData['name'].value),
            poolContract: String(cvPoolData['pool-contract'].value),
            symbol: String(cvPoolData['symbol'].value)
        };
    }

    public getMinimumTotalShares(): number {
        const result = this.simnet.callReadOnlyFn(
            "stableswap-core-v-1-1",
            "get-minimum-total-shares",
            [],
            Simulator.deployer
        );
        expect(result.result.type, "Failed to get minimum total shares").toBe(ClarityType.ResponseOk);
        return Number(cvToJSON(result.result).value.value);
    }

    public getMinimumBurntShares(): number {
        const result = this.simnet.callReadOnlyFn(
            "stableswap-core-v-1-1",
            "get-minimum-burnt-shares",
            [],
            Simulator.deployer
        );
        expect(result.result.type, "Failed to get minimum burnt shares").toBe(ClarityType.ResponseOk);
        return Number(cvToJSON(result.result).value.value);
    }

    public getPublicPoolCreation(): boolean {
        const result = this.simnet.callReadOnlyFn(
            "stableswap-core-v-1-1",
            "get-public-pool-creation",
            [],
            Simulator.deployer
        );
        expect(result.result.type, "Failed to get public pool creation status").toBe(ClarityType.ResponseOk);
        return cvToJSON(result.result).value.value;
    }

    // Pool Creation and Configuration
    public createPool(config: Partial<typeof Simulator.DEFAULT_POOL_CONFIG> = {}) {
        const finalConfig = { ...Simulator.DEFAULT_POOL_CONFIG, ...config };
        const result = this.simnet.callPublicFn(
            "stableswap-core-v-1-1",
            "create-pool",
            [
                Cl.contractPrincipal(Simulator.deployer, "stableswap-pool-stx-ststx-v-1-1"),
                Cl.contractPrincipal(Simulator.deployer, "token-stx-v-1-1"),
                Cl.contractPrincipal(Simulator.deployer, "token-ststx"),
                Cl.uint(finalConfig.initialBalance),
                Cl.uint(finalConfig.initialBalance),
                Cl.uint(finalConfig.burnAmount),
                Cl.uint(finalConfig.midpoint),
                Cl.uint(finalConfig.midpointFactor),
                Cl.bool(finalConfig.midpointReversed),
                Cl.uint(finalConfig.protocolFee),
                Cl.uint(finalConfig.providerFee),
                Cl.uint(finalConfig.protocolFee),
                Cl.uint(finalConfig.providerFee),
                Cl.uint(finalConfig.liquidityFee),
                Cl.uint(finalConfig.ampCoeff),
                Cl.uint(finalConfig.convergenceThreshold),
                Cl.principal(Simulator.wallet1),
                Cl.stringUtf8("stx-ststx-pool-v1"),
                Cl.bool(true)
            ],
            Simulator.deployer
        );
        expect(result.result.type, "Failed to create pool").toBe(ClarityType.ResponseOk);
        return this.getPoolState();
    }

    // Admin Operations - Share Management
    public setMinimumShares(minTotal: number, minBurnt: number): void {
        const result = this.simnet.callPublicFn(
            "stableswap-core-v-1-1",
            "set-minimum-shares",
            [
                Cl.uint(minTotal),
                Cl.uint(minBurnt)
            ],
            Simulator.deployer
        );
        expect(result.result.type, "Failed to set minimum shares").toBe(ClarityType.ResponseOk);
    }

    // Admin Operations - Pool Creation Control
    public setPublicPoolCreation(enabled: boolean): void {
        const result = this.simnet.callPublicFn(
            "stableswap-core-v-1-1",
            "set-public-pool-creation",
            [Cl.bool(enabled)],
            Simulator.deployer
        );
        expect(result.result.type, "Failed to set public pool creation").toBe(ClarityType.ResponseOk);
    }

    // Admin Operations - Pool Configuration
    public setPoolUri(uri: string): void {
        const result = this.simnet.callPublicFn(
            "stableswap-core-v-1-1",
            "set-pool-uri",
            [
                Cl.contractPrincipal(Simulator.deployer, "stableswap-pool-stx-ststx-v-1-1"),
                Cl.stringUtf8(uri)
            ],
            Simulator.deployer
        );
        expect(result.result.type, "Failed to set pool URI").toBe(ClarityType.ResponseOk);
    }

    public setPoolStatus(active: boolean): void {
        const result = this.simnet.callPublicFn(
            "stableswap-core-v-1-1",
            "set-pool-status",
            [
                Cl.contractPrincipal(Simulator.deployer, "stableswap-pool-stx-ststx-v-1-1"),
                Cl.bool(active)
            ],
            Simulator.deployer
        );
        expect(result.result.type, "Failed to set pool status").toBe(ClarityType.ResponseOk);
    }

    // Admin Operations - Fee Configuration
    public setXFees(protocolFee: number, providerFee: number): void {
        const result = this.simnet.callPublicFn(
            "stableswap-core-v-1-1",
            "set-x-fees",
            [
                Cl.contractPrincipal(Simulator.deployer, "stableswap-pool-stx-ststx-v-1-1"),
                Cl.uint(protocolFee),
                Cl.uint(providerFee)
            ],
            Simulator.deployer
        );
        expect(result.result.type, "Failed to set X fees").toBe(ClarityType.ResponseOk);
    }

    public setYFees(protocolFee: number, providerFee: number): void {
        const result = this.simnet.callPublicFn(
            "stableswap-core-v-1-1",
            "set-y-fees",
            [
                Cl.contractPrincipal(Simulator.deployer, "stableswap-pool-stx-ststx-v-1-1"),
                Cl.uint(protocolFee),
                Cl.uint(providerFee)
            ],
            Simulator.deployer
        );
        expect(result.result.type, "Failed to set Y fees").toBe(ClarityType.ResponseOk);
    }

    public setLiquidityFee(fee: number): void {
        const result = this.simnet.callPublicFn(
            "stableswap-core-v-1-1",
            "set-liquidity-fee",
            [
                Cl.contractPrincipal(Simulator.deployer, "stableswap-pool-stx-ststx-v-1-1"),
                Cl.uint(fee)
            ],
            Simulator.deployer
        );
        expect(result.result.type, "Failed to set liquidity fee").toBe(ClarityType.ResponseOk);
    }

    // Admin Operations - Pool Parameters
    public setAmplificationCoefficient(coefficient: number): void {
        const result = this.simnet.callPublicFn(
            "stableswap-core-v-1-1",
            "set-amplification-coefficient",
            [
                Cl.contractPrincipal(Simulator.deployer, "stableswap-pool-stx-ststx-v-1-1"),
                Cl.uint(coefficient)
            ],
            Simulator.deployer
        );
        expect(result.result.type, "Failed to set amplification coefficient").toBe(ClarityType.ResponseOk);
    }

    public setConvergenceThreshold(threshold: number): void {
        const result = this.simnet.callPublicFn(
            "stableswap-core-v-1-1",
            "set-convergence-threshold",
            [
                Cl.contractPrincipal(Simulator.deployer, "stableswap-pool-stx-ststx-v-1-1"),
                Cl.uint(threshold)
            ],
            Simulator.deployer
        );
        expect(result.result.type, "Failed to set convergence threshold").toBe(ClarityType.ResponseOk);
    }

    // Admin Operations - Midpoint Management
    public setMidpointManager(manager: string): void {
        const result = this.simnet.callPublicFn(
            "stableswap-core-v-1-1",
            "set-midpoint-manager",
            [
                Cl.contractPrincipal(Simulator.deployer, "stableswap-pool-stx-ststx-v-1-1"),
                Cl.principal(manager)
            ],
            Simulator.deployer
        );
        expect(result.result.type, "Failed to set midpoint manager").toBe(ClarityType.ResponseOk);
    }

    public setMidpoint(midpoint: number, sender: string = Simulator.deployer): void {
        const result = this.simnet.callPublicFn(
            "stableswap-core-v-1-1",
            "set-midpoint",
            [
                Cl.contractPrincipal(Simulator.deployer, "stableswap-pool-stx-ststx-v-1-1"),
                Cl.uint(midpoint)
            ],
            sender
        );
        expect(result.result.type, "Failed to set midpoint").toBe(ClarityType.ResponseOk);
    }

    public setMidpointFactor(factor: number): void {
        const result = this.simnet.callPublicFn(
            "stableswap-core-v-1-1",
            "set-midpoint-factor",
            [
                Cl.contractPrincipal(Simulator.deployer, "stableswap-pool-stx-ststx-v-1-1"),
                Cl.uint(factor)
            ],
            Simulator.deployer
        );
        expect(result.result.type, "Failed to set midpoint factor").toBe(ClarityType.ResponseOk);
    }

    public setMidpointReversed(reversed: boolean): void {
        const result = this.simnet.callPublicFn(
            "stableswap-core-v-1-1",
            "set-midpoint-reversed",
            [
                Cl.contractPrincipal(Simulator.deployer, "stableswap-pool-stx-ststx-v-1-1"),
                Cl.bool(reversed)
            ],
            Simulator.deployer
        );
        expect(result.result.type, "Failed to set midpoint reversed").toBe(ClarityType.ResponseOk);
    }

    public setFeeAddress(address: string): void {
        const result = this.simnet.callPublicFn(
            "stableswap-core-v-1-1",
            "set-fee-address",
            [
                Cl.contractPrincipal(Simulator.deployer, "stableswap-pool-stx-ststx-v-1-1"),
                Cl.principal(address)
            ],
            Simulator.deployer
        );
        expect(result.result.type, "Failed to set fee address").toBe(ClarityType.ResponseOk);
    }

    // Liquidity Quote Operations
    public getDLP(stxAmount: number, ststxAmount: number): number {
        const result = this.simnet.callPublicFn(
            "stableswap-core-v-1-1",
            "get-dlp",
            [
                Cl.contractPrincipal(Simulator.deployer, "stableswap-pool-stx-ststx-v-1-1"),
                Cl.contractPrincipal(Simulator.deployer, "token-stx-v-1-1"),
                Cl.contractPrincipal(Simulator.deployer, "token-ststx"),
                Cl.uint(stxAmount),
                Cl.uint(ststxAmount)
            ],
            Simulator.deployer
        );
        expect(result.result.type, "Failed to get DLP quote").toBe(ClarityType.ResponseOk);
        return Number(cvToJSON(result.result).value.value);
    }

    // Admin Management
    public addAdmin(admin: string, sender: string = Simulator.deployer): boolean {
        const result = this.simnet.callPublicFn(
            "stableswap-core-v-1-1",
            "add-admin",
            [Cl.principal(admin)],
            sender
        );
        expect(result.result.type, "Failed to add admin").toBe(ClarityType.ResponseOk);
        return cvToJSON(result.result).value.value;
    }

    public removeAdmin(admin: string, sender: string = Simulator.deployer): boolean {
        const result = this.simnet.callPublicFn(
            "stableswap-core-v-1-1",
            "remove-admin",
            [Cl.principal(admin)],
            sender
        );
        expect(result.result.type, "Failed to remove admin").toBe(ClarityType.ResponseOk);
        return cvToJSON(result.result).value.value;
    }

    // Formatting and Calculation Helpers
    public formatSTX(microAmount: number): string {
        return Simulator.colors.token(`${(microAmount / this.UNIT).toLocaleString()} STX`);
    }

    public formatStSTX(microAmount: number): string {
        return Simulator.colors.token(`${(microAmount / this.UNIT).toLocaleString()} stSTX`);
    }

    public formatUSD(microAmount: number, price: number = Simulator.ONE_DOLLAR): string {
        const usdValue = (microAmount / this.UNIT) * price;
        return Simulator.colors.usd(`$${usdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    }

    public formatProfitPercent(profit: number, initial: number): string {
        const percentage = (profit / initial) * 100;
        return Simulator.colors.percentage(percentage);
    }

    public formatPriceRatio(outputAmount: number, inputAmount: number, outputPrice: number, inputPrice: number): string {
        const ratio = ((outputAmount / this.UNIT) * outputPrice) / ((inputAmount / this.UNIT) * inputPrice);
        return ratio.toFixed(4);
    }

    public calculatePriceImpact(outputAmount: number, inputAmount: number): number {
        return Math.abs((outputAmount / inputAmount) - 1);
    }

    public calculateRoundTripEfficiency(finalAmount: number, initialAmount: number): number {
        return finalAmount / initialAmount;
    }

    public calculateValueUSD(
        stxAmount: number,
        ststxAmount: number,
        stxPrice: number = Simulator.STX_PRICE_USD,
        ststxPrice: number = Simulator.STSTX_PRICE_USD
    ): number {
        return (stxAmount / this.UNIT * stxPrice) + (ststxAmount / this.UNIT * ststxPrice);
    }

    // Add color utility getters
    public static getColors() {
        return this.colors;
    }
} 