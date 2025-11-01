// Options page script for Argus Chrome Extension

class ArgusOptions {
  constructor() {
    this.settings = {
      localOnly: true,
      encryptStorage: false,
      autoIndex: true,
      cloudFallback: false
    };

    this.init();
  }

  init() {
    this.bindElements();
    this.loadSettings();

    console.log('Argus options initialized');
  }

  bindElements() {
    this.localOnlyToggle = document.getElementById('local-only');
    this.encryptStorageToggle = document.getElementById('encrypt-storage');
    this.autoIndexToggle = document.getElementById('auto-index');
    this.cloudFallbackToggle = document.getElementById('cloud-fallback');
    this.saveBtn = document.getElementById('save-btn');
    this.statusDiv = document.getElementById('status');

    this.saveBtn.addEventListener('click', () => this.saveSettings());
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get('argusSettings');
      if (result.argusSettings) {
        this.settings = { ...this.settings, ...result.argusSettings };
        this.updateUI();
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      this.showStatus('Failed to load settings', 'error');
    }
  }

  updateUI() {
    this.localOnlyToggle.checked = this.settings.localOnly;
    this.encryptStorageToggle.checked = this.settings.encryptStorage;
    this.autoIndexToggle.checked = this.settings.autoIndex;
    this.cloudFallbackToggle.checked = this.settings.cloudFallback;
  }

  async saveSettings() {
    this.settings = {
      localOnly: this.localOnlyToggle.checked,
      encryptStorage: this.encryptStorageToggle.checked,
      autoIndex: this.autoIndexToggle.checked,
      cloudFallback: this.cloudFallbackToggle.checked
    };

    try {
      await chrome.storage.sync.set({ argusSettings: this.settings });
      this.showStatus('Settings saved successfully!', 'success');

      // Notify other parts of the extension about settings change
      chrome.runtime.sendMessage({ action: 'settingsUpdated', settings: this.settings });

    } catch (error) {
      console.error('Failed to save settings:', error);
      this.showStatus('Failed to save settings', 'error');
    }
  }

  showStatus(message, type) {
    this.statusDiv.textContent = message;
    this.statusDiv.className = `status ${type}`;
    this.statusDiv.style.display = 'block';

    setTimeout(() => {
      this.statusDiv.style.display = 'none';
    }, 3000);
  }
}

// Initialize options page
document.addEventListener('DOMContentLoaded', () => {
  new ArgusOptions();
});
