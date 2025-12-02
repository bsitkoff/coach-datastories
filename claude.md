# Codio Coach Development Log

## Project Overview
Custom Codio coach assistant for middle school students learning data science with Jupyter notebooks and the `ds_helpers` library.

**Repository:** https://github.com/bsitkoff/coach-datastories

---

## Session: December 2, 2025

### Summary: Coach Now Fully Functional ✅

The Data Stories Coach is now working correctly! Students can click "I have a question" with a Jupyter notebook open, and the coach will see all their code and provide specific, targeted help.

**What was fixed:**
1. Changed `cell.source` to `cell.content` to properly read Jupyter cells from Codio's API
2. Appended notebook context to first user message so LLM can actually see it
3. Added comprehensive deployment documentation
4. DEBUG_MODE now set to `false` for production use

**How it works:**
1. Student opens a Jupyter notebook (e.g., explore.ipynb)
2. Student clicks "I have a question" button
3. Coach extracts all cells (code and markdown) from open notebooks
4. On first message, appends notebook context to user input
5. LLM sees the full notebook and provides specific guidance
6. Conversation continues with context in message history

**Files ready for deployment:**
- ✅ index.js (DEBUG_MODE = false)
- ✅ metadata.json
- ✅ claude.md (comprehensive documentation)

---

### Critical Bug Fix: Jupyter Cell Content Not Loading

**Problem:**
The coach was receiving Jupyter notebook context correctly, but wasn't showing the cell content to the LLM. Debug output showed:
```
**DEBUG - Enhanced context built: 353 chars**
```
This was only headers - no actual code or markdown content from cells.

**Root Cause:**
The code was reading `cell.source` but Codio's jupyterContext API uses `cell.content`:
```javascript
// WRONG:
contextInfo += `\n### Cell ${index + 1} (${cell.type}):\n\`\`\`\n${cell.source || ''}\n\`\`\`\n`

// CORRECT:
contextInfo += `\n### Cell ${index + 1} (${cell.type}):\n\`\`\`\n${cell.content || ''}\n\`\`\`\n`
```

**The Fix:**
Changed line 164 in `index.js` from `cell.source` to `cell.content`.

**Impact:**
- Before: Coach couldn't see any notebook code, gave generic responses
- After: Coach can see all cell content and provide specific, targeted help

**Verification:**
After the fix, debug output should show much larger context (thousands of chars instead of just 353).

### Second Fix: Context Not Visible to LLM

**Problem:**
Even after fixing cell.content, the LLM still couldn't see the notebook content. The context was building correctly (2452 chars) but the LLM responded as if it had no access to the notebook.

**Root Cause:**
We were passing `enhancedContext.notebookContext` as a custom property in the context parameter, but the Codio Coach API doesn't expose custom properties to the LLM. The LLM only sees the standard context properties (guidesPage, assignmentData, jupyterContext, files).

**The Fix:**
Append the notebook content to the first user message so it's directly in the conversation history:
```javascript
// On first message, append notebook context so LLM can see it
const userContent = messages.length === 0 && enhancedContext.notebookContext
  ? input + "\n\n---\n\n**CONTEXT: Student's Open Notebook**\n" + enhancedContext.notebookContext
  : input

messages.push({
  "role": "user",
  "content": userContent
})
```

**Impact:**
- Context is now in the message history where the LLM can definitely see it
- Only sent on first message to save tokens
- LLM can reference the notebook throughout the conversation

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

## Deployment & GitHub Workflow

### Repository Information
- **GitHub Repository:** git@github.com:bsitkoff/coach-datastories.git
- **Latest Release:** https://github.com/bsitkoff/coach-datastories/releases/tag/v1.0.6
- **Authentication:** SSH with GITHUB_TOKEN environment variable

### Files to Push
Only push the coach files from the `coach-datastories-repo/` directory:
- `index.js` - Main coach implementation
- `metadata.json` - Coach metadata
- `claude.md` - Development documentation

**Do NOT push:**
- Files from the parent `/home/codio/workspace/` directory
- `ds_helpers.py`, `evictions.csv`, `data_stories_milestone_mild.ipynb` (these are workspace files, not coach files)

### Standard Git Workflow

**1. Navigate to the coach directory:**
```bash
cd /home/codio/workspace/coach-datastories-repo
```

**2. Check status and see what changed:**
```bash
git status
git diff
```

**3. Add changes (only coach files):**
```bash
# Add specific files
git add index.js metadata.json claude.md

# Or add all changes in the coach directory
git add .
```

**4. Commit with descriptive message:**
```bash
git commit -m "Brief description of changes"
```

**5. Push to GitHub:**
```bash
git push origin main
```

### Using the GITHUB_TOKEN Environment Variable

The environment has a `GITHUB_TOKEN` variable configured for authentication:
```bash
echo $GITHUB_TOKEN  # Verify token is set
```

If you need to use HTTPS instead of SSH, configure the remote:
```bash
# Switch to HTTPS with token authentication
git remote set-url origin https://${GITHUB_TOKEN}@github.com/bsitkoff/coach-datastories.git

# Or switch back to SSH
git remote set-url origin git@github.com:bsitkoff/coach-datastories.git
```

### Common Workflows

**Quick commit and push:**
```bash
cd /home/codio/workspace/coach-datastories-repo
git add .
git commit -m "Update coach functionality"
git push origin main
```

**Check remote configuration:**
```bash
git remote -v
```

**View commit history:**
```bash
git log --oneline -10
```

**Create a new release tag:**
```bash
git tag -a v1.0.7 -m "Release version 1.0.7"
git push origin v1.0.7
```

### Important Notes

- The repository uses **SSH authentication** by default (git@github.com)
- The `GITHUB_TOKEN` environment variable is available if needed for HTTPS
- Always work within `/home/codio/workspace/coach-datastories-repo/` directory
- The parent workspace directory is NOT part of the git repository
- Verify you're in the correct directory before committing: `pwd` should show `/home/codio/workspace/coach-datastories-repo`

---

## Troubleshooting

### Enabling Debug Mode

If the coach isn't working as expected, enable debug mode to see diagnostic information:

**File:** `index.js:61`
```javascript
const DEBUG_MODE = true  // Change false to true
```

**What you'll see:**
- `**DEBUG - Context received:**` - Full JSON of context from Codio API
- `**DEBUG - Found N open Jupyter notebook(s)**` - Number of open notebooks detected
- `**DEBUG - Notebook 0: path with N cells**` - Each notebook's path and cell count
- `**DEBUG - Enhanced context built: N chars**` - Size of context being sent to LLM
- `**DEBUG - workspace.getFileTree() not available**` - If workspace API is unavailable

**Expected values when working correctly:**
- Open notebooks detected: ≥ 1
- Context size: 2000-5000+ chars (depending on notebook size)
- If context is < 500 chars, cells aren't being extracted properly

### Common Issues

**Issue:** "Please open a Jupyter notebook first!"
- **Cause:** No notebooks are open in the IDE
- **Fix:** Student must open a .ipynb file before clicking coach button

**Issue:** Coach gives generic responses like "I don't have access to your notebook"
- **Cause:** Context not being passed to LLM correctly
- **Fix:** Check that notebook context is appended to first user message (lines 233-236)
- **Debug:** Enable DEBUG_MODE and check context size

**Issue:** "workspace.getFileTree() not available"
- **Cause:** Codio workspace API is unavailable in current environment
- **Impact:** Coach can still work using jupyterContext from getContext()
- **Fix:** No fix needed - this is expected behavior, not an error

**Issue:** Cell content is empty
- **Cause:** Using wrong property name (cell.source vs cell.content)
- **Fix:** Verify line 164 uses `cell.content`, not `cell.source`

### Verifying the Fix

After making changes, verify everything works:

1. **Syntax check:**
   ```bash
   node -c index.js
   ```

2. **Test with DEBUG_MODE = true:**
   - Open a Jupyter notebook in Codio
   - Click "I have a question"
   - Verify context size is > 2000 chars
   - Ask "Tell me about my notebook"
   - Coach should describe specific cells

3. **Disable debug mode for production:**
   ```bash
   # Set DEBUG_MODE = false in index.js:61
   ```

4. **Commit and push:**
   ```bash
   git add index.js claude.md
   git commit -m "Description of changes"
   git push origin main
   ```

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
