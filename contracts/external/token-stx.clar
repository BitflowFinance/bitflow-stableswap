(impl-trait .sip-010-trait-ft-standard-v-1-1.sip-010-trait)

(define-fungible-token stx)

;; ---------------------------------------------------------
;; SIP-10 Functions
;; ---------------------------------------------------------

(define-read-only (get-total-supply)
    (ok (ft-get-supply stx))
)

(define-read-only (get-name)
    (ok "stx")
)

(define-read-only (get-symbol)
    (ok "stx")
)

(define-read-only (get-decimals)
    (ok u6)
)

(define-read-only (get-balance (account principal))
    (ok (ft-get-balance stx account))
)

(define-read-only (get-token-uri)
    (ok none)
)

(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
    (if (is-eq tx-sender sender)
        (begin
            (try! (ft-transfer? stx amount sender recipient))
            (print memo)
            (ok true)
        )
        (err u4)
    )
)

(define-public (mint (amount uint) (recipient principal))
    (ft-mint? stx amount recipient)
)

(define-public (burn (amount uint) (sender principal))
    (ft-burn? stx amount sender)
)
