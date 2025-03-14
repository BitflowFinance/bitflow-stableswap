/// <reference types="vitest" />

import { defineConfig } from "vite";
import {
    vitestSetupFilePath,
    getClarinetVitestsArgv,
} from "@hirosystems/clarinet-sdk/vitest";

/*
  In this file, Vitest is configured so that it works seamlessly with Clarinet and the Simnet.

  The `vitest-environment-clarinet` will initialise the clarinet-sdk
  and make the `simnet` object available globally in the test files.

  `vitestSetupFilePath` points to a file in the `@hirosystems/clarinet-sdk` package that does two things:
    - run `before` hooks to initialize the simnet and `after` hooks to collect costs and coverage reports.
    - load custom vitest matchers to work with Clarity values (such as `expect(...).toBeUint()`)

  The `getClarinetVitestsArgv()` will parse options passed to the command `vitest run --`
    - vitest run -- --manifest ./Clarinet.toml  # pass a custom path
    - vitest run -- --coverage --costs          # collect coverage and cost reports
*/

export default defineConfig({
    test: {
        pool: "forks",
        poolOptions: {
            threads: { singleThread: true },
            forks: { singleFork: true },
        },
        reporters: ['default', 'html'],
        coverage: {
            enabled: true,
            provider: 'custom',
            customProviderModule: './clarity-coverage-provider',
            reportsDirectory: './html/coverage',
            include: [
                // Make sure Clarity files are included
                'contracts/**/*.clar',
            ],
            clean: false,
            // Add source map support for Clarity files
            extension: ['.clar'],
            reportOnFailure: true,  // Add this to ensure reports are generated even on test failures
        },
        environment: "clarinet",
        setupFiles: [
            vitestSetupFilePath,
            // custom setup files can be added here
        ],
        environmentOptions: {
            clarinet: {
                ...getClarinetVitestsArgv(),
                // Force coverage to be enabled
                coverage: true,
                cov: true,
                costs: true,
                cost: true,
                // Override the coverage settings
                costsFilename: './html/coverage/costs-reports.json',
                coverageFilename: './html/coverage/lcov.info',
                initBeforeEach: false,
            },
        },
    },
});