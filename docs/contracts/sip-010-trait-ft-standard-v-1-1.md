## SIP-010 Trait FT Standard v1.1

This contract defines the standard SIP-010 trait for fungible tokens. It outlines the functions that a fungible token contract should implement to be compliant with the SIP-010 standard.

### Trait Definition

The contract defines the following functions:

- `transfer`
  - Transfers tokens from one principal to another.
  - Input parameters:
    - `amount`: The amount of tokens to transfer (uint).
    - `sender`: The principal sending the tokens.
    - `recipient`: The principal receiving the tokens.
    - `memo`: An optional memo (buff 34) to include with the transaction.
  - Returns: A response indicating success (bool) or an error (uint).

- `get-name`
  - Returns the name of the token.
  - Returns: A response containing the token name (string-ascii 32) or an error (uint).

- `get-symbol`
  - Returns the symbol of the token.
  - Returns: A response containing the token symbol (string-ascii 32) or an error (uint).

- `get-decimals`
  - Returns the number of decimals used by the token.
  - Returns: A response containing the number of decimals (uint) or an error (uint).

- `get-balance`
  - Returns the balance of a given principal.
  - Input parameters:
    - `principal`: The principal whose balance is being queried.
  - Returns: A response containing the balance (uint) or an error (uint).

- `get-total-supply`
  - Returns the total supply of the token.
  - Returns: A response containing the total supply (uint) or an error (uint).

- `get-token-uri`
  - Returns the token URI, if any.
  - Returns: A response containing the token URI (optional (string-utf8 256)) or an error (uint).
