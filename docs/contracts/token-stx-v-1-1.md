## Token STX v1.1

This contract implements the SIP-010 fungible token standard for the STX token. It provides the basic functionality required for a fungible token in the Stacks ecosystem.

### Key Features

#### SIP-010 Compliance

- Implements all required SIP-010 trait functions
- Standard token operations (transfer, balance checks)
- Metadata functions (name, symbol, decimals)

### Core Functions

#### Token Information

- `get-name`
  - Returns the token name ("Stacks")
  - Returns: Response with token name

- `get-symbol`
  - Returns the token symbol ("STX")
  - Returns: Response with token symbol

- `get-decimals`
  - Returns the number of decimal places (6)
  - Returns: Response with decimals

#### Token Operations

- `transfer`
  - Transfers tokens between principals
  - Parameters:
    - `amount`: Amount to transfer
    - `sender`: Sender principal
    - `recipient`: Recipient principal
    - `memo`: Optional memo data
  - Returns: Response indicating success/failure

- `get-balance`
  - Returns the token balance of a principal
  - Parameters:
    - `owner`: Principal to check
  - Returns: Response with balance

- `get-total-supply`
  - Returns the total token supply
  - Returns: Response with total supply

#### URI Management

- `get-token-uri`
  - Returns the token URI
  - Returns: Response with token URI

- `set-token-uri`
  - Sets the token URI (admin only)
  - Parameters:
    - `uri`: New token URI
  - Returns: Response indicating success/failure

### Error Codes

- `ERR_NOT_AUTHORIZED`: Unauthorized operation
- `ERR_INVALID_AMOUNT`: Invalid transfer amount
- `ERR_INVALID_PRINCIPAL`: Invalid principal address
- `ERR_INVALID_TOKEN_URI`: Invalid token URI format

### Administrative Functions

- Contract owner management
- Token URI management
- Access control for administrative functions

### Usage

This contract serves as the STX token implementation in the Stableswap protocol, providing the basic token functionality needed for the STX-stSTX pool and related contracts.
