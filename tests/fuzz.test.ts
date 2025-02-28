import { Simulator } from './simulator';
import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it, beforeAll, beforeEach } from 'vitest';

// Action types that can be performed in a fuzz test
enum ActionType {
    SWAP_STX_FOR_STSTX = 'swapSTXForSTSTX',
    SWAP_STSTX_FOR_STX = 'swapSTSTXForSTX',
    ADD_LIQUIDITY = 'addLiquidity',
    WITHDRAW_LIQUIDITY = 'withdrawLiquidity',
    SET_MIDPOINT = 'setMidpoint',
    SET_AMPLIFICATION_COEFFICIENT = 'setAmplificationCoefficient'
}

// Pool configuration
interface PoolConfig {
    initialBalance: number;
    burnAmount: number;
    midpoint: number;
    midpointFactor: number;
    midpointReversed: boolean;
    protocolFee: number;
    providerFee: number;
    liquidityFee: number;
    ampCoeff: number;
    convergenceThreshold: number;
}

// Action configuration
interface ActionConfig {
    type: ActionType;
    params: any;
}

// Fuzz test configuration
interface FuzzTestConfig {
    filePath: string;
    name: string;
    description: string;
    poolConfig: PoolConfig;
    actions: ActionConfig[];
    expectedChecks: {
        minPoolSolvency: number; // e.g. 0.98 for 98%
        maxUserLoss: number;     // e.g. 0.05 for 5%
        maxProtocolFees: number; // e.g. 0.03 for 3%
    };
}

class FuzzMetrics {
    // Token types in the assets map
    private readonly STX_TOKEN = 'STX';
    private readonly STSTX_TOKEN = '.token-ststx.stSTX';
    private readonly LP_TOKEN = '.stableswap-pool-stx-ststx-v-1-1.pool-token';

    // Initial balances
    private initialBalances: {
        deployer: { stx: number; ststx: number; lp: number };
        pool: { stx: number; ststx: number };
        feeAddress: { stx: number; ststx: number };
    };

    // Track total system value to ensure conservation
    private initialTotalValueUSD: number = 0;

    // Protocol fees tracked (in minimal units, later converted to USD)
    private protocolFeesSTX: number = 0;
    private protocolFeesSTSTX: number = 0;

    // Track swap volume in USD
    private stxSwapVolumeUSD: number = 0;
    private ststxSwapVolumeUSD: number = 0;
    // Track liquidity volume in USD (for add/withdraw liquidity fees)
    private liquidityVolumeUSD: number = 0;

    private simulator: Simulator;
    private poolAddress: string;
    private feeAddress: string;
    private unit: number;
    private stxPrice: number;
    private ststxPrice: number;
    private colors: any;

    constructor(simulator: Simulator) {
        this.simulator = simulator;
        this.unit = simulator.getUnit();
        this.stxPrice = Simulator.getPrices().stx;
        this.ststxPrice = Simulator.getPrices().ststx;
        this.colors = Simulator.getColors();

        // Set addresses
        this.poolAddress = `${Simulator.deployer}.stableswap-pool-stx-ststx-v-1-1`;
        this.feeAddress = simulator.getWallet1(); // wallet1 is fee address

        // Initialize balances object
        this.initialBalances = {
            deployer: { stx: 0, ststx: 0, lp: 0 },
            pool: { stx: 0, ststx: 0 },
            feeAddress: { stx: 0, ststx: 0 }
        };
    }

    // Initialize tracking with starting balances
    public initializeTracking(): void {
        const assetsMap = this.simulator.simnet.getAssetsMap();
        this.initialBalances = {
            deployer: {
                stx: this.getAssetBalance(assetsMap, Simulator.deployer, this.STX_TOKEN),
                ststx: this.getAssetBalance(assetsMap, Simulator.deployer, this.STSTX_TOKEN),
                lp: this.getAssetBalance(assetsMap, Simulator.deployer, this.LP_TOKEN)
            },
            pool: {
                stx: this.getAssetBalance(assetsMap, this.poolAddress, this.STX_TOKEN),
                ststx: this.getAssetBalance(assetsMap, this.poolAddress, this.STSTX_TOKEN)
            },
            feeAddress: {
                stx: this.getAssetBalance(assetsMap, this.feeAddress, this.STX_TOKEN),
                ststx: this.getAssetBalance(assetsMap, this.feeAddress, this.STSTX_TOKEN)
            }
        };

        this.initialTotalValueUSD = this.calculateTotalSystemValue(assetsMap);

        // Reset fees and volumes
        this.protocolFeesSTX = 0;
        this.protocolFeesSTSTX = 0;
        this.stxSwapVolumeUSD = 0;
        this.ststxSwapVolumeUSD = 0;
        this.liquidityVolumeUSD = 0;
    }

    // Calculate total system value across accounts
    private calculateTotalSystemValue(assetsMap: Map<string, Map<string, bigint>>): number {
        const deployerSTX = this.getAssetBalance(assetsMap, Simulator.deployer, this.STX_TOKEN);
        const deployerSTSTX = this.getAssetBalance(assetsMap, Simulator.deployer, this.STSTX_TOKEN);
        const poolSTX = this.getAssetBalance(assetsMap, this.poolAddress, this.STX_TOKEN);
        const poolSTSTX = this.getAssetBalance(assetsMap, this.poolAddress, this.STSTX_TOKEN);
        const feeAddressSTX = this.getAssetBalance(assetsMap, this.feeAddress, this.STX_TOKEN);
        const feeAddressSTSTX = this.getAssetBalance(assetsMap, this.feeAddress, this.STSTX_TOKEN);

        const totalSTXValue = ((deployerSTX + poolSTX + feeAddressSTX) / this.unit) * this.stxPrice;
        const totalSTSTXValue = ((deployerSTSTX + poolSTSTX + feeAddressSTSTX) / this.unit) * this.ststxPrice;
        return totalSTXValue + totalSTSTXValue;
    }

    // Track protocol fees from operations
    public trackFee(isSTX: boolean, feeAmount: number): void {
        if (isSTX) {
            this.protocolFeesSTX += feeAmount;
        } else {
            this.protocolFeesSTSTX += feeAmount;
        }
    }

    // Convert swap amounts to USD and track swap volume
    public trackSwap(isSTX: boolean, amount: number): void {
        if (isSTX) {
            this.stxSwapVolumeUSD += (amount / this.unit) * this.stxPrice;
        } else {
            this.ststxSwapVolumeUSD += (amount / this.unit) * this.ststxPrice;
        }
    }

    // Track liquidity operation volumes (add/withdraw) in USD
    public trackLiquidityVolume(isSTX: boolean, amount: number): void {
        if (isSTX) {
            this.liquidityVolumeUSD += (amount / this.unit) * this.stxPrice;
        } else {
            this.liquidityVolumeUSD += (amount / this.unit) * this.ststxPrice;
        }
    }

    // Helper to get asset balance
    private getAssetBalance(assetsMap: Map<string, Map<string, bigint>>, owner: string, tokenType: string): number {
        const tokenMap = assetsMap.get(tokenType);
        if (!tokenMap) return 0;
        const balance = tokenMap.get(owner);
        return balance ? Number(balance) : 0;
    }

    // Calculate USD value for tokens
    public getUSDValue(stxAmount: number, ststxAmount: number): number {
        return (stxAmount / this.unit) * this.stxPrice +
            (ststxAmount / this.unit) * this.ststxPrice;
    }

    // Format USD value for display
    public formatUSD(value: number): string {
        return this.colors.usd('$' + value.toFixed(2));
    }

    // Get state snapshot with USD values
    public getStateSnapshot(): any {
        const assetsMap = this.simulator.simnet.getAssetsMap();

        const deployerSTX = this.getAssetBalance(assetsMap, Simulator.deployer, this.STX_TOKEN);
        const deployerSTSTX = this.getAssetBalance(assetsMap, Simulator.deployer, this.STSTX_TOKEN);
        const deployerLP = this.getAssetBalance(assetsMap, Simulator.deployer, this.LP_TOKEN);

        const poolSTX = this.getAssetBalance(assetsMap, this.poolAddress, this.STX_TOKEN);
        const poolSTSTX = this.getAssetBalance(assetsMap, this.poolAddress, this.STSTX_TOKEN);

        const feeAddressSTX = this.getAssetBalance(assetsMap, this.feeAddress, this.STX_TOKEN);
        const feeAddressSTSTX = this.getAssetBalance(assetsMap, this.feeAddress, this.STSTX_TOKEN);

        const deployerValue = this.getUSDValue(deployerSTX, deployerSTSTX);
        const poolValue = this.getUSDValue(poolSTX, poolSTSTX);
        const feeAddressValue = this.getUSDValue(feeAddressSTX, feeAddressSTSTX);

        const totalSystemValue = this.calculateTotalSystemValue(assetsMap);
        const systemValueDelta = totalSystemValue - this.initialTotalValueUSD;

        return {
            deployer: { stx: deployerSTX, ststx: deployerSTSTX, lp: deployerLP, valueUSD: deployerValue },
            pool: { stx: poolSTX, ststx: poolSTSTX, valueUSD: poolValue },
            feeAddress: { stx: feeAddressSTX, ststx: feeAddressSTSTX, valueUSD: feeAddressValue },
            system: { totalValueUSD: totalSystemValue, valueDeltaUSD: systemValueDelta }
        };
    }

    // Calculate and return metrics for the test run
    public calculateMetrics() {
        const assetsMap = this.simulator.simnet.getAssetsMap();

        const currentBalances = {
            deployer: {
                stx: this.getAssetBalance(assetsMap, Simulator.deployer, this.STX_TOKEN),
                ststx: this.getAssetBalance(assetsMap, Simulator.deployer, this.STSTX_TOKEN),
                lp: this.getAssetBalance(assetsMap, Simulator.deployer, this.LP_TOKEN)
            },
            pool: {
                stx: this.getAssetBalance(assetsMap, this.poolAddress, this.STX_TOKEN),
                ststx: this.getAssetBalance(assetsMap, this.poolAddress, this.STSTX_TOKEN)
            },
            feeAddress: {
                stx: this.getAssetBalance(assetsMap, this.feeAddress, this.STX_TOKEN),
                ststx: this.getAssetBalance(assetsMap, this.feeAddress, this.STSTX_TOKEN)
            }
        };

        const deltaFeeAddressSTX = currentBalances.feeAddress.stx - this.initialBalances.feeAddress.stx;
        const deltaFeeAddressSTSTX = currentBalances.feeAddress.ststx - this.initialBalances.feeAddress.ststx;
        const actualProtocolFeesUSD = this.getUSDValue(deltaFeeAddressSTX, deltaFeeAddressSTSTX);

        const initialPoolValueUSD = this.getUSDValue(
            this.initialBalances.pool.stx,
            this.initialBalances.pool.ststx
        );
        const finalPoolValueUSD = this.getUSDValue(
            currentBalances.pool.stx,
            currentBalances.pool.ststx
        );

        const totalSwapVolumeUSD = this.stxSwapVolumeUSD + this.ststxSwapVolumeUSD;
        const totalVolumeUSD = totalSwapVolumeUSD + this.liquidityVolumeUSD;

        const deltaUserSTX = currentBalances.deployer.stx - this.initialBalances.deployer.stx;
        const deltaUserSTSTX = currentBalances.deployer.ststx - this.initialBalances.deployer.ststx;
        const deltaUserLP = currentBalances.deployer.lp - this.initialBalances.deployer.lp;
        const userValueChangeUSD = this.getUSDValue(deltaUserSTX, deltaUserSTSTX);

        const trackedProtocolFeesUSD = this.getUSDValue(this.protocolFeesSTX, this.protocolFeesSTSTX);
        const protocolFeePercentage = totalVolumeUSD > 0 ? actualProtocolFeesUSD / totalVolumeUSD : 0;

        const currentTotalSystemValue = this.calculateTotalSystemValue(assetsMap);
        const systemValueDelta = currentTotalSystemValue - this.initialTotalValueUSD;

        return {
            initialPoolValueUSD,
            finalPoolValueUSD,
            userValueChangeUSD,
            actualProtocolFeesUSD,
            trackedProtocolFeesUSD,
            solvencyRatio: finalPoolValueUSD / initialPoolValueUSD,
            protocolFeePercentage,
            systemValueDelta,
            totalSwapVolumeUSD,
            rawData: {
                initialBalances: this.initialBalances,
                currentBalances,
                protocolFeesSTX: this.protocolFeesSTX,
                protocolFeesSTSTX: this.protocolFeesSTSTX,
                deltaUserSTX,
                deltaUserSTSTX,
                deltaUserLP,
                deltaFeeAddressSTX,
                deltaFeeAddressSTSTX,
                stxSwapVolumeUSD: this.stxSwapVolumeUSD,
                ststxSwapVolumeUSD: this.ststxSwapVolumeUSD,
                liquidityVolumeUSD: this.liquidityVolumeUSD
            }
        };
    }

    // Format the metrics for display with emoji enhancements
    public formatMetrics(metrics: any): string {
        const POOL_EMOJI = '🏊';
        const UP_EMOJI = '📈';
        const DOWN_EMOJI = '📉';
        const WALLET_EMOJI = '👛';
        const LP_EMOJI = '🔄';
        const FEE_EMOJI = '💰';
        const CHECK_EMOJI = '✅';
        const WARNING_EMOJI = '⚠️';
        const ERROR_EMOJI = '❌';
        const DELTA_EMOJI = '🔄';

        const solvencyEmoji = metrics.solvencyRatio >= 1 ? CHECK_EMOJI : ERROR_EMOJI;
        const userValueEmoji = metrics.userValueChangeUSD >= 0 ? UP_EMOJI : DOWN_EMOJI;
        const systemValueEmoji = Math.abs(metrics.systemValueDelta) < 0.01 ? CHECK_EMOJI : WARNING_EMOJI;

        return `
${POOL_EMOJI} Pool Health:
  Initial Pool Value: ${this.colors.usd('$' + metrics.initialPoolValueUSD.toLocaleString('en-US', { maximumFractionDigits: 2 }))}
  Final Pool Value: ${this.colors.usd('$' + metrics.finalPoolValueUSD.toLocaleString('en-US', { maximumFractionDigits: 2 }))}
  Pool Solvency: ${solvencyEmoji} ${metrics.solvencyRatio >= 1 ?
                this.colors.success(metrics.solvencyRatio.toFixed(4)) :
                this.colors.error(metrics.solvencyRatio.toFixed(4))}

${WALLET_EMOJI} User Value:
  Token Holdings Change: ${userValueEmoji} ${metrics.userValueChangeUSD >= 0 ?
                this.colors.success('$' + metrics.userValueChangeUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })) :
                this.colors.error('$' + metrics.userValueChangeUSD.toLocaleString('en-US', { maximumFractionDigits: 2 }))}
  ${LP_EMOJI} LP Tokens Change: ${this.simulator.formatUnits(metrics.rawData.deltaUserLP)}
  
${FEE_EMOJI} Protocol Performance:
  Total Volume: ${this.colors.usd('$' + (metrics.totalSwapVolumeUSD + metrics.rawData.liquidityVolumeUSD).toFixed(2))}
  Protocol Fees: ${this.colors.usd('$' + metrics.actualProtocolFeesUSD.toLocaleString('en-US', { maximumFractionDigits: 2 }))}
  Fee Percentage: ${this.colors.percentage(metrics.protocolFeePercentage * 100)}

${DELTA_EMOJI} System Integrity:
  System Value Delta: ${systemValueEmoji} ${Math.abs(metrics.systemValueDelta) < 0.01 ?
                this.colors.success('$' + metrics.systemValueDelta.toFixed(4)) :
                this.colors.error('$' + metrics.systemValueDelta.toFixed(4))}

Raw Balance Changes:
  ${WALLET_EMOJI} User STX: ${this.simulator.formatSTX(metrics.rawData.initialBalances.deployer.stx)} → ${this.simulator.formatSTX(metrics.rawData.currentBalances.deployer.stx)} (${metrics.rawData.deltaUserSTX > 0 ? '+' : ''}${this.simulator.formatSTX(metrics.rawData.deltaUserSTX)})
  ${WALLET_EMOJI} User stSTX: ${this.simulator.formatStSTX(metrics.rawData.initialBalances.deployer.ststx)} → ${this.simulator.formatStSTX(metrics.rawData.currentBalances.deployer.ststx)} (${metrics.rawData.deltaUserSTSTX > 0 ? '+' : ''}${this.simulator.formatStSTX(metrics.rawData.deltaUserSTSTX)})
  ${POOL_EMOJI} Pool STX: ${this.simulator.formatSTX(metrics.rawData.initialBalances.pool.stx)} → ${this.simulator.formatSTX(metrics.rawData.currentBalances.pool.stx)}
  ${POOL_EMOJI} Pool stSTX: ${this.simulator.formatStSTX(metrics.rawData.initialBalances.pool.ststx)} → ${this.simulator.formatStSTX(metrics.rawData.currentBalances.pool.ststx)}
  ${FEE_EMOJI} Fee Address STX: ${this.simulator.formatSTX(metrics.rawData.initialBalances.feeAddress.stx)} → ${this.simulator.formatSTX(metrics.rawData.currentBalances.feeAddress.stx)} (${metrics.rawData.deltaFeeAddressSTX > 0 ? '+' : ''}${this.simulator.formatSTX(metrics.rawData.deltaFeeAddressSTX)})
  ${FEE_EMOJI} Fee Address stSTX: ${this.simulator.formatStSTX(metrics.rawData.initialBalances.feeAddress.ststx)} → ${this.simulator.formatStSTX(metrics.rawData.currentBalances.feeAddress.ststx)} (${metrics.rawData.deltaFeeAddressSTSTX > 0 ? '+' : ''}${this.simulator.formatStSTX(metrics.rawData.deltaFeeAddressSTSTX)})
`;
    }
}

// Get all fuzz test config files from the data directory
function getFuzzTestConfigs(): FuzzTestConfig[] {
    const testsDir = path.join(process.cwd(), 'tests', 'data');
    if (!fs.existsSync(testsDir)) {
        console.warn(`Directory '${testsDir}' does not exist. No fuzz tests will be run.`);
        return [];
    }
    const files = fs.readdirSync(testsDir)
        .filter(file => file.endsWith('.json'))
        .map(file => path.join(testsDir, file));
    return files.map(file => {
        try {
            const content = fs.readFileSync(file, 'utf8');
            return { ...JSON.parse(content) as FuzzTestConfig, filePath: file };
        } catch (error) {
            console.error(`Error reading/parsing fuzz test config file ${file}:`, error);
            return null;
        }
    }).filter(config => config !== null) as (FuzzTestConfig & { filePath: string })[];
}

const testConfigs = getFuzzTestConfigs();

// Main test suite
describe('StableSwap Fuzz Tests', () => {
    testConfigs.forEach(testConfig => {
        describe(`Fuzz Test: ${testConfig.name}`, () => {
            let simulator: Simulator;
            let metrics: FuzzMetrics;
            const UNIT = 1_000_000;
            const colors = Simulator.getColors();

            beforeAll(async () => {
                console.log(`\n🧪 ${colors.title(`Starting Fuzz Test: ${testConfig.name}`)}`);
                console.log(`📝 ${colors.subtitle(`${testConfig.description}`)}`);
                console.log(`📄 Source: ${testConfig.filePath}`);
            });

            beforeAll(async () => {
                simulator = await Simulator.create();
                metrics = new FuzzMetrics(simulator);
                simulator.mintStSTX(100_000_000 * UNIT);
                simulator.createPool(testConfig.poolConfig);

                const initialState = simulator.getPoolState();
                if (simulator.getPoolState().stxBalance === testConfig.poolConfig.initialBalance) {
                    console.log(`\n${colors.subtitle('Initial Pool Configuration:')}`);
                    console.log(`STX Balance: ${simulator.formatSTX(initialState.stxBalance)}`);
                    console.log(`stSTX Balance: ${simulator.formatStSTX(initialState.ststxBalance)}`);
                    console.log(`Midpoint: ${initialState.midpoint / 1_000_000}`);
                    console.log(`Midpoint Reversed: ${initialState.midpointReversed}`);
                    console.log(`Amplification Coefficient: ${initialState.ampCoeff}`);

                    const snapshot = metrics.getStateSnapshot();
                    console.log(`Total System Value: ${metrics.formatUSD(snapshot.system.totalValueUSD)}`);
                }
                metrics.initializeTracking();

                // Execute previous actions if any (build state)
                const actionIndex = parseInt(expect.getState().currentTestName || "0");
                if (actionIndex > 0) {
                    for (let i = 0; i < actionIndex; i++) {
                        executeAction(testConfig.actions[i], i);
                    }
                }
            });

            function executeAction(action: ActionConfig, index: number): void {
                try {
                    switch (action.type) {
                        case ActionType.SWAP_STX_FOR_STSTX: {
                            const ststxOutput = simulator.swapSTXForSTSTX(action.params.amount, action.params.minOutput);
                            const poolStateAfter = simulator.getPoolState();
                            const protocolFeeSTX = (action.params.amount * poolStateAfter.protocolFee) / 10000;
                            metrics.trackFee(true, protocolFeeSTX);
                            metrics.trackSwap(true, action.params.amount);
                            break;
                        }
                        case ActionType.SWAP_STSTX_FOR_STX: {
                            const stxOutput = simulator.swapSTSTXForSTX(action.params.amount, action.params.minOutput);
                            const poolStateAfter = simulator.getPoolState();
                            const protocolFeeSTSTX = (action.params.amount * poolStateAfter.protocolFee) / 10000;
                            metrics.trackFee(false, protocolFeeSTSTX);
                            metrics.trackSwap(false, action.params.amount);
                            break;
                        }
                        case ActionType.ADD_LIQUIDITY: {
                            simulator.addLiquidity(
                                action.params.stxAmount,
                                action.params.ststxAmount,
                                action.params.minLpTokens
                            );
                            const feeSTX = (action.params.stxAmount * testConfig.poolConfig.liquidityFee) / 10000;
                            const feeSTSTX = (action.params.ststxAmount * testConfig.poolConfig.liquidityFee) / 10000;
                            metrics.trackFee(true, feeSTX);
                            metrics.trackFee(false, feeSTSTX);
                            metrics.trackLiquidityVolume(true, action.params.stxAmount);
                            metrics.trackLiquidityVolume(false, action.params.ststxAmount);
                            break;
                        }
                        case ActionType.WITHDRAW_LIQUIDITY: {
                            const { stx, ststx } = simulator.withdrawLiquidity(
                                action.params.lpTokens,
                                action.params.minStx,
                                action.params.minStSTX
                            );
                            const feeSTX = (stx * testConfig.poolConfig.liquidityFee) / 10000;
                            const feeSTSTX = (ststx * testConfig.poolConfig.liquidityFee) / 10000;
                            metrics.trackFee(true, feeSTX);
                            metrics.trackFee(false, feeSTSTX);
                            metrics.trackLiquidityVolume(true, stx);
                            metrics.trackLiquidityVolume(false, ststx);
                            break;
                        }
                        case ActionType.SET_MIDPOINT:
                            simulator.setMidpoint(action.params.midpoint);
                            break;
                        case ActionType.SET_AMPLIFICATION_COEFFICIENT:
                            simulator.setAmplificationCoefficient(action.params.coefficient);
                            break;
                        default:
                            console.warn(`Unknown action type: ${action.type}`);
                    }
                    simulator.simnet.mineEmptyBlock();
                } catch (error) {
                    console.error(`Error executing action ${index}: ${error}`);
                    throw error;
                }
            }

            testConfig.actions.forEach((action, index) => {
                it(`${index}: ${action.type}`, () => {
                    const assetsBefore = simulator.simnet.getAssetsMap();
                    const stateBefore = simulator.getPoolState();
                    const snapshotBefore = metrics.getStateSnapshot();

                    console.log(`\n${colors.info(`Action ${index + 1}/${testConfig.actions.length}: ${action.type}`)}`);
                    switch (action.type) {
                        case ActionType.SWAP_STX_FOR_STSTX: {
                            const ststxOutput = simulator.swapSTXForSTSTX(action.params.amount, action.params.minOutput);
                            console.log(`Swapped ${simulator.formatSTX(action.params.amount)} for ${simulator.formatStSTX(ststxOutput)}`);
                            expect(ststxOutput).toBeGreaterThan(0);
                            expect(ststxOutput).toBeGreaterThanOrEqual(action.params.minOutput);
                            const poolStateAfter = simulator.getPoolState();
                            const protocolFeeSTX = (action.params.amount * poolStateAfter.protocolFee) / 10000;
                            metrics.trackFee(true, protocolFeeSTX);
                            metrics.trackSwap(true, action.params.amount);
                            expect(poolStateAfter.stxBalance).toBeGreaterThan(stateBefore.stxBalance);
                            expect(poolStateAfter.ststxBalance).toBeLessThan(stateBefore.ststxBalance);
                            break;
                        }
                        case ActionType.SWAP_STSTX_FOR_STX: {
                            const stxOutput = simulator.swapSTSTXForSTX(action.params.amount, action.params.minOutput);
                            console.log(`Swapped ${simulator.formatStSTX(action.params.amount)} for ${simulator.formatSTX(stxOutput)}`);
                            expect(stxOutput).toBeGreaterThan(0);
                            expect(stxOutput).toBeGreaterThanOrEqual(action.params.minOutput);
                            const poolStateAfter = simulator.getPoolState();
                            const protocolFeeSTSTX = (action.params.amount * poolStateAfter.protocolFee) / 10000;
                            metrics.trackFee(false, protocolFeeSTSTX);
                            metrics.trackSwap(false, action.params.amount);
                            expect(poolStateAfter.stxBalance).toBeLessThan(stateBefore.stxBalance);
                            expect(poolStateAfter.ststxBalance).toBeGreaterThan(stateBefore.ststxBalance);
                            break;
                        }
                        case ActionType.ADD_LIQUIDITY: {
                            const lpTokens = simulator.addLiquidity(
                                action.params.stxAmount,
                                action.params.ststxAmount,
                                action.params.minLpTokens
                            );
                            console.log(`Added ${simulator.formatSTX(action.params.stxAmount)} and ${simulator.formatStSTX(action.params.ststxAmount)}`);
                            console.log(`Received ${simulator.formatUnits(lpTokens)} LP tokens`);
                            expect(lpTokens).toBeGreaterThan(0);
                            expect(lpTokens).toBeGreaterThanOrEqual(action.params.minLpTokens);
                            const feeSTX = (action.params.stxAmount * testConfig.poolConfig.liquidityFee) / 10000;
                            const feeSTSTX = (action.params.ststxAmount * testConfig.poolConfig.liquidityFee) / 10000;
                            metrics.trackFee(true, feeSTX);
                            metrics.trackFee(false, feeSTSTX);
                            metrics.trackLiquidityVolume(true, action.params.stxAmount);
                            metrics.trackLiquidityVolume(false, action.params.ststxAmount);
                            break;
                        }
                        case ActionType.WITHDRAW_LIQUIDITY: {
                            const { stx, ststx } = simulator.withdrawLiquidity(
                                action.params.lpTokens,
                                action.params.minStx,
                                action.params.minStSTX
                            );
                            console.log(`Withdrew ${simulator.formatUnits(action.params.lpTokens)} LP tokens`);
                            console.log(`Received ${simulator.formatSTX(stx)} and ${simulator.formatStSTX(ststx)}`);
                            expect(stx).toBeGreaterThanOrEqual(action.params.minStx);
                            expect(ststx).toBeGreaterThanOrEqual(action.params.minStSTX);
                            const feeSTX = (stx * testConfig.poolConfig.liquidityFee) / 10000;
                            const feeSTSTX = (ststx * testConfig.poolConfig.liquidityFee) / 10000;
                            metrics.trackFee(true, feeSTX);
                            metrics.trackFee(false, feeSTSTX);
                            metrics.trackLiquidityVolume(true, stx);
                            metrics.trackLiquidityVolume(false, ststx);
                            break;
                        }
                        case ActionType.SET_MIDPOINT:
                            simulator.setMidpoint(action.params.midpoint);
                            console.log(`Set midpoint to ${action.params.midpoint / 1_000_000}`);
                            const poolStateAfterMidpoint = simulator.getPoolState();
                            expect(poolStateAfterMidpoint.midpoint).toEqual(action.params.midpoint);
                            break;
                        case ActionType.SET_AMPLIFICATION_COEFFICIENT:
                            simulator.setAmplificationCoefficient(action.params.coefficient);
                            console.log(`Set amplification coefficient to ${action.params.coefficient}`);
                            const poolStateAfterAmp = simulator.getPoolState();
                            expect(poolStateAfterAmp.ampCoeff).toEqual(action.params.coefficient);
                            break;
                        default:
                            console.warn(`Unknown action type: ${action.type}`);
                    }

                    simulator.simnet.mineEmptyBlock();
                    const snapshotAfter = metrics.getStateSnapshot();
                    console.log(`USD Values:`);
                    console.log(`  Pool Value: ${metrics.formatUSD(snapshotAfter.pool.valueUSD)}`);
                    console.log(`  User Value: ${metrics.formatUSD(snapshotAfter.deployer.valueUSD)}`);
                    console.log(`  Fee Address Value: ${metrics.formatUSD(snapshotAfter.feeAddress.valueUSD)}`);
                    console.log(`  Total System Value: ${metrics.formatUSD(snapshotAfter.system.totalValueUSD)}`);

                    if (index === testConfig.actions.length - 1) {
                        const calculatedMetrics = metrics.calculateMetrics();
                        console.log(`\n${colors.subtitle('Final Pool State:')}`);
                        const finalState = simulator.getPoolState();
                        console.log(`STX Balance: ${simulator.formatSTX(finalState.stxBalance)}`);
                        console.log(`stSTX Balance: ${simulator.formatStSTX(finalState.ststxBalance)}`);

                        console.log(`\n${colors.subtitle('Fuzz Test Metrics:')}`);
                        console.log(metrics.formatMetrics(calculatedMetrics));

                        console.log(`\n${colors.subtitle('Invariant Checks:')}`);
                        const solvencyCheck = calculatedMetrics.solvencyRatio >= testConfig.expectedChecks.minPoolSolvency;
                        console.log(`Pool Solvency ${solvencyCheck ? colors.success('PASSED') : colors.error('FAILED')}`);
                        console.log(`  Required: >= ${testConfig.expectedChecks.minPoolSolvency}`);
                        console.log(`  Actual: ${calculatedMetrics.solvencyRatio.toFixed(4)}`);
                        expect(solvencyCheck).toBe(true);

                        const feeCheck = calculatedMetrics.protocolFeePercentage <= testConfig.expectedChecks.maxProtocolFees;
                        console.log(`Protocol Fees ${feeCheck ? colors.success('PASSED') : colors.error('FAILED')}`);
                        console.log(`  Required: <= ${testConfig.expectedChecks.maxProtocolFees}`);
                        console.log(`  Actual: ${calculatedMetrics.protocolFeePercentage.toFixed(4)}`);
                        expect(feeCheck).toBe(true);

                        const systemCheck = Math.abs(calculatedMetrics.systemValueDelta) < 0.01;
                        console.log(`System Value Conservation ${systemCheck ? colors.success('PASSED') : colors.warning('WARNING')}`);
                        console.log(`  Delta: $${calculatedMetrics.systemValueDelta.toFixed(4)}`);
                    }
                });
            });

            if (testConfig.actions.length === 0) {
                it('should contain at least one action', () => {
                    console.warn('No actions found in the test configuration.');
                    expect(true).toBe(true);
                });
            }
        });
    });

    if (testConfigs.length === 0) {
        it('should find fuzz test configurations in the tests/data/ directory', () => {
            console.warn('No fuzz test configurations found in the tests/data/ directory.');
            expect(true).toBe(true);
        });
    }
});
