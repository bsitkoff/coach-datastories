// Wrapping the whole extension in a JS function 
// (ensures all global variables set in this extension cannot be referenced outside its scope)
(async function(codioIDE, window) {
  
  // System prompt for Data Stories coach
  const systemPrompt = `You are a helpful data science coach for middle school students working on "Data Stories" projects using Jupyter notebooks.

You will receive context including the student's notebook files and available data files. Use this context to provide specific, targeted help. When students ask for help:
1. Reference their actual code when you can see it
2. If you need to see output (like ds.columns_guide(df)), ask them to share it
3. If you need to see error messages, ask them to paste them
4. Be specific and concrete in your responses based on what you can see

Your students are learning to:
- Load and clean data using ds_helpers.py functions
- Find columns with fuzzy matching (ds.col(df, 'partial_name'))
- Calculate basic statistics (mean, median)
- Create charts (bar charts, histograms, scatter plots)
- Write data stories that explain their findings

## ds_helpers.py Function Reference

**Data Loading & Cleaning:**
- ds.load_clean('file.csv') - Loads CSV/Excel, auto-cleans column names, converts data types
- ds.clean_columns(df) - Converts headers to snake_case
- ds.alias_columns(df) - Creates short, student-friendly column aliases

**Column Discovery:**
- ds.columns_guide(df) - Shows mapping: alias ← original column name
- ds.col(df, 'search_term') - Fuzzy column finder (finds partial matches)

**Data Exploration:**
- ds.browse(df) - Interactive widget for filtering/exploring data
- ds.roles(df) - Categorizes columns (numeric, dates, categorical)

**Simple Plotting (for middle schoolers):**
- ds.bar_chart(df, 'column', 'title') - Creates bar charts
- ds.scatter_plot(df, 'x_col', 'y_col', 'title') - Creates scatter plots
- ds.line_plot(df, 'x_col', 'y_col', 'title') - Creates line plots

**Utilities:**
- ds.collapse_small_categories(series, top_n=10) - Groups low-frequency categories

## Common student challenges:
- Forgetting to use column aliases shown by columns_guide()
- Difficulty with fuzzy column matching syntax
- Not understanding the difference between mean and median
- Creating meaningful chart titles and labels
- Writing data stories that connect numbers to real-world meaning

## Coaching approach:
- Be encouraging and patient
- Always ask students to share their code and columns_guide() output first
- Provide concrete, working examples using standard pandas/matplotlib syntax
- Guide students through the 9-step workflow in their notebooks
- When students have column name issues, ask them to paste the output of ds.columns_guide(df)
- Give specific code they can copy and paste, not just general advice
- Explain why code works, not just what to type`
  
  // Try to read actual notebook and data files
  async function tryGetWorkspaceFiles() {
    let filesContext = ""

    try {
      const fileTree = await codioIDE.workspace.getFileTree()
      const relevantFiles = findRelevantFiles(fileTree)

      codioIDE.coachBot.write(`**DEBUG - Found ${relevantFiles.length} relevant files:** ${relevantFiles.join(', ')}`)

      for (const filePath of relevantFiles) {
        try {
          const content = await codioIDE.workspace.readFile(filePath)
          const maxLength = 15000  // Limit per file

          if (content && content.length > 0) {
            if (content.length <= maxLength) {
              filesContext += `\n\n### File: ${filePath}\n\`\`\`\n${content}\n\`\`\`\n`
            } else {
              filesContext += `\n\n### File: ${filePath} (truncated)\n\`\`\`\n${content.substring(0, maxLength)}\n...(truncated)\n\`\`\`\n`
            }
            codioIDE.coachBot.write(`**DEBUG - Read ${filePath}: ${content.length} chars**`)
          }
        } catch (err) {
          codioIDE.coachBot.write(`**DEBUG - Could not read ${filePath}: ${err.message}**`)
        }
      }
    } catch (error) {
      codioIDE.coachBot.write(`**DEBUG - Error getting file tree: ${error.message}**`)
    }

    return filesContext
  }

  // Find relevant files (notebooks, python files, CSVs)
  function findRelevantFiles(fileTree, path = '') {
    let files = []

    if (fileTree.children) {
      for (const item of fileTree.children) {
        const fullPath = path ? `${path}/${item.name}` : item.name

        if (item.type === 'file') {
          const lower = item.name.toLowerCase()
          // Include notebooks, python files, and CSVs (but skip hidden files)
          if (!item.name.startsWith('.') &&
              (lower.endsWith('.ipynb') || lower.endsWith('.py') || lower.endsWith('.csv'))) {
            files.push(fullPath)
          }
        } else if (item.type === 'directory' && !item.name.startsWith('.')) {
          files = files.concat(findRelevantFiles(item, fullPath))
        }
      }
    }

    return files
  }

  // register(id: unique button id, name: name of button visible in Coach, function: function to call when button is clicked) 
  codioIDE.coachBot.register("iNeedHelpButton", "I have a question", onButtonPress)

  // function called when I have a question button is pressed
  async function onButtonPress() {

    // Get context from Codio (includes files, guides, assignments)
    const context = await codioIDE.coachBot.getContext()

    // DEBUG: Show what context we received
    codioIDE.coachBot.write("**DEBUG - Context received:**")
    codioIDE.coachBot.write("```json\n" + JSON.stringify(context, null, 2) + "\n```")

    // Try to read workspace files directly (notebooks, CSV, python files)
    codioIDE.coachBot.write("\n**DEBUG - Attempting to read workspace files directly...**")
    const workspaceFiles = await tryGetWorkspaceFiles()

    // Build context string to include in first message
    let contextInfo = ""

    // Add files from context if available (files is an array of {path, content} objects)
    if (context.files && Array.isArray(context.files) && context.files.length > 0) {
      contextInfo += "\n\n## Student's Files:\n"
      for (const file of context.files) {
        if (file.content) {
          // Skip very large files to avoid token limits, truncate if needed
          const maxLength = 10000
          if (file.content.length <= maxLength) {
            contextInfo += `\n### ${file.path}\n\`\`\`\n${file.content}\n\`\`\`\n`
          } else {
            contextInfo += `\n### ${file.path}\n(File truncated - first ${maxLength} chars)\n\`\`\`\n${file.content.substring(0, maxLength)}\n...\n\`\`\`\n`
          }
        }
      }
    }

    // Add assignment data if available
    if (context.assignmentData) {
      contextInfo += "\n\n## Assignment Context:\n" + JSON.stringify(context.assignmentData)
    }

    // Add guides page if available
    if (context.guidesPage && context.guidesPage.content) {
      contextInfo += "\n\n## Guide Content:\n" + context.guidesPage.content
    }

    // Add workspace files (notebooks, CSVs, Python files) that we read directly
    if (workspaceFiles) {
      contextInfo += "\n\n## Workspace Files:\n" + workspaceFiles
    }

    // DEBUG: Show what we're sending
    if (contextInfo) {
      codioIDE.coachBot.write("**DEBUG - Context info length:** " + contextInfo.length + " characters")
    } else {
      codioIDE.coachBot.write("**DEBUG - WARNING: No context info collected!**")
    }

    // the messages object that will contain the user prompt and/or any assistant responses to be sent to the LLM - will also maintain history
    // Refer to Anthropic's guide on the messages API here: https://docs.anthropic.com/en/api/messages
    let messages = []

    while (true) {

      // receive text input from chat
      const input = await codioIDE.coachBot.input()

      // Define your conditions to exit infinte loop
      if (input == "Thanks" || input.toLowerCase() == "thanks") {
        break
      }

      // On first message, include all context information
      const userContent = messages.length === 0 && contextInfo
        ? input + contextInfo
        : input

      messages.push({
          "role": "user",
          "content": userContent
      })

      // Send the API request to the LLM with all prompts and messages
      // Prevent menu: true keeps the loop going until gracefully exited
      const result = await codioIDE.coachBot.ask({
        systemPrompt: systemPrompt,
        messages: messages
      }, {preventMenu: true})

      // Saving assistant response to maintain conversation history as context for next message
      messages.push({"role": "assistant", "content": result.result})

      // Trims message history to last 5 interactions
      if (messages.length > 10) {
        var removedElements = messages.splice(0,2)
      }

    }
    // After loop exit, print custom message and show menu
    codioIDE.coachBot.write("You're welcome! Please feel free to ask any more questions about this course!")
    codioIDE.coachBot.showMenu()
    
  }
// calling the function immediately by passing the required variables
})(window.codioIDE, window)

 

  
  
