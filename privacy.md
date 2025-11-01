# Argus Privacy Policy

## Overview
Argus is designed with privacy as our highest priority. By default, all claim verification happens locally on your device without any data leaving your browser.

## Data Collection & Storage

### What We Store Locally
- **Evidence passages**: Text snippets from pages you visit (only if auto-indexing is enabled)
- **Claim history**: Your processed claims and verification results
- **Settings**: Your privacy and performance preferences
- **Embeddings**: Mathematical representations of text for similarity search (stored locally)

### What We Don't Collect
- No browsing history
- No personal information
- No analytics or telemetry
- No data sent to external servers (unless you explicitly opt-in)

## Local Processing
- All AI processing uses Chrome's built-in APIs (Prompt, Writer, etc.)
- No internet connection required for core functionality
- All data stays in your browser's IndexedDB storage

## Optional Cloud Fallback
- **Opt-in only**: Cloud search requires explicit permission for each use
- **Minimal data**: Only sends canonicalized claims (no personal context)
- **No tracking**: Cloud requests are not logged or associated with users
- **Purpose**: Deeper web search when local evidence is insufficient

## Data Deletion
- Clear all stored data through extension settings
- Uninstalling the extension removes all local data
- No data persists on external servers

## Technical Details
- **Encryption**: Optional password protection for local evidence store
- **Storage**: All data stored in browser's IndexedDB (local only)
- **Permissions**: Minimal Chrome permissions required for functionality

## Contact
For privacy concerns, please check our GitHub repository or create an issue.

*Last updated: January 2024*
