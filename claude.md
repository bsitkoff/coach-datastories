# Codio Coach Development Log

## Project Overview
Custom Codio coach assistant for middle school students learning data science with Jupyter notebooks and the `ds_helpers` library.

**Repository:** https://github.com/bsitkoff/coach-datastories

---

## Session: December 1, 2025

### Problem Encountered
After disconnection, the coach was showing debug errors:
```
**DEBUG - Error getting file tree: Cannot read properties of undefined (reading 'getFileTree')**
```

The `codioIDE.workspace.getFileTree()` API was undefined, causing errors when trying to read workspace files directly.

### Changes Made

#### 1. Added DEBUG_MODE Configuration
**File:** `index.js:61`

```javascript
const DEBUG_MODE = true  // Set to true to see debug output
```

- Created a toggleable flag to control debug output visibility
- All debug statements now wrapped in `if (DEBUG_MODE)` checks
- Prevents debug clutter for students when set to `false`

#### 2. Fixed Workspace API Error
**File:** `index.js:68-74`

Added defensive check before calling workspace API:
```javascript
// Check if workspace API is available
if (!codioIDE.workspace || !codioIDE.workspace.getFileTree) {
  if (DEBUG_MODE) {
    codioIDE.coachBot.write("**DEBUG - workspace.getFileTree() not available, skipping direct file read**")
  }
  return filesContext
}
```

- Prevents "Cannot read properties of undefined" error
- Coach gracefully handles missing API and continues working
- Returns empty context string if API unavailable

#### 3. Refactored Context Handling
**File:** `index.js:137-160`

Created new `buildEnhancedContext()` function:
```javascript
async function buildEnhancedContext(baseContext) {
  let enhanced = {...baseContext}

  try {
    // Try to read workspace files directly (if API is available)
    const workspaceFiles = await tryGetWorkspaceFiles()

    if (workspaceFiles) {
      enhanced.workspaceFiles = workspaceFiles
    }

    if (DEBUG_MODE) {
      codioIDE.coachBot.write("**DEBUG - Enhanced context built successfully**")
    }

  } catch (error) {
    if (DEBUG_MODE) {
      codioIDE.coachBot.write(`**DEBUG - Could not enhance context: ${error.message}**`)
    }
  }

  return enhanced
}
```

#### 4. Switched to Context Parameter Approach
**File:** `index.js:201-205`

**Old approach:** Appending context to first user message
```javascript
// On first message, include all context information
const userContent = messages.length === 0 && contextInfo
  ? input + contextInfo
  : input

messages.push({
  "role": "user",
  "content": userContent
})

const result = await codioIDE.coachBot.ask({
  systemPrompt: systemPrompt,
  messages: messages
}, {preventMenu: true})
```

**New approach:** Passing context as parameter (from template)
```javascript
// Add user input to messages
messages.push({
  "role": "user",
  "content": input
})

// Send the API request to the LLM with all prompts, messages, and context
const result = await codioIDE.coachBot.ask({
  systemPrompt: systemPrompt,
  messages: messages,
  context: enhancedContext
}, {preventMenu: true})
```

**Benefits:**
- Cleaner separation of concerns
- Follows official template pattern
- More maintainable code structure

### Code Quality Improvements

- Removed 60 lines of complex context string building logic
- Wrapped all debug output in conditional checks
- Added clear comments explaining each section
- Verified syntax with `node -c index.js` ✅

---

## Current Status

### ✅ Completed
- [x] Fixed workspace API undefined error
- [x] Added DEBUG_MODE configuration flag
- [x] Refactored to use context parameter approach
- [x] Committed and pushed to GitHub (commit: `0125a8c`)

### ⏳ Testing Required
The user mentioned that when they tested the template approach previously, it didn't work. With DEBUG_MODE enabled, we can now see:
- What context is being received from `codioIDE.coachBot.getContext()`
- Whether workspace files are being read successfully
- How the context is being passed to the LLM

### 🔍 Next Steps
1. User will test the coach with DEBUG_MODE enabled
2. Review debug output to identify why context approach may not be working
3. Adjust implementation based on actual API behavior
4. Once working, set DEBUG_MODE to `false` for production use

---

## Key Files

- **index.js** - Main coach implementation
- **metadata.json** - Coach metadata (name, type, properties)
- **claude.md** - This documentation file

---

## Coach Features

### System Prompt Includes:
- ds_helpers.py function reference
- Common student challenges
- Coaching approach guidelines
- Step-by-step guidance for middle school students

### Context Sources:
1. **Codio Context** (`codioIDE.coachBot.getContext()`)
   - Student files
   - Assignment data
   - Guide content

2. **Workspace Files** (if API available)
   - Jupyter notebooks (`.ipynb`)
   - Python files (`.py`)
   - CSV data files (`.csv`)

### Student Workflow Support:
1. Load data with `ds.load_clean()`
2. Explore columns with `ds.columns_guide()`
3. Find columns with `ds.col(df, 'search')`
4. Calculate statistics (mean, median, count)
5. Filter data using pandas
6. Create visualizations (bar charts, scatter plots)
7. Write data stories explaining findings

---

## Notes

- DEBUG_MODE currently set to `true` for testing
- Workspace API (`codioIDE.workspace.getFileTree()`) appears to be undefined in current environment
- Template approach using `context` parameter needs verification
- Coach should work even if workspace API is unavailable, using only `getContext()` data

---

*Last updated: December 1, 2025*
*Developed with Claude Code assistance*
