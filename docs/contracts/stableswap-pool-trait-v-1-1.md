## Stableswap Pool Trait v1.1

This contract defines the trait interface that all Stableswap pool implementations must follow. It provides the standard functions that any pool contract must implement to be compatible with the Stableswap protocol.

### Trait Functions

#### Pool Information

- `get-name`
  - Returns the name of the pool.
  - Returns: Response with pool name (string-ascii 32)

- `get-token-x`
  - Returns the principal of token X in the pool.
  - Returns: Response with token X principal

- `get-token-y`
  - Returns the principal of token Y in the pool.
  - Returns: Response with token Y principal

#### Pool State

- `get-balances`
  - Returns the current balances of both tokens in the pool.
  - Returns: Response with tuple containing x-balance and y-balance (uint)

- `get-total-supply`
  - Returns the total supply of liquidity provider (DLP) tokens.
  - Returns: Response with total supply (uint)

#### Pool Parameters

- `get-fees`
  - Returns the fee parameters for the pool.
  - Returns: Response with tuple containing:
    - `fee-rate`: The base fee rate
    - `admin-fee-rate`: The admin fee rate

#### Token Management

- `mint`
  - Mints new DLP tokens.
  - Parameters:
    - `amount`: Amount to mint (uint)
    - `recipient`: Recipient principal
  - Returns: Response indicating success or failure

- `burn`
  - Burns DLP tokens.
  - Parameters:
    - `amount`: Amount to burn (uint)
    - `sender`: Sender principal
  - Returns: Response indicating success or failure

### Usage

This trait is used by the core Stableswap contract to interact with specific pool implementations. Pool contracts must implement all these functions to be compatible with the Stableswap protocol.
