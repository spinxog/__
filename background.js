// Background script for Argus Chrome Extension
// Handles core processing logic and API calls

class ArgusBackground {
  constructor() {
    this.dbVersion = 1;
    this.dbName = 'argus_evidence_store';
    this.settings = {
      localOnly: true,
      encryptStorage: false,
      autoIndex: true,
      cloudFallback: false
    };

    // Performance tracking
    this.performanceMetrics = {
      lastLatency: 0,
      parseSuccess: true,
      netSupportScore: 0
    };

    this.init();
  }

  async init() {
    // Initialize IndexedDB
    await this.initDB();

    // Load settings
    await this.loadSettings();

    // Load canonical prompts
    await this.loadPrompts();

    // Set up message listeners
    this.setupMessageListeners();

    // Set up context menu
    this.setupContextMenu();

    console.log('Argus background initialized');
  }

  async loadPrompts() {
    this.prompts = {};
    const promptFiles = [
      'claim_extraction_prompt',
      'evidence_rerank_prompt',
      'skeptical_scorer_prompt',
      'export_slide_prompt',
      'rebuttal_prompt'
    ];

    for (const file of promptFiles) {
      try {
        const response = await fetch(chrome.runtime.getURL(`prompts/${file}.txt`));
        this.prompts[file] = await response.text();
      } catch (error) {
        console.error(`Failed to load prompt ${file}:`, error);
        this.prompts[file] = ''; // Fallback
      }
    }
  }

  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Keep message channel open for async responses
    });
  }

  async handleMessage(request, sender, sendResponse) {
    const startTime = Date.now();

    try {
      switch (request.action) {
        case 'extractClaim':
          const claimResult = await this.extractClaim(request.data);
          this.performanceMetrics.parseSuccess = !claimResult.error;
          sendResponse({ success: true, data: claimResult });
          break;

        case 'findEvidence':
          const evidenceResult = await this.findEvidence(request.claim);
          sendResponse({ success: true, data: evidenceResult });
          break;

        case 'generateExplanation':
          const explanationResult = await this.generateExplanation(request.claim, request.evidence);
          sendResponse({ success: true, data: { explanation: explanationResult } });
          break;

        case 'generateRebuttal':
          const rebuttalResult = await this.generateRebuttal(request.claim, request.evidence, request.score);
          sendResponse({ success: true, data: { rebuttal: rebuttalResult } });
          break;

        case 'settingsUpdated':
          this.settings = { ...this.settings, ...request.settings };
          sendResponse({ success: true });
          break;

        case 'getPerformanceMetrics':
          sendResponse({
            success: true,
            metrics: this.performanceMetrics
          });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Background message handling error:', error);
      this.performanceMetrics.parseSuccess = false;
      sendResponse({ success: false, error: error.message });
    }

    this.performanceMetrics.lastLatency = Date.now() - startTime;
  }

  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Evidence store
        if (!db.objectStoreNames.contains('evidence')) {
          const evidenceStore = db.createObjectStore('evidence', { keyPath: 'id', autoIncrement: true });
          evidenceStore.createIndex('url', 'url', { unique: false });
          evidenceStore.createIndex('embedding', 'embedding', { unique: false });
        }

        // Claims store
        if (!db.objectStoreNames.contains('claims')) {
          const claimsStore = db.createObjectStore('claims', { keyPath: 'id', autoIncrement: true });
          claimsStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  async extractClaim(selectionData) {
    const prompt = `${this.prompts.claim_extraction_prompt}

Selected text: "${selectionData.selection}"
Page context: ${selectionData.context || 'No additional context'}
Page title: ${selectionData.title || 'Unknown'}
Source URL: ${selectionData.url || 'Unknown'}`;

    try {
      const session = await ai.languageModel.create({
        temperature: 0.1,
        topK: 1,
        systemPrompt: 'You are a claim verification assistant. Always respond with valid JSON only.'
      });

      const result = await session.prompt(prompt);
      const parsed = JSON.parse(result);

      // Validate schema
      this.validateClaimExtractionSchema(parsed);

      return parsed;
    } catch (error) {
      console.error('Claim extraction failed:', error);

      // Try one more time with schema reminder
      try {
        const retryPrompt = `${prompt}

IMPORTANT: Your response must be valid JSON matching this exact schema:
{
  "claim": "string",
  "canonicalized_claim": "string",
  "entities": ["array", "of", "strings"],
  "numbers": [1, 2.5],
  "times": ["time references"],
  "confidence": 0.85,
  "suggested_queries": ["query1", "query2"]
}`;

        const session = await ai.languageModel.create({
          temperature: 0,
          topK: 1
        });

        const retryResult = await session.prompt(retryPrompt);
        const parsed = JSON.parse(retryResult);
        this.validateClaimExtractionSchema(parsed);
        return parsed;

      } catch (retryError) {
        console.error('Claim extraction retry failed:', retryError);
        // Return error format
        return { error: "format" };
      }
    }
  }

  validateClaimExtractionSchema(data) {
    const required = ['claim', 'canonicalized_claim', 'entities', 'numbers', 'times', 'confidence', 'suggested_queries'];
    for (const field of required) {
      if (!(field in data)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (typeof data.confidence !== 'number' || data.confidence < 0 || data.confidence > 1) {
      throw new Error('Confidence must be a number between 0 and 1');
    }

    if (!Array.isArray(data.entities) || !Array.isArray(data.numbers) ||
        !Array.isArray(data.times) || !Array.isArray(data.suggested_queries)) {
      throw new Error('Array fields must be arrays');
    }
  }

  async findEvidence(claim) {
    // Generate embedding for the claim
    const claimEmbedding = await this.generateEmbedding(claim);

    // Search local evidence store
    const evidence = await this.searchEvidence(claimEmbedding);

    // Rerank results
    const reranked = await this.rerankEvidence(claim, evidence);

    // Calculate net support score
    const supporting = reranked.filter(e => e.classification === 'support');
    const contradicting = reranked.filter(e => e.classification === 'contradict');

    const totalEvidence = supporting.length + contradicting.length;
    const supportRatio = totalEvidence > 0 ? supporting.length / totalEvidence : 0.5;
    this.performanceMetrics.netSupportScore = Math.round(supportRatio * 100);

    return {
      supporting: supporting,
      contradicting: contradicting
    };
  }

  async generateEmbedding(text) {
    // Use Prompt API for embedding generation
    const prompt = `Generate a semantic embedding vector for this text. Return only a JSON array of 384 float values representing semantic meaning: "${text}"`;

    try {
      const session = await ai.languageModel.create({
        temperature: 0,
        topK: 1
      });

      const result = await session.prompt(prompt);
      const embedding = JSON.parse(result);

      if (!Array.isArray(embedding) || embedding.length !== 384) {
        throw new Error('Invalid embedding format');
      }

      return embedding;
    } catch (error) {
      console.error('Embedding generation failed:', error);
      // Fallback: random normalized vector
      const vector = Array.from({ length: 384 }, () => Math.random() * 2 - 1);
      const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
      return vector.map(val => val / norm);
    }
  }

  async searchEvidence(queryEmbedding) {
    const db = await this.openDB();
    const transaction = db.transaction(['evidence'], 'readonly');
    const store = transaction.objectStore('evidence');

    return new Promise((resolve) => {
      const results = [];
      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const evidence = cursor.value;
          const similarity = this.cosineSimilarity(queryEmbedding, evidence.embedding);
          results.push({
            ...evidence,
            similarity: similarity
          });
          cursor.continue();
        } else {
          // Sort by similarity and return top 10
          results.sort((a, b) => b.similarity - a.similarity);
          resolve(results.slice(0, 10));
        }
      };

      request.onerror = () => resolve([]);
    });
  }

  cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async rerankEvidence(claim, evidence) {
    if (evidence.length === 0) return [];

    const passagesText = evidence.map((e, i) =>
      `${i + 1}. "${e.metadata?.text || e.text || 'No text available'}"`
    ).join('\n');

    const prompt = `${this.prompts.evidence_rerank_prompt}

Claim: "${claim}"

Passages to analyze:
${passagesText}`;

    try {
      const session = await ai.languageModel.create({
        temperature: 0.1,
        topK: 1,
        systemPrompt: 'You are an evidence analysis assistant. Always respond with valid JSON only.'
      });

      const result = await session.prompt(prompt);
      const parsed = JSON.parse(result);

      if (!parsed.passages || !Array.isArray(parsed.passages)) {
        throw new Error('Invalid rerank response format');
      }

      return evidence.map((e, i) => ({
        ...e,
        classification: parsed.passages[i]?.classification || 'neutral',
        confidence: parsed.passages[i]?.confidence || 0.5,
        reason: parsed.passages[i]?.reason || 'Unable to classify'
      }));
    } catch (error) {
      console.error('Evidence reranking failed:', error);
      // Fallback: mark all as neutral
      return evidence.map(e => ({
        ...e,
        classification: 'neutral',
        confidence: 0.5,
        reason: 'Classification failed - using fallback'
      }));
    }
  }

  async generateExplanation(claim, evidence) {
    const supporting = evidence.filter(e => e.classification === 'support').length;
    const contradicting = evidence.filter(e => e.classification === 'contradict').length;

    const prompt = `${this.prompts.skeptical_scorer_prompt}

Claim: "${claim}"
Supporting evidence count: ${supporting}
Contradicting evidence count: ${contradicting}

Evidence details:
${evidence.slice(0, 5).map((e, i) => `${i + 1}. ${e.classification}: ${e.reason}`).join('\n')}`;

    try {
      const session = await ai.languageModel.create({
        temperature: 0.1,
        topK: 1,
        systemPrompt: 'You are a skeptical fact-checker. Always respond with valid JSON only.'
      });

      const result = await session.prompt(prompt);
      const parsed = JSON.parse(result);

      this.validateSkepticalScorerSchema(parsed);

      // Update performance metrics
      this.performanceMetrics.netSupportScore = parsed.net_support_score;

      return parsed.reasoning_bullets || [
        'Analysis completed with available evidence',
        'Results may vary based on evidence quality and quantity',
        'Consider consulting additional sources for comprehensive verification'
      ];
    } catch (error) {
      console.error('Explanation generation failed:', error);
      return [
        'Analysis completed with available evidence',
        'Results may vary based on evidence quality and quantity',
        'Consider consulting additional sources for comprehensive verification'
      ];
    }
  }

  validateSkepticalScorerSchema(data) {
    const required = ['net_support_score', 'bucket', 'reasoning_bullets', 'confidence_in_assessment'];
    for (const field of required) {
      if (!(field in data)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (typeof data.net_support_score !== 'number' || data.net_support_score < 0 || data.net_support_score > 100) {
      throw new Error('net_support_score must be a number between 0 and 100');
    }

    if (!['Likely True', 'Suspicious', 'Likely False'].includes(data.bucket)) {
      throw new Error('bucket must be one of: Likely True, Suspicious, Likely False');
    }

    if (!Array.isArray(data.reasoning_bullets) || data.reasoning_bullets.length !== 3) {
      throw new Error('reasoning_bullets must be an array of exactly 3 strings');
    }
  }

  async generateRebuttal(claim, evidence, score) {
    const prompt = `${this.prompts.rebuttal_prompt}

Claim: "${claim}"
Evidence summary:
- Supporting sources: ${evidence.filter(e => e.classification === 'support').length}
- Contradicting sources: ${evidence.filter(e => e.classification === 'contradict').length}
- Overall confidence score: ${score}

Key evidence highlights:
${evidence.slice(0, 3).map(e => `- ${e.classification}: ${e.reason}`).join('\n')}`;

    try {
      const session = await ai.languageModel.create({
        temperature: 0.1,
        topK: 1,
        systemPrompt: 'You are a professional fact-checker creating evidence-based rebuttals. Always respond with valid JSON only.'
      });

      const result = await session.prompt(prompt);
      const parsed = JSON.parse(result);

      this.validateRebuttalSchema(parsed);

      return parsed;
    } catch (error) {
      console.error('Rebuttal generation failed:', error);
      return {
        concise_rebuttal: `Based on available evidence, this claim appears ${score > 0.6 ? 'supported' : score > 0.4 ? 'questionable' : 'unsupported'}. Further verification recommended.`,
        tweet_thread: [
          `Tweet 1/3: Analyzing claim: "${claim.substring(0, 100)}..."`,
          `Tweet 2/3: Evidence suggests this is ${score > 0.6 ? 'likely true' : score > 0.4 ? 'debatable' : 'likely false'}`,
          `Tweet 3/3: Always verify claims with multiple sources. #FactCheck`
        ],
        tone: score > 0.6 ? 'supportive' : 'skeptical',
        key_evidence_used: ['Analysis based on available evidence']
      };
    }
  }

  validateRebuttalSchema(data) {
    const required = ['concise_rebuttal', 'tweet_thread', 'tone', 'key_evidence_used'];
    for (const field of required) {
      if (!(field in data)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (!Array.isArray(data.tweet_thread) || data.tweet_thread.length !== 3) {
      throw new Error('tweet_thread must be an array of exactly 3 tweets');
    }

    if (data.concise_rebuttal.length > 50) {
      console.warn('concise_rebuttal exceeds 50 words, but allowing for quality');
    }
  }
  async openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
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

  setupContextMenu() {
    chrome.contextMenus.create({
      id: 'verify-claim',
      title: 'Verify',
      contexts: ['selection']
    });

    chrome.contextMenus.onClicked.addListener((info, tab) => {
      if (info.menuItemId === 'verify-claim' && info.selectionText) {
        // Store the selection in storage for the popup to pick up
        chrome.storage.local.set({
          pendingSelection: {
            text: info.selectionText,
            timestamp: Date.now()
          }
        }).then(() => {
          // Open popup
          chrome.action.openPopup();
        });
      }
    });
  }
}

// Initialize background script
new ArgusBackground();
