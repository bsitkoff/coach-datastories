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
  
  // Optional: Try to get CSV file list (but don't break if this fails)
  async function tryGetCSVList() {
    try {
      const files = await codioIDE.workspace.getFileTree()
      const csvFiles = findCsvFiles(files)
      if (csvFiles.length > 0) {
        return "\n\nAvailable CSV files in workspace: " + csvFiles.join(", ")
      }
    } catch (error) {
      // Silently fail - this is optional context
    }
    return ""
  }

  // Helper to find CSV files in file tree
  function findCsvFiles(fileTree, path = '') {
    let csvFiles = []

    if (fileTree.children) {
      for (const item of fileTree.children) {
        const fullPath = path ? `${path}/${item.name}` : item.name
        if (item.type === 'file' && item.name.toLowerCase().endsWith('.csv')) {
          csvFiles.push(fullPath)
        } else if (item.type === 'directory') {
          csvFiles = csvFiles.concat(findCsvFiles(item, fullPath))
        }
      }
    }

    return csvFiles
  }

  // register(id: unique button id, name: name of button visible in Coach, function: function to call when button is clicked) 
  codioIDE.coachBot.register("iNeedHelpButton", "I have a question", onButtonPress)

  // function called when I have a question button is pressed
  async function onButtonPress() {

    // Get context from Codio (includes files, guides, assignments)
    const context = await codioIDE.coachBot.getContext()

    // Build additional context with CSV files
    const csvList = await tryGetCSVList()

    // Build context string to include in first message
    let contextInfo = ""

    // Add files from context if available
    if (context.files && Object.keys(context.files).length > 0) {
      contextInfo += "\n\n## Student's Files:\n"
      for (const [filename, content] of Object.entries(context.files)) {
        contextInfo += `\n### ${filename}\n\`\`\`\n${content}\n\`\`\`\n`
      }
    }

    // Add assignment data if available
    if (context.assignmentData) {
      contextInfo += "\n\n## Assignment Context:\n" + context.assignmentData
    }

    // Add CSV files list
    if (csvList) {
      contextInfo += csvList
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

 

  
  
