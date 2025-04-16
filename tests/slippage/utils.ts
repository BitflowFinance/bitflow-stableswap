import { expect } from "vitest";
import { Cl, ClarityType, contractPrincipalCV, ResponseOkCV, UIntCV } from "@stacks/transactions";

const coreContractName = "stableswap-core-v-1-1";
const poolContractName = "stableswap-pool-stx-ststx-v-1-1";

const accounts = simnet.getAccounts();
const deployerAccount = accounts.get("deployer")!;

const poolContractPrincipal = contractPrincipalCV(deployerAccount, poolContractName);

export const getSip010Balance = (
  address: any,
  contractAddress: any,
  caller: any
) => {
  const result = simnet.callReadOnlyFn(
    contractAddress,
    "get-balance",
    [Cl.address(address)],
    caller,
  ).result as ResponseOkCV<UIntCV>;
  return result.value.value;
}

export const mintTokens = (token: string, amount: number | bigint, to: any) => {
  if (amount <= 0) return;
  const response = simnet.callPublicFn(token, "mint", [Cl.uint(Number(amount).toFixed(0)), Cl.principal(to)], to);
  expect(response.result).toBeOk(Cl.bool(true));
  return response;
};

export const mintTokensToContract = (token: string, amount: number | bigint, contract: any, to: any) => {
  if (amount <= 0) return;
  const response = simnet.callPublicFn(token, "mint", [Cl.uint(amount), contract], to)
  expect(response.result).toBeOk(Cl.bool(true))
};

export const setPublicPoolCreation = (status: boolean, deployer: any) => {
  const setPublicPoolCreationCall = simnet.callPublicFn(coreContractName, "set-public-pool-creation", [
    Cl.bool(status)
  ], deployer);
  expect(setPublicPoolCreationCall.result).toBeOk(Cl.bool(true));  
  return setPublicPoolCreationCall;
};

export const setAmplificationCoefficient = (coefficent: number | bigint, deployer: any) => {
  const setAmplificationCoefficientCall = simnet.callPublicFn(coreContractName, "set-amplification-coefficient", [
    poolContractPrincipal, // (pool-trait <stableswap-pool-trait>)
    Cl.uint(coefficent)    // (coefficient uint)
  ], deployer);
  expect(setAmplificationCoefficientCall.result).toBeOk(Cl.bool(true));  
  return setAmplificationCoefficientCall;
};

export const getDy = (
  tokenX: any,
  tokenY: any,
  xAmount: number | bigint,
  caller: any
) => {
  const getDyCall = simnet.callPublicFn(coreContractName, "get-dy", [
    poolContractPrincipal,                // (pool-trait <stableswap-pool-trait>)
    tokenX,                               // (x-token-trait <sip-010-trait>)
    tokenY,                               // (y-token-trait <sip-010-trait>)
    Cl.uint(Number(xAmount).toFixed(0)),  // (x-amount uint)
  ], caller);
  expect(getDyCall.result.type).toBe(ClarityType.ResponseOk);
  return getDyCall;
};

export const getDx = (
  tokenX: any,
  tokenY: any,
  yAmount: number | bigint,
  caller: any
) => {
  const getDxCall = simnet.callPublicFn(coreContractName, "get-dx", [
    poolContractPrincipal,                // (pool-trait <stableswap-pool-trait>)
    tokenX,                               // (x-token-trait <sip-010-trait>)
    tokenY,                               // (y-token-trait <sip-010-trait>)
    Cl.uint(Number(yAmount).toFixed(0)),  // (y-amount uint)
  ], caller);
  expect(getDxCall.result.type).toBe(ClarityType.ResponseOk);
  return getDxCall;
};

export const swapXForY = (
  tokenX: any, 
  tokenY: any,
  xAmount: number | bigint,
  minDy: number | bigint,
  caller: any
) => {
  const swapXForYCall = simnet.callPublicFn(coreContractName, "swap-x-for-y", [
    poolContractPrincipal, // (pool-trait <stableswap-pool-trait>)
    tokenX,                // (x-token-trait <sip-010-trait>)
    tokenY,                // (y-token-trait <sip-010-trait>)
    Cl.uint(xAmount),      // (x-amount uint)
    Cl.uint(minDy),        // (min-dy uint)
  ], caller);
  expect(swapXForYCall.result.type).toBe(ClarityType.ResponseOk);
  return swapXForYCall;
};

export const swapYForX = (
  tokenX: any, 
  tokenY: any,
  yAmount: number | bigint,
  minDx: number | bigint,
  caller: any
) => {
  const swapYForXCall = simnet.callPublicFn(coreContractName, "swap-y-for-x", [
    poolContractPrincipal, // (pool-trait <stableswap-pool-trait>)
    tokenX,                // (x-token-trait <sip-010-trait>)
    tokenY,                // (y-token-trait <sip-010-trait>)
    Cl.uint(yAmount),      // (y-amount uint)
    Cl.uint(minDx),        // (min-dx uint)
  ], caller);
  expect(swapYForXCall.result.type).toBe(ClarityType.ResponseOk);
  return swapYForXCall;
};

export const addLiquidity = (
  tokenX: any, 
  tokenY: any,
  xAmount: number | bigint,
  yAmount: number | bigint,
  minDlp: number | bigint,
  caller: any
) => {
  if (xAmount <= 0 && yAmount <= 0) return;
  const addLiquidityCall = simnet.callPublicFn(coreContractName, "add-liquidity", [
    poolContractPrincipal,                // (pool-trait <stableswap-pool-trait>)
    tokenX,                               // (x-token-trait <sip-010-trait>)
    tokenY,                               // (y-token-trait <sip-010-trait>)
    Cl.uint(Number(xAmount).toFixed(0)),  // (x-amount uint)
    Cl.uint(Number(yAmount).toFixed(0)),  // (y-amount uint)
    Cl.uint(minDlp),                      // (min-dlp uint)
  ], caller);
  expect(addLiquidityCall.result.type).toBe(ClarityType.ResponseOk);
  return addLiquidityCall;
};

export const withdrawProportionalLiquidity = (
  tokenX: any, 
  tokenY: any,
  amount: number | bigint,
  minXAmount: number | bigint,
  minYAmount: number | bigint,
  caller: any
) => {
  const withdrawLiquidityCall = simnet.callPublicFn(coreContractName, "withdraw-proportional-liquidity", [
    poolContractPrincipal, // (pool-trait <stableswap-pool-trait>)
    tokenX,                // (x-token-trait <sip-010-trait>)
    tokenY,                // (y-token-trait <sip-010-trait>)
    Cl.uint(amount),       // (amount uint)
    Cl.uint(minXAmount),   // (min-x-amount uint)
    Cl.uint(minYAmount),   // (min-y-amount uint)
  ], caller);
  expect(withdrawLiquidityCall.result.type).toBe(ClarityType.ResponseOk);
  return withdrawLiquidityCall;
};


export const createPool = (
  tokenX: any, 
  tokenY: any,
  xAmount: number | bigint,
  yAmount: number | bigint,
  burnAmount: number | bigint,
  midpointPrimaryNumerator: number | bigint,
  midpointPrimaryDenominator: number | bigint,
  midpointWithdrawNumerator: number | bigint,
  midpointWithdrawDenominator: number | bigint,
  xProtocolFee: number | bigint,
  xProviderFee: number | bigint,
  yProtocolFee: number | bigint,
  yProviderFee: number | bigint,
  liquidityFee: number | bigint,
  amplificationCoefficient: number | bigint,
  convergenceThreshold: number | bigint,
  imbalancedWithdraws: boolean,
  withdrawCooldown: number | bigint,
  freezeMidpointManager: boolean,
  feeAddress: any,
  uri: string,
  status: boolean,
  caller: any
) => {
  const createPoolCall = simnet.callPublicFn(coreContractName, "create-pool", [
    poolContractPrincipal,                // (pool-trait <stableswap-pool-trait>)
    tokenX,                               // (x-token-trait <sip-010-trait>)
    tokenY,                               // (y-token-trait <sip-010-trait>)
    Cl.uint(xAmount),                     // (x-amount uint)
    Cl.uint(yAmount),                     // (y-amount uint)
    Cl.uint(burnAmount),                  // (burn-amount uint)
    Cl.uint(midpointPrimaryNumerator),    // (midpoint-primary-numerator uint)
    Cl.uint(midpointPrimaryDenominator),  // (midpoint-primary-denominator uint)
    Cl.uint(midpointWithdrawNumerator),   // (midpoint-withdraw-numerator uint)
    Cl.uint(midpointWithdrawDenominator), // (midpoint-withdraw-denominator uint)
    Cl.uint(xProtocolFee),                // (x-protocol-fee uint)
    Cl.uint(xProviderFee),                // (x-provider-fee uint)
    Cl.uint(yProtocolFee),                // (y-protocol-fee uint)
    Cl.uint(yProviderFee),                // (y-provider-fee uint)
    Cl.uint(liquidityFee),                // (liquidity-fee uint)
    Cl.uint(amplificationCoefficient),    // (amplification-coefficient uint)
    Cl.uint(convergenceThreshold),        // (convergence-threshold uint)
    Cl.bool(imbalancedWithdraws),         // (imbalanced-withdraws bool)
    Cl.uint(withdrawCooldown),            // (withdraw-cooldown uint)
    Cl.bool(freezeMidpointManager),       // (freeze-midpoint-manager bool)
    Cl.standardPrincipal(feeAddress),     // (fee-address principal)  
    Cl.stringUtf8(uri),                   // (uri (string-utf8 256))
    Cl.bool(status),                      // (status bool)
  ], caller);
  expect(createPoolCall.result).toBeOk(Cl.bool(true));
  return createPoolCall;
};