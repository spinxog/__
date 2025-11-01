// Popup script for Argus Chrome Extension

class ArgusPopup {
  constructor() {
    this.currentState = 'initial';
    this.claimData = null;
    this.verificationResults = null;
    this.rebuttalContent = null;
    this.settings = {
      localOnly: true,
      encryptStorage: false,
      autoIndex: true
    };
    this.snakeGame = null;

    this.init();
  }

  init() {
    this.bindElements();
    this.checkForPendingSelection();

    console.log('Argus popup initialized');
  }

  bindElements() {
    // State containers
    this.states = {
      initial: document.getElementById('initial-state'),
      loading: document.getElementById('loading-state'),
      claim: document.getElementById('claim-state'),
      results: document.getElementById('results-state'),
      rebuttal: document.getElementById('rebuttal-state'),
      settings: document.getElementById('settings-state')
    };

    // Buttons
    this.verifyBtn = document.getElementById('verify-btn');
    this.settingsBtn = document.getElementById('settings-btn');
    this.exportPdfBtn = document.getElementById('export-pdf-btn');
    this.exportMdBtn = document.getElementById('export-md-btn');
    this.generateRebuttalBtn = document.getElementById('generate-rebuttal-btn');
    this.copyRebuttalBtn = document.getElementById('copy-rebuttal-btn');
    this.backToResultsBtn = document.getElementById('back-to-results-btn');
    this.saveSettingsBtn = document.getElementById('save-settings-btn');
    this.backBtn = document.getElementById('back-btn');
    this.demoLink = document.getElementById('demo-link');

    // Content elements
    this.claimText = document.getElementById('claim-text');
    this.claimMeta = document.getElementById('claim-meta');
    this.confidenceScore = document.getElementById('confidence-score');
    this.explanation = document.getElementById('explanation');
    this.supportingEvidence = document.getElementById('supporting-evidence');
    this.contradictingEvidence = document.getElementById('contradicting-evidence');
    this.rebuttalContent = document.getElementById('rebuttal-content');
    this.statusText = document.getElementById('status-text');
    this.latencyChip = document.getElementById('latency-chip');
    this.latencyDisplay = document.getElementById('latency-display');

    // Settings toggles
    this.localOnlyToggle = document.getElementById('local-only-toggle');
    this.encryptStorageToggle = document.getElementById('encrypt-storage-toggle');
    this.autoIndexToggle = document.getElementById('auto-index-toggle');

    // Bind events
    this.bindEvents();
  }

  bindEvents() {
    this.verifyBtn?.addEventListener('click', () => this.verifyClaim());
    this.settingsBtn?.addEventListener('click', () => this.showSettings());
    this.exportPdfBtn?.addEventListener('click', () => this.exportPDF());
    this.exportMdBtn?.addEventListener('click', () => this.exportMarkdown());
    this.generateRebuttalBtn?.addEventListener('click', () => this.generateRebuttal());
    this.copyRebuttalBtn?.addEventListener('click', () => this.copyRebuttal());
    this.backToResultsBtn?.addEventListener('click', () => this.showResults());
    this.saveSettingsBtn?.addEventListener('click', () => this.saveSettings());
    this.backBtn?.addEventListener('click', () => this.backFromSettings());
    this.demoLink?.addEventListener('click', (e) => {
      e.preventDefault();
      this.openDemoPages();
    });
  }

  async checkForPendingSelection() {
    try {
      // First check for pending selection from context menu
      const result = await chrome.storage.local.get('pendingSelection');
      if (result.pendingSelection) {
        const selection = result.pendingSelection;
        // Check if selection is recent (within last 30 seconds)
        if (Date.now() - selection.timestamp < 30000) {
          console.log('Found pending selection from context menu:', selection.text.substring(0, 50) + '...');

          // Clear the pending selection
          await chrome.storage.local.remove('pendingSelection');

          // Create claim data from the selection
          this.claimData = {
            selection: selection.text,
            context: '',
            title: 'Context Menu Selection',
            url: 'context-menu'
          };
          this.showClaim();
          return;
        } else {
          // Clear old pending selection
          await chrome.storage.local.remove('pendingSelection');
        }
      }

      // If no pending selection, check for regular selection
      this.checkForSelection();
    } catch (error) {
      console.error('Failed to check pending selection:', error);
      if (this.checkForSelection) this.checkForSelection();
    }
  }

  async checkForSelection() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        console.log('No active tab found');
        this.showInitial();
        return;
      }

      console.log('Checking for selection on tab:', tab.id, tab.url);

      // Check if content script is ready by sending a ping first
      try {
        await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
      } catch (pingError) {
        console.warn('Content script not ready, waiting...');
        // Wait a bit for content script to load
        setTimeout(() => this.checkForSelection(), 500);
        return;
      }

      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getSelectionData' }).catch(error => {
        console.warn('Content script communication error:', error);
        return { success: false, data: null };
      });

      console.log('Selection response:', response);

      if (response && typeof response === 'object' && response.success && response.data) {
        console.log('Found selection data:', response.data.selection.substring(0, 50) + '...');
        this.claimData = response.data;
        this.showClaim();
      } else {
        console.log('No valid selection found');
        this.showInitial();
      }
    } catch (error) {
      console.error('Failed to check selection:', error);
      if (this.showInitial) this.showInitial();
    }
  }

  showState(stateName) {
    // Hide all states
    Object.values(this.states).forEach(state => {
      state.classList.remove('active', 'fade-in');
    });

    // Show target state
    if (this.states[stateName]) {
      this.states[stateName].classList.add('active', 'fade-in');
      this.currentState = stateName;

      // Initialize snake game when showing loading state
      if (stateName === 'loading') {
        this.initSnakeGame();
      } else if (this.snakeGame) {
        // Stop snake game when leaving loading state
        this.snakeGame.stop();
        this.snakeGame = null;
      }
    }
  }

  showInitial() {
    this.showState('initial');
    if (this.updateStatus) this.updateStatus('Ready');
    if (this.updateLatencyChip) this.updateLatencyChip(0);
  }

  showClaim() {
    if (!this.claimData) return;

    this.claimText.textContent = `"${this.claimData.selection}"`;
    this.claimMeta.textContent = `${this.claimData.title} • ${new URL(this.claimData.url).hostname}`;

    this.showState('claim');
    this.updateStatus('Claim detected');
  }

  async verifyClaim() {
    if (!this.claimData) return;

    this.showState('loading');
    this.updateStatus('Extracting claim...');
    const startTime = Date.now();

    try {
      // Step 1: Extract canonical claim
      this.updateStatus('Analyzing claim...');
      const claimResponse = await chrome.runtime.sendMessage({
        action: 'extractClaim',
        data: {
          selection: this.claimData.selection,
          context: this.claimData.context || '',
          title: this.claimData.title || 'Unknown',
          url: this.claimData.url || 'Unknown'
        }
      });

      if (!claimResponse.success) {
        throw new Error('Claim extraction failed');
      }

      const canonicalClaim = claimResponse.data;
      if (canonicalClaim.error) {
        throw new Error('Claim extraction failed - please try rephrasing');
      }

      // Step 2: Generate embedding and find evidence
      this.updateStatus('Searching evidence...');
      const evidenceResponse = await chrome.runtime.sendMessage({
        action: 'findEvidence',
        claim: canonicalClaim.canonicalized_claim
      });

      if (!evidenceResponse.success) {
        throw new Error('Evidence search failed');
      }

      // Step 3: Generate explanation (skeptical scorer)
      this.updateStatus('Analyzing credibility...');
      const explanationResponse = await chrome.runtime.sendMessage({
        action: 'generateExplanation',
        claim: canonicalClaim.canonicalized_claim,
        evidence: [...evidenceResponse.data.supporting, ...evidenceResponse.data.contradicting]
      });

      if (!explanationResponse.success) {
        throw new Error('Explanation generation failed');
      }

      // Calculate confidence score from skeptical scorer
      const explanation = explanationResponse.data;
      const confidenceScore = explanation.net_support_score / 100; // Convert to 0-1

      this.verificationResults = {
        claim: canonicalClaim,
        supporting: evidenceResponse.data.supporting,
        contradicting: evidenceResponse.data.contradicting,
        explanation: explanation,
        confidenceScore: confidenceScore
      };

      this.displayResults();
      const latency = Date.now() - startTime;
      this.updateLatency(latency);
      this.updateLatencyChip(latency);

    } catch (error) {
      console.error('Verification failed:', error);
      this.showError('Verification failed: ' + error.message);
    }
  }

  displayResults() {
    if (!this.verificationResults) return;

    const { claim, supporting, contradicting, explanation, confidenceScore } = this.verificationResults;

    // Display confidence score
    const scorePercent = Math.round(confidenceScore * 100);
    this.confidenceScore.textContent = `${scorePercent}%`;
    this.confidenceScore.className = 'score ' + this.getScoreClass(explanation.bucket);

    // Display claim analysis
    this.claimText.textContent = `"${claim.claim}"`;
    this.claimMeta.innerHTML = `
      <strong>Canonical:</strong> ${claim.canonicalized_claim}<br>
      <strong>Entities:</strong> ${claim.entities.join(', ') || 'None'}<br>
      <strong>Numbers:</strong> ${claim.numbers.join(', ') || 'None'}<br>
      <strong>Confidence:</strong> ${(claim.confidence * 100).toFixed(1)}%
    `;

    // Display explanation (skeptical analysis)
    const explanationHtml = explanation.reasoning_bullets.map(point => `<li>${point}</li>`).join('');
    this.explanation.innerHTML = `
      <div class="credibility-assessment">
        <strong>Assessment:</strong> ${explanation.bucket} (${explanation.net_support_score}%)
      </div>
      <ul>${explanationHtml}</ul>
      <div class="assessment-confidence">
        Assessment confidence: ${(explanation.confidence_in_assessment * 100).toFixed(1)}%
      </div>
    `;

    // Display evidence
    this.displayEvidence(supporting, this.supportingEvidence, 'supporting');
    this.displayEvidence(contradicting, this.contradictingEvidence, 'contradicting');

    this.showState('results');
    this.updateStatus('Verification complete');
    this.updateLatencyChip(latency);
  }

  getScoreClass(bucket) {
    switch (bucket) {
      case 'Likely True': return 'high';
      case 'Suspicious': return 'medium';
      case 'Likely False': return 'low';
      default: return 'unknown';
    }
  }

  displayEvidence(evidence, container, type) {
    container.innerHTML = '';

    if (evidence.length === 0) {
      container.innerHTML = '<div class="no-evidence">No evidence found</div>';
      return;
    }

    evidence.forEach(item => {
      const card = document.createElement('div');
      card.className = `evidence-card ${type}`;
      card.onclick = () => this.highlightEvidence(item);

      const badge = type === 'supporting' ? '✓ Support' : '✗ Contradict';

      card.innerHTML = `
        <div class="evidence-header">
          <span class="evidence-badge ${type}">${badge}</span>
          <span class="confidence">${(item.confidence * 100).toFixed(0)}%</span>
        </div>
        <div class="evidence-title">
          ${item.metadata?.title || 'Unknown Source'}
        </div>
        <div class="evidence-snippet">${item.metadata?.text?.substring(0, 150) || 'No preview available'}...</div>
        <div class="evidence-meta">
          <span>${item.metadata?.url ? new URL(item.metadata.url).hostname : ''}</span>
          <span>Similarity: ${item.similarity ? Math.round(item.similarity * 100) + '%' : 'N/A'}</span>
        </div>
        <div class="evidence-reason">${item.reason}</div>
      `;

      container.appendChild(card);
    });
  }

  async highlightEvidence(item) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;

      await chrome.tabs.sendMessage(tab.id, {
        action: 'highlight',
        selector: item.metadata?.selector || '',
        snippet: item.metadata?.text || ''
      });
    } catch (error) {
      console.error('Highlight failed:', error);
    }
  }

  async generateRebuttal() {
    if (!this.verificationResults) return;

    this.showState('loading');
    this.updateStatus('Generating rebuttal...');

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'generateRebuttal',
        claim: this.verificationResults.claim.canonicalized_claim,
        evidence: [...this.verificationResults.supporting, ...this.verificationResults.contradicting],
        score: this.verificationResults.confidenceScore
      });

      if (response.success) {
        const rebuttalData = response.data;
        this.rebuttalContent = rebuttalData.concise_rebuttal;
        document.getElementById('rebuttal-content').innerHTML = `
          <div class="rebuttal-header">
            <strong>Concise Rebuttal:</strong> ${this.rebuttalContent}
          </div>
          <div class="rebuttal-details">
            <strong>Tone:</strong> ${rebuttalData.tone}<br>
            <strong>Tweet Thread:</strong>
            <ol>
              ${rebuttalData.tweet_thread.map(tweet => `<li>${tweet}</li>`).join('')}
            </ol>
            <strong>Key Evidence Used:</strong> ${rebuttalData.key_evidence_used.join(', ')}
          </div>
        `;
        this.showState('rebuttal');
        this.updateStatus('Rebuttal generated');
    this.updateLatencyChip(0);
      } else {
        throw new Error('Rebuttal generation failed');
      }
    } catch (error) {
      console.error('Rebuttal generation failed:', error);
      this.showError('Failed to generate rebuttal');
    }
  }

  async copyRebuttal() {
    if (!this.rebuttalContent) return;

    try {
      await navigator.clipboard.writeText(this.rebuttalContent);
      this.updateStatus('Rebuttal copied to clipboard');
      setTimeout(() => this.updateStatus('Ready'), 2000);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  }

  initSnakeGame() {
    const canvas = document.getElementById('snake-canvas');
    if (!canvas) return;

    this.snakeGame = new SnakeGame(canvas);
    this.snakeGame.start();
  }
}

// Snake Game Class
class SnakeGame {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.gridSize = 10;
    this.tileCount = canvas.width / this.gridSize;

    // Snake initial position and velocity
    this.snake = [
      {x: 10, y: 10}
    ];
    this.velocity = {x: 0, y: 0};

    // Apple position
    this.apple = {x: 15, y: 15};

    // Game state
    this.running = false;
    this.gameLoop = null;

    // Bind controls
    this.bindControls();
  }

  bindControls() {
    // Auto-play: snake moves in a rectangular pattern
    this.directions = [
      {x: 1, y: 0},   // right
      {x: 0, y: 1},   // down
      {x: -1, y: 0},  // left
      {x: 0, y: -1}   // up
    ];
    this.directionIndex = 0;
    this.stepsInDirection = 0;
    this.maxSteps = 8; // Change direction every 8 steps
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.gameLoop = setInterval(() => this.update(), 150);
  }

  stop() {
    this.running = false;
    if (this.gameLoop) {
      clearInterval(this.gameLoop);
      this.gameLoop = null;
    }
  }

  update() {
    if (!this.running) return;

    // Auto-direction change for rectangular pattern
    this.stepsInDirection++;
    if (this.stepsInDirection >= this.maxSteps) {
      this.directionIndex = (this.directionIndex + 1) % this.directions.length;
      this.stepsInDirection = 0;
    }

    this.velocity = this.directions[this.directionIndex];

    // Move snake
    const head = {x: this.snake[0].x + this.velocity.x, y: this.snake[0].y + this.velocity.y};

    // Check wall collision - wrap around
    if (head.x < 0) head.x = this.tileCount - 1;
    if (head.x >= this.tileCount) head.x = 0;
    if (head.y < 0) head.y = this.tileCount - 1;
    if (head.y >= this.tileCount) head.y = 0;

    // Check self collision
    for (let segment of this.snake) {
      if (head.x === segment.x && head.y === segment.y) {
        this.reset();
        return;
      }
    }

    this.snake.unshift(head);

    // Check apple collision
    if (head.x === this.apple.x && head.y === this.apple.y) {
      // Grow snake and spawn new apple
      this.spawnApple();
    } else {
      // Remove tail
      this.snake.pop();
    }

    this.draw();
  }

  spawnApple() {
    let newApple;
    do {
      newApple = {
        x: Math.floor(Math.random() * this.tileCount),
        y: Math.floor(Math.random() * this.tileCount)
      };
    } while (this.snake.some(segment => segment.x === newApple.x && segment.y === newApple.y));

    this.apple = newApple;
  }

  reset() {
    this.snake = [{x: 10, y: 10}];
    this.velocity = {x: 0, y: 0};
    this.directionIndex = 0;
    this.stepsInDirection = 0;
    this.spawnApple();
  }

  draw() {
    // Clear canvas
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw snake
    this.ctx.fillStyle = '#0f0';
    for (let segment of this.snake) {
      this.ctx.fillRect(
        segment.x * this.gridSize,
        segment.y * this.gridSize,
        this.gridSize - 1,
        this.gridSize - 1
      );
    }

    // Draw apple
    this.ctx.fillStyle = '#f00';
    this.ctx.fillRect(
      this.apple.x * this.gridSize,
      this.apple.y * this.gridSize,
      this.gridSize - 1,
      this.gridSize - 1
    );
  }

  async exportPDF() {
    // Simple PDF export using browser print
    const content = this.generateExportContent('pdf');
    const printWindow = window.open('', '_blank');
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.print();
  }

  exportMarkdown() {
    const content = this.generateExportContent('markdown');
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'argus-verification.md';
    a.click();

    URL.revokeObjectURL(url);
  }

  generateExportContent(format) {
    if (!this.verificationResults) return '';

    const { claim, supporting, contradicting, explanation, confidenceScore } = this.verificationResults;

    if (format === 'markdown') {
      return `# Argus Claim Verification Report

## Claim Analysis
**Original:** ${claim.claim}
**Canonical:** ${claim.canonicalized_claim}
**Entities:** ${claim.entities.join(', ') || 'None'}
**Numbers:** ${claim.numbers.join(', ') || 'None'}
**Extraction Confidence:** ${(claim.confidence * 100).toFixed(1)}%

## Credibility Assessment
**Overall Score:** ${Math.round(confidenceScore * 100)}%
**Bucket:** ${explanation.bucket}
**Assessment Confidence:** ${(explanation.confidence_in_assessment * 100).toFixed(1)}%

### Reasoning
${explanation.reasoning_bullets.map(point => `- ${point}`).join('\n')}

## Supporting Evidence (${supporting.length} sources)
${supporting.map((e, i) => `### ${i + 1}. ${e.metadata?.title || 'Unknown Source'}
- **Classification:** Support (${(e.confidence * 100).toFixed(0)}%)
- **Similarity:** ${Math.round(e.similarity * 100)}%
- **Reason:** ${e.reason}
- **Text:** ${e.metadata?.text?.substring(0, 300) || 'No text available'}
- **Source:** ${e.metadata?.url || 'Unknown'}
`).join('\n')}

## Contradicting Evidence (${contradicting.length} sources)
${contradicting.map((e, i) => `### ${i + 1}. ${e.metadata?.title || 'Unknown Source'}
- **Classification:** Contradict (${(e.confidence * 100).toFixed(0)}%)
- **Similarity:** ${Math.round(e.similarity * 100)}%
- **Reason:** ${e.reason}
- **Text:** ${e.metadata?.text?.substring(0, 300) || 'No text available'}
- **Source:** ${e.metadata?.url || 'Unknown'}
`).join('\n')}

## Generated Rebuttal
${this.rebuttalContent || 'No rebuttal generated'}

---
Generated by Argus on ${new Date().toISOString()}
`;
    }

    // HTML for PDF
    return `
<!DOCTYPE html>
<html>
<head>
  <title>Argus Verification Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
    .header { color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px; }
    .claim { background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; }
    .assessment { background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; }
    .evidence { margin: 15px 0; padding: 10px; border-radius: 5px; }
    .supporting { border-left: 4px solid #10b981; background: #f0fdf4; }
    .contradicting { border-left: 4px solid #ef4444; background: #fef2f2; }
    .evidence-header { font-weight: bold; margin-bottom: 5px; }
    .evidence-meta { font-size: 0.9em; color: #666; margin-top: 5px; }
    .score { font-size: 1.2em; font-weight: bold; }
    .high { color: #10b981; }
    .medium { color: #f59e0b; }
    .low { color: #ef4444; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Argus Claim Verification Report</h1>
    <p class="score ${this.getScoreClass(explanation.bucket)}">Overall Assessment: ${explanation.bucket} (${Math.round(confidenceScore * 100)}%)</p>
    <p>Generated on ${new Date().toLocaleString()}</p>
  </div>

  <div class="claim">
    <h2>Claim Analysis</h2>
    <p><strong>Original:</strong> ${claim.claim}</p>
    <p><strong>Canonical:</strong> ${claim.canonicalized_claim}</p>
    <p><strong>Entities:</strong> ${claim.entities.join(', ') || 'None detected'}</p>
    <p><strong>Numbers:</strong> ${claim.numbers.join(', ') || 'None detected'}</p>
    <p><strong>Extraction Confidence:</strong> ${(claim.confidence * 100).toFixed(1)}%</p>
  </div>

  <div class="assessment">
    <h2>Credibility Assessment</h2>
    <p><strong>Bucket:</strong> ${explanation.bucket}</p>
    <p><strong>Net Support Score:</strong> ${explanation.net_support_score}%</p>
    <p><strong>Assessment Confidence:</strong> ${(explanation.confidence_in_assessment * 100).toFixed(1)}%</p>
    <h3>Reasoning</h3>
    <ul>
      ${explanation.reasoning_bullets.map(point => `<li>${point}</li>`).join('')}
    </ul>
  </div>

  <div class="evidence supporting">
    <h3>Supporting Evidence (${supporting.length} sources)</h3>
    ${supporting.map((e, i) => `
      <div class="evidence-item">
        <div class="evidence-header">${i + 1}. ${e.metadata?.title || 'Unknown Source'}</div>
        <p><strong>Confidence:</strong> ${(e.confidence * 100).toFixed(0)}% | <strong>Similarity:</strong> ${Math.round(e.similarity * 100)}%</p>
        <p><strong>Reason:</strong> ${e.reason}</p>
        <p><em>${e.metadata?.text?.substring(0, 300) || 'No text available'}</em></p>
        <div class="evidence-meta">Source: ${e.metadata?.url || 'Unknown'}</div>
      </div>
    `).join('')}
  </div>

  <div class="evidence contradicting">
    <h3>Contradicting Evidence (${contradicting.length} sources)</h3>
    ${contradicting.map((e, i) => `
      <div class="evidence-item">
        <div class="evidence-header">${i + 1}. ${e.metadata?.title || 'Unknown Source'}</div>
        <p><strong>Confidence:</strong> ${(e.confidence * 100).toFixed(0)}% | <strong>Similarity:</strong> ${Math.round(e.similarity * 100)}%</p>
        <p><strong>Reason:</strong> ${e.reason}</p>
        <p><em>${e.metadata?.text?.substring(0, 300) || 'No text available'}</em></p>
        <div class="evidence-meta">Source: ${e.metadata?.url || 'Unknown'}</div>
      </div>
    `).join('')}
  </div>

  ${this.rebuttalContent ? `
  <div class="evidence">
    <h3>Generated Rebuttal</h3>
    <p>${this.rebuttalContent}</p>
  </div>
  ` : ''}
</body>
</html>
`;
  }

  showSettings() {
    // Load current settings
    this.localOnlyToggle.checked = this.settings.localOnly;
    this.encryptStorageToggle.checked = this.settings.encryptStorage;
    this.autoIndexToggle.checked = this.settings.autoIndex;

    this.showState('settings');
  }

  async saveSettings() {
    this.settings = {
      localOnly: this.localOnlyToggle.checked,
      encryptStorage: this.encryptStorageToggle.checked,
      autoIndex: this.autoIndexToggle.checked
    };

    await chrome.storage.sync.set({ argusSettings: this.settings });
    this.updateStatus('Settings saved');
    this.updateLatencyChip(0);
    setTimeout(() => this.backFromSettings(), 1000);
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get('argusSettings');
      if (result.argusSettings) {
        this.settings = { ...this.settings, ...result.argusSettings };
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  backFromSettings() {
    if (this.verificationResults) {
      this.showResults();
    } else if (this.claimData) {
      this.showClaim();
    } else {
      this.showInitial();
    }
  }

  showResults() {
    this.showState('results');
  }

  openDemoPages() {
    // Open demo pages in new tabs
    const demoUrls = [
      chrome.runtime.getURL('demo-pages/claim1.html'),
      chrome.runtime.getURL('demo-pages/claim2.html'),
      chrome.runtime.getURL('demo-pages/claim3.html')
    ];

    demoUrls.forEach(url => chrome.tabs.create({ url }));
  }

  showError(message) {
    this.updateStatus(message);
    setTimeout(() => this.showInitial(), 3000);
  }

  updateStatus(text) {
    if (this.statusText) {
      this.statusText.textContent = text;
    }
    // Update header latency chip status when not measuring latency
    const latencyChip = document.getElementById('latency-chip');
    if (latencyChip && !text.includes('ms')) {
      latencyChip.textContent = `Local • ${text}`;
    }
  }

  updateLatencyChip(latency) {
    if (this.latencyChip) {
      this.latencyChip.textContent = `Local • ${latency}ms`;
    }
  }

  updateLatencyChip(latency) {
    if (this.latencyChip) {
      if (latency === 0) {
        this.latencyChip.textContent = 'Local • Ready';
      } else {
        this.latencyChip.textContent = `Local • ${latency}ms`;
      }
    }
  }

  updateLatency(ms) {
    if (this.latencyDisplay) {
      this.latencyDisplay.textContent = `${ms}ms`;
    }
    // Update header latency chip
    const latencyChip = document.getElementById('latency-chip');
    if (latencyChip) {
      latencyChip.textContent = `Local • ${ms}ms`;
    }
  }
}

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  new ArgusPopup();
});
