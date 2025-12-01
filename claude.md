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

## BREAKTHROUGH DISCOVERY 🎯

### The Real Issue
The coach was using **`context.files`** but Jupyter notebooks are accessed via **`context.jupyterContext`**!

**Key findings from testing:**
```json
{
  "jupyterContext": [],  // Empty because NO notebooks were open!
  "files": [],           // Not used for Jupyter
  "guidesPage": {...},   // Works fine
  "assignmentData": {...} // Works fine
}
```

### How Jupyter Context Actually Works

Based on [eCornell JupyterLab Summarize Assistant](https://github.com/codio-extensions/eCornell-JupyterLab-Summarize-Assistant):

```javascript
let context = await codioIDE.coachBot.getContext()

// Access OPEN Jupyter notebooks (must be open in IDE!)
let notebook = context.jupyterContext[0]  // First open notebook
let notebookPath = notebook.path           // File path
let cells = notebook.content               // Array of cells

// Each cell has: type ('code' or 'markdown'), source, id
```

**Critical requirement:** Students must have notebooks **OPEN** in the IDE when clicking the coach button!

## Current Status

### ✅ Completed
- [x] Fixed workspace API undefined error (commit: `0125a8c`)
- [x] Added DEBUG_MODE configuration flag
- [x] Researched Codio Coach API documentation
- [x] Discovered jupyterContext is the correct approach (commit: `e415435`)
- [x] Updated coach to properly access open Jupyter notebooks
- [x] Added user-friendly message when no notebooks are open
- [x] Extract all code and markdown cells from notebooks

### 🧪 Ready for Testing
With DEBUG_MODE enabled, you'll now see:
- Number of open Jupyter notebooks
- Notebook paths and cell counts
- Full cell contents (code and markdown)
- Clear message if no notebooks are open

### 🔍 Next Steps
1. **Test:** Open a Jupyter notebook (Step One, Step Two, etc.)
2. **Click:** "I have a question" button
3. **Verify:** Debug output shows notebook was detected
4. **Ask:** Question about the code (e.g., "What two datafiles does my code use?")
5. **Success:** Coach should now see and reference your actual code!

---

## References & Sources

### Official Documentation
- [Codio Coach API Reference](https://codio.github.io/client/codioIDE.coachBot.html) - getContext() method documentation
- [Virtual Coach Setup](https://docs.codio.com/instructors/setupcourses/assignment-settings/virtual-coach.html) - Codio Virtual Coach configuration
- [Jupyter Extension](https://docs.codio.com/common/develop/ide/editing/jupyter.html) - Required extension for Jupyter context

### Working Examples
- [eCornell JupyterLab Summarize Assistant](https://github.com/codio-extensions/eCornell-JupyterLab-Summarize-Assistant) - Working example we based our implementation on
- [eCornell JupyterLab Error Explanation](https://github.com/codio-extensions/eCornell-JupyterLab-Error-Explanation-Assistant) - Another Jupyter coach example
- [Coach Templates](https://github.com/codio-extensions) - All official Codio coach extensions

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
