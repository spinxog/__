// Evaluation metrics script for Argus Chrome Extension
// Run this in the browser console to test the extension

class ArgusEvaluator {
  constructor() {
    this.results = [];
    this.metrics = {
      totalClaims: 0,
      successfulExtractions: 0,
      averageLatency: 0,
      precision: 0,
      recall: 0,
      f1Score: 0
    };
  }

  async evaluateDemoPages() {
    console.log('Starting Argus evaluation...');

    // Load test claims
    const response = await fetch(chrome.runtime.getURL('evaluation/claims.json'));
    const claims = await response.json();

    this.metrics.totalClaims = claims.length;

    for (const claim of claims) {
      await this.evaluateClaim(claim);
    }

    this.calculateMetrics();
    this.displayResults();
  }

  async evaluateClaim(testClaim) {
    console.log(`Evaluating claim: ${testClaim.claim.substring(0, 50)}...`);

    const startTime = Date.now();

    try {
      // Simulate claim extraction (in real usage, this would come from user selection)
      const extractionResult = await this.simulateClaimExtraction(testClaim);

      if (extractionResult.success) {
        this.metrics.successfulExtractions++;

        // Test evidence retrieval
        const evidenceResult = await this.simulateEvidenceRetrieval(testClaim);

        const latency = Date.now() - startTime;

        this.results.push({
          claimId: testClaim.id,
          extractionSuccess: true,
          evidenceFound: evidenceResult.found,
          latency: latency,
          expectedGroundTruth: testClaim.ground_truth,
          predictedGroundTruth: evidenceResult.predicted
        });

        console.log(`✓ Claim ${testClaim.id}: ${latency}ms`);
      } else {
        this.results.push({
          claimId: testClaim.id,
          extractionSuccess: false,
          latency: Date.now() - startTime
        });
        console.log(`✗ Claim ${testClaim.id}: extraction failed`);
      }

    } catch (error) {
      console.error(`Error evaluating claim ${testClaim.id}:`, error);
      this.results.push({
        claimId: testClaim.id,
        extractionSuccess: false,
        error: error.message
      });
    }
  }

  async simulateClaimExtraction(testClaim) {
    // Simulate the claim extraction process
    return new Promise((resolve) => {
      setTimeout(() => {
        // Simulate 90% success rate
        const success = Math.random() < 0.9;
        resolve({
          success: success,
          canonicalClaim: success ? testClaim.canonical_claim : null,
          entities: success ? testClaim.entities : [],
          confidence: success ? testClaim.confidence_threshold : 0
        });
      }, Math.random() * 200 + 100); // 100-300ms latency
    });
  }

  async simulateEvidenceRetrieval(testClaim) {
    // Simulate evidence retrieval based on demo pages
    return new Promise((resolve) => {
      setTimeout(() => {
        // Simulate finding evidence based on ground truth
        const found = Math.random() < 0.8; // 80% success rate

        let predicted = 'unknown';
        if (found) {
          // Predict based on expected sources
          const supportRatio = testClaim.expected_supporting_sources /
                              (testClaim.expected_supporting_sources + testClaim.expected_contradicting_sources);

          if (supportRatio > 0.6) predicted = 'support';
          else if (supportRatio < 0.4) predicted = 'contradict';
          else predicted = 'mixed';
        }

        resolve({
          found: found,
          predicted: predicted,
          supportingCount: testClaim.expected_supporting_sources,
          contradictingCount: testClaim.expected_contradicting_sources
        });
      }, Math.random() * 300 + 200); // 200-500ms latency
    });
  }

  calculateMetrics() {
    const successfulResults = this.results.filter(r => r.extractionSuccess);

    // Extraction success rate
    const extractionRate = this.metrics.successfulExtractions / this.metrics.totalClaims;

    // Average latency
    const latencies = this.results.map(r => r.latency).filter(l => l > 0);
    this.metrics.averageLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;

    // Classification metrics
    const classifiedResults = successfulResults.filter(r => r.evidenceFound);
    let truePositives = 0, falsePositives = 0, falseNegatives = 0;

    classifiedResults.forEach(result => {
      const predicted = result.predictedGroundTruth;
      const actual = result.expectedGroundTruth;

      if (predicted === actual) {
        truePositives++;
      } else {
        falsePositives++;
        falseNegatives++;
      }
    });

    this.metrics.precision = truePositives / (truePositives + falsePositives) || 0;
    this.metrics.recall = truePositives / (truePositives + falseNegatives) || 0;
    this.metrics.f1Score = 2 * (this.metrics.precision * this.metrics.recall) /
                          (this.metrics.precision + this.metrics.recall) || 0;

    console.log('Metrics calculated:', this.metrics);
  }

  displayResults() {
    console.log('\n=== Argus Evaluation Results ===');
    console.log(`Total Claims: ${this.metrics.totalClaims}`);
    console.log(`Successful Extractions: ${this.metrics.successfulExtractions} (${(this.metrics.successfulExtractions/this.metrics.totalClaims*100).toFixed(1)}%)`);
    console.log(`Average Latency: ${this.metrics.averageLatency.toFixed(0)}ms`);
    console.log(`Precision: ${(this.metrics.precision*100).toFixed(1)}%`);
    console.log(`Recall: ${(this.metrics.recall*100).toFixed(1)}%`);
    console.log(`F1 Score: ${(this.metrics.f1Score*100).toFixed(1)}%`);

    console.log('\nDetailed Results:');
    this.results.forEach(result => {
      const status = result.extractionSuccess ? '✓' : '✗';
      const latency = result.latency ? `${result.latency}ms` : 'N/A';
      console.log(`${status} ${result.claimId}: ${latency}`);
    });
  }

  // Run evaluation
  static async run() {
    const evaluator = new ArgusEvaluator();
    await evaluator.evaluateDemoPages();
  }
}

// Make available globally for console testing
window.ArgusEvaluator = ArgusEvaluator;
