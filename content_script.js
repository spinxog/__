// Content script for Argus Chrome Extension
// Handles page interaction, selection capture, and provenance highlighting

class ArgusContentScript {
  constructor() {
    this.currentSelection = null;
    this.highlightedElements = new Set();

    this.init();
  }

  init() {
    // Listen for selection changes
    document.addEventListener('selectionchange', this.handleSelectionChange.bind(this));

    // Listen for messages from popup/background
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));

    // Add context menu handler
    document.addEventListener('contextmenu', this.handleContextMenu.bind(this));

    // Also listen for mouseup to capture selections
    document.addEventListener('mouseup', this.handleMouseUp.bind(this));

    console.log('Argus content script initialized');
  }

  handleSelectionChange() {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const selectedText = selection.toString().trim();

      if (selectedText.length > 10) { // Minimum selection length
        this.currentSelection = {
          text: selectedText,
          range: range,
          element: range.commonAncestorContainer
        };
        console.log('Selection captured:', selectedText.substring(0, 50) + '...');
      }
    }
  }

  handleMouseUp(event) {
    // Also capture selection on mouse up for better responsiveness
    setTimeout(() => this.handleSelectionChange(), 10);
  }

  handleContextMenu(event) {
    // Check if selection is within our current selection
    if (this.currentSelection && this.isSelectionValid()) {
      // Could add custom context menu item here if needed
      // For now, just ensure selection is captured
    }
  }

  isSelectionValid() {
    const selection = window.getSelection();
    return selection.toString().trim() === this.currentSelection?.text;
  }

  // Extract content from selection
  extractSelectionData() {
    if (!this.currentSelection) return null;

    const { text, range, element } = this.currentSelection;

    // Get page context
    const context = this.getPageContext(element);

    // Get nearby images
    const images = this.getNearbyImages(element);

    // Get metadata
    const metadata = this.getPageMetadata();

    // Generate CSS selector
    const cssSelector = this.generateCSSSelector(element);

    return {
      selection: text,
      context: context,
      images: images,
      url: window.location.href,
      title: document.title,
      cssSelector: cssSelector,
      timestamp: Date.now()
    };
  }

  getPageContext(element) {
    // Get surrounding text context
    let context = '';

    // Get text from parent elements
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
      if (node.textContent.trim()) {
        textNodes.push(node);
      }
    }

    // Find current element in text nodes and get surrounding context
    const currentText = element.textContent || element.innerText || '';
    const currentIndex = textNodes.findIndex(n => n.textContent.includes(currentText.substring(0, 50)));

    if (currentIndex !== -1) {
      const start = Math.max(0, currentIndex - 5);
      const end = Math.min(textNodes.length, currentIndex + 5);

      for (let i = start; i < end; i++) {
        context += textNodes[i].textContent.trim() + ' ';
      }
    }

    // Fallback: get text from headings and paragraphs
    if (context.length < 500) {
      const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
      const paragraphs = Array.from(document.querySelectorAll('p'));

      context = headings.map(h => h.textContent).join(' ') + ' ' +
                paragraphs.slice(0, 5).map(p => p.textContent).join(' ');
    }

    return context.substring(0, 6000); // Cap at 6k chars
  }

  getNearbyImages(element) {
    const images = [];
    const rect = element.getBoundingClientRect();

    // Find images within reasonable proximity
    const allImages = Array.from(document.querySelectorAll('img'));
    allImages.forEach(img => {
      const imgRect = img.getBoundingClientRect();
      const distance = Math.sqrt(
        Math.pow(rect.left - imgRect.left, 2) + Math.pow(rect.top - imgRect.top, 2)
      );

      if (distance < 500) { // Within 500px
        images.push({
          src: img.src,
          alt: img.alt,
          distance: distance
        });
      }
    });

    // Sort by proximity and take top 3
    images.sort((a, b) => a.distance - b.distance);
    return images.slice(0, 3).map(img => img.src);
  }

  getPageMetadata() {
    const metaTags = Array.from(document.querySelectorAll('meta'));
    const metadata = {};

    metaTags.forEach(meta => {
      if (meta.name) {
        metadata[meta.name] = meta.content;
      } else if (meta.getAttribute('property')) {
        metadata[meta.getAttribute('property')] = meta.content;
      }
    });

    return {
      description: metadata.description || metadata['og:description'] || '',
      author: metadata.author || metadata['article:author'] || '',
      publishDate: metadata['article:published_time'] || metadata['og:published_time'] || '',
      siteName: metadata['og:site_name'] || ''
    };
  }

  generateCSSSelector(element) {
    // Generate a robust CSS selector for the element
    if (element.id) {
      return `#${element.id}`;
    }

    let selector = element.tagName.toLowerCase();
    if (element.className) {
      selector += `.${element.className.split(' ').join('.')}`;
    }

    // Add nth-child if needed for uniqueness
    const siblings = Array.from(element.parentNode?.children || []);
    const index = siblings.indexOf(element);
    if (index > 0) {
      selector += `:nth-child(${index + 1})`;
    }

    // Walk up the DOM to make it more specific
    let parent = element.parentElement;
    let depth = 0;
    while (parent && parent !== document.body && depth < 3) {
      let parentSelector = parent.tagName.toLowerCase();
      if (parent.id) {
        parentSelector = `#${parent.id}`;
        selector = `${parentSelector} ${selector}`;
        break; // ID is unique enough
      } else if (parent.className) {
        parentSelector += `.${parent.className.split(' ').join('.')}`;
      }

      selector = `${parentSelector} ${selector}`;
      parent = parent.parentElement;
      depth++;
    }

    return selector;
  }

  // Highlight element for provenance
  highlightElement(selector, snippet) {
    try {
      // Remove previous highlights
      this.clearHighlights();

      const element = document.querySelector(selector);
      if (!element) {
        // Fallback: search for text snippet
        this.highlightByText(snippet);
        return;
      }

      // Add highlight overlay
      const rect = element.getBoundingClientRect();
      const overlay = document.createElement('div');

      overlay.style.position = 'absolute';
      overlay.style.left = `${rect.left + window.scrollX}px`;
      overlay.style.top = `${rect.top + window.scrollY}px`;
      overlay.style.width = `${rect.width}px`;
      overlay.style.height = `${rect.height}px`;
      overlay.style.backgroundColor = 'rgba(255, 255, 0, 0.3)';
      overlay.style.border = '2px solid #ff6b35';
      overlay.style.borderRadius = '4px';
      overlay.style.zIndex = '9999';
      overlay.style.pointerEvents = 'none';
      overlay.className = 'argus-highlight';

      document.body.appendChild(overlay);
      this.highlightedElements.add(overlay);

      // Scroll into view
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Auto-remove after 5 seconds
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
          this.highlightedElements.delete(overlay);
        }
      }, 5000);

    } catch (error) {
      console.error('Highlight failed:', error);
    }
  }

  highlightByText(snippet) {
    // Fallback highlighting by searching for text
    const text = snippet.substring(0, 100);
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    let node;
    while (node = walker.nextNode()) {
      if (node.textContent.includes(text)) {
        const element = node.parentElement;
        if (element) {
          this.highlightElement(this.generateCSSSelector(element), snippet);
          break;
        }
      }
    }
  }

  clearHighlights() {
    this.highlightedElements.forEach(overlay => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    });
    this.highlightedElements.clear();
  }

  // Handle messages from popup/background
  handleMessage(request, sender, sendResponse) {
    switch (request.action) {
      case 'ping':
        // Simple ping to check if content script is ready
        sendResponse({ success: true });
        break;

      case 'getSelectionData':
        const data = this.extractSelectionData();
        sendResponse({ success: !!data, data: data });
        break;

      case 'contextMenuVerify':
        // Handle context menu verification
        this.currentSelection = {
          text: request.selection,
          element: document.body // Fallback element
        };
        // Trigger popup opening (this will be handled by the popup checking for selection)
        sendResponse({ success: true });
        break;

      case 'highlight':
        this.highlightElement(request.selector, request.snippet);
        sendResponse({ success: true });
        break;

      case 'clearHighlights':
        this.clearHighlights();
        sendResponse({ success: true });
        break;

      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  }
}

// Initialize content script
const argusContent = new ArgusContentScript();
