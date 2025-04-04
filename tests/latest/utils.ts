import { expect } from "vitest";
import { Cl, ClarityType, contractPrincipalCV, ResponseOkCV, UIntCV } from "@stacks/transactions";

const accounts = simnet.getAccounts();

const core = "stableswap-core-v-1-1";
const pool = "stableswap-pool-stx-ststx-v-1-1";

const deployer = accounts.get("deployer")!;
const coreContract = contractPrincipalCV(deployer, core);
const poolContract = contractPrincipalCV(deployer, pool);

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
  const response = simnet.callPublicFn(token, "mint", [Cl.uint(amount), Cl.principal(to)], to);
  expect(response.result).toBeOk(Cl.bool(true));
  return response;
};

export const mintTokensToContract = (token: string, amount: number | bigint, contract: any, to: any) => {
  const response = simnet.callPublicFn(token, "mint", [Cl.uint(amount), contract], to)
  expect(response.result).toBeOk(Cl.bool(true))
};

export const getPool = (caller: any) => {
  const getPoolCall = simnet.callReadOnlyFn(pool, "get-pool", [], caller);
  return getPoolCall.result.value;
};

export const setPublicPoolCreation = (status: boolean, deployer: any) => {
  const setPublicPoolCreationCall = simnet.callPublicFn("stableswap-core-v-1-1", "set-public-pool-creation", [
    Cl.bool(status)
  ], deployer);
  expect(setPublicPoolCreationCall.result).toBeOk(Cl.bool(true));  
  return setPublicPoolCreationCall;
};

export const setMidpoint = (
  primaryNumerator: number | bigint,
  primaryDenominator: number | bigint,
  withdrawNumerator: number | bigint,
  withdrawDenominator: number | bigint,
  deployer: any
) => {
  const setMidpointCall = simnet.callPublicFn("stableswap-core-v-1-1", "set-midpoint", [
    Cl.principal(pool),
    Cl.uint(primaryNumerator),
    Cl.uint(primaryDenominator),
    Cl.uint(withdrawNumerator),
    Cl.uint(withdrawDenominator)
  ], deployer);
  expect(setMidpointCall.result).toBeOk(Cl.bool(true));  
  return setMidpointCall;
};

export const addLiquidity = (
  tokenX: any, 
  tokenY: any,
  xAmount: number | bigint,
  yAmount: number | bigint,
  minDlp: number | bigint,
  caller: any
) => {
  const addLiquidityCall = simnet.callPublicFn(core, "add-liquidity", [
    poolContract,          // (pool-trait <stableswap-pool-trait>)
    tokenX,                // (x-token-trait <sip-010-trait>)
    tokenY,                // (y-token-trait <sip-010-trait>)
    Cl.uint(xAmount),      // (x-amount uint)
    Cl.uint(yAmount),      // (y-amount uint)
    Cl.uint(minDlp),       // (min-dlp uint)
  ], caller);
  // console.log(addLiquidityCall);
  expect(addLiquidityCall.result.type).toBe(ClarityType.ResponseOk);
  return addLiquidityCall;
};

export const withdrawLiquidity = (
  tokenX: any, 
  tokenY: any,
  amount: number | bigint,
  minXAmount: number | bigint,
  minYAmount: number | bigint,
  caller: any
) => {
  const withdrawLiquidityCall = simnet.callPublicFn(core, "withdraw-liquidity", [
    poolContract,          // (pool-trait <stableswap-pool-trait>)
    tokenX,                // (x-token-trait <sip-010-trait>)
    tokenY,                // (y-token-trait <sip-010-trait>)
    Cl.uint(amount),       // (amount uint)
    Cl.uint(minXAmount),   // (min-x-amount uint)
    Cl.uint(minYAmount),   // (min-y-amount uint)
  ], caller);
  // console.log(withdrawLiquidityCall);
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
  feeAddress: any,
  uri: string,
  status: boolean,
  caller: any
) => {
  const createPoolCall = simnet.callPublicFn(core, "create-pool", [
    poolContract,                         // (pool-trait <stableswap-pool-trait>)
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
    Cl.standardPrincipal(feeAddress),     // (fee-address principal)  
    Cl.stringUtf8(uri),                   // (uri (string-utf8 256))
    Cl.bool(status),                      // (status bool)
  ], caller);
  expect(createPoolCall.result).toBeOk(Cl.bool(true));
  return createPoolCall;
};
