import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'child_process';
import util from 'util';
import type { CoverageProvider, CoverageProviderModule, Vitest, ResolvedCoverageOptions } from 'vitest';

const execPromise = util.promisify(exec);

class ClarityCoverageProvider implements CoverageProvider {
    name = 'clarity';
    ctx!: Vitest;

    private coverageData: any = null;
    private lcovPath: string;
    private coverageDir: string;

    constructor() {
        this.lcovPath = path.resolve('./coverage/lcov.info');
        this.coverageDir = path.resolve('./coverage');
        // console.log('[ClarityCoverageProvider] Initialized with paths:', {
        //     lcov: this.lcovPath,
        //     coverage: this.coverageDir
        // });

        // Ensure coverage directory exists
        if (!fs.existsSync(this.coverageDir)) {
            // console.log('[ClarityCoverageProvider] Creating coverage directory:', this.coverageDir);
            fs.mkdirSync(this.coverageDir, { recursive: true });
        }

        // Create subdirectories for different report types
        const clarityDir = path.join(this.coverageDir, 'clarity');
        const vitestDir = path.join(this.coverageDir, 'vitest');

        [clarityDir, vitestDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                // console.log('[ClarityCoverageProvider] Creating directory:', dir);
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    async initialize(ctx: Vitest) {
        // console.log('[ClarityCoverageProvider] Initializing with Vitest context');
        this.ctx = ctx;
    }

    resolveOptions(): ResolvedCoverageOptions {
        // console.log('[ClarityCoverageProvider] Resolving coverage options');
        return {
            enabled: true,
            clean: false,
            cleanOnRerun: false,
            reportOnFailure: true,
            extension: ['.clar'],
            allowExternal: true,
            processingConcurrency: 1,
            reporter: [['html', { subdir: 'clarity' }]],
            exclude: ['node_modules/**', 'dist/**', 'coverage/**'],
            reportsDirectory: this.coverageDir,
            provider: 'custom' as const,
            customProviderModule: 'clarity-coverage-provider'
        };
    }

    async clean() {
        // console.log('[ClarityCoverageProvider] Cleaning up coverage data');
        this.coverageData = null;
    }

    async onAfterSuiteRun() {
        // console.log('[ClarityCoverageProvider] After suite run hook called');
        await this.stopCoverage();
    }

    async onFileCollected() {
        // console.log('[ClarityCoverageProvider] File collected hook called');
    }

    async startCoverage() {
        // console.log('[ClarityCoverageProvider] Starting coverage collection');
        this.coverageData = null;
    }

    private async generateHtmlReport() {
        try {
            // console.log('[ClarityCoverageProvider] Generating HTML report using genhtml');
            const htmlDir = path.join(this.coverageDir, 'clarity');
            // Remove existing files to prevent stale data
            if (fs.existsSync(htmlDir)) {
                // console.log('[ClarityCoverageProvider] Cleaning existing clarity report directory');
                fs.rmSync(htmlDir, { recursive: true, force: true });
                fs.mkdirSync(htmlDir, { recursive: true });
            }
            const { stdout, stderr } = await execPromise(`genhtml "${this.lcovPath}" -o "${htmlDir}"`);
            // console.log('[ClarityCoverageProvider] genhtml stdout:', stdout);
            if (stderr) {
                console.warn('[ClarityCoverageProvider] genhtml stderr:', stderr);
            }
        } catch (error) {
            // console.error('[ClarityCoverageProvider] Error generating HTML report:', error);
        }
    }

    async stopCoverage() {
        // console.log('[ClarityCoverageProvider] Stopping coverage collection');
    }

    async takeCoverage() {
        // console.log('[ClarityCoverageProvider] Taking coverage snapshot');
        return this.coverageData;
    }

    async generateCoverage() {
        // console.log('[ClarityCoverageProvider] Generating coverage report');
        // console.log('[ClarityCoverageProvider] Coverage data:', this.coverageData);
        return this.coverageData;
    }

    async reportCoverage() {
        // console.log('[ClarityCoverageProvider] Reporting coverage data');
        if (fs.existsSync(this.lcovPath)) {
            // console.log('[ClarityCoverageProvider] Reading LCOV file');
            const lcovContent = fs.readFileSync(this.lcovPath, 'utf-8');
            this.coverageData = this.parseLcov(lcovContent);
            await this.generateHtmlReport();
        } else {
            // console.warn('[ClarityCoverageProvider] No LCOV file found at:', this.lcovPath);
            // Wait a bit and try again, as Clarinet might be writing the file
            await new Promise(resolve => setTimeout(resolve, 1000));
            if (fs.existsSync(this.lcovPath)) {
                // console.log('[ClarityCoverageProvider] Found LCOV file after waiting');
                const lcovContent = fs.readFileSync(this.lcovPath, 'utf-8');
                this.coverageData = this.parseLcov(lcovContent);
                await this.generateHtmlReport();
            }
        }
        return this.coverageData;
    }

    private parseLcov(lcovContent: string) {
        // console.log('[ClarityCoverageProvider] Parsing LCOV content', lcovContent);
        const files: Record<string, any> = {};
        let currentFile: any = null;
        let lineCount = 0;

        lcovContent.split('\n').forEach(line => {
            lineCount++;
            const [type, data] = line.split(':');

            switch (type) {
                case 'SF': // Source file
                    // Create a Vitest-compatible coverage object
                    currentFile = {
                        path: data,
                        lines: { found: 0, hit: 0, details: [] },
                        functions: { found: 0, hit: 0, details: [] },
                        branches: { found: 0, hit: 0, details: [] },
                        statements: { found: 0, hit: 0, details: [] },
                        // Add these fields required by Vitest
                        s: {}, // Statement coverage
                        f: {}, // Function coverage
                        b: {}, // Branch coverage
                        statementMap: {},
                        fnMap: {},
                        branchMap: {},
                        // Add source content if available
                        text: fs.existsSync(data) ? fs.readFileSync(data, 'utf-8') : ''
                    };
                    files[data] = currentFile;
                    break;

                case 'DA': // Line coverage
                    if (currentFile) {
                        const [lineNumber, hits] = data.split(',').map(Number);
                        // Add to lines details
                        currentFile.lines.details.push({
                            line: lineNumber,
                            hit: hits
                        });
                        // Add to statement coverage (Vitest format)
                        currentFile.s[lineNumber] = hits;
                        currentFile.statementMap[lineNumber] = {
                            start: { line: lineNumber, column: 0 },
                            end: { line: lineNumber, column: 999 }
                        };
                        // Update counters
                        currentFile.lines.found++;
                        if (hits > 0) currentFile.lines.hit++;
                    }
                    break;

                case 'FN': // Function names
                    if (currentFile) {
                        const [line, name] = data.split(',');
                        const lineNumber = parseInt(line, 10);
                        const fnId = currentFile.functions.found;
                        // Add to function map (Vitest format)
                        currentFile.fnMap[fnId] = {
                            name,
                            decl: {
                                start: { line: lineNumber, column: 0 },
                                end: { line: lineNumber, column: 999 }
                            },
                            loc: {
                                start: { line: lineNumber, column: 0 },
                                end: { line: lineNumber, column: 999 }
                            }
                        };
                        currentFile.f[fnId] = 0; // Initialize hit count
                        currentFile.functions.found++;
                    }
                    break;

                case 'FNDA': // Function data
                    if (currentFile) {
                        const [hits, name] = data.split(',');
                        // Find function ID by name
                        const fnId = Object.keys(currentFile.fnMap).find(
                            id => currentFile.fnMap[id].name === name
                        );
                        if (fnId !== undefined) {
                            currentFile.f[fnId] = parseInt(hits, 10);
                            if (parseInt(hits, 10) > 0) currentFile.functions.hit++;
                        }
                    }
                    break;
            }
        });

        // console.log('[ClarityCoverageProvider] LCOV parsing complete:', {
        //     totalLines: lineCount,
        //     fileCount: Object.keys(files).length,
        //     files: Object.keys(files)
        // });

        return {
            result: {
                files
            }
        };
    }
}

const ClarityCoverageProviderModule: CoverageProviderModule = {
    getProvider: () => new ClarityCoverageProvider()
};

export default ClarityCoverageProviderModule;

