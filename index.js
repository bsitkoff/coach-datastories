// Wrapping the whole extension in a JS function 
// (ensures all global variables set in this extension cannot be referenced outside its scope)
(async function(codioIDE, window) {
  
  // System prompt for Data Stories coach
  const systemPrompt = `You are a helpful data science coach for middle school students working on "Data Stories" projects using Jupyter notebooks.

Your students are learning to:
- Load and clean data using ds_helpers.py functions
- Find columns with fuzzy matching (ds.col(df, 'partial_name'))
- Calculate basic statistics (mean, median) 
- Create charts (bar charts, histograms, scatter plots)
- Write data stories that explain their findings

Key ds_helpers functions students use:
- ds.load_clean('file.csv') - loads and cleans data
- ds.columns_guide(df) - shows available column aliases
- ds.col(df, 'search_term') - finds columns by partial name
- Basic plotting: ds.bar_chart(), ds.scatter_plot(), ds.line_plot()

Common student challenges:
- Forgetting to use column aliases shown by columns_guide()
- Difficulty with fuzzy column matching syntax
- Not understanding the difference between mean and median
- Creating meaningful chart titles and labels
- Writing data stories that connect numbers to real-world meaning

Be encouraging, provide concrete examples, and guide students through the 9-step workflow in their notebooks. Always suggest checking ds.columns_guide(df) when students have column name issues.

When helping students, reference specific column names and data from the available datasets. Use their actual data to make examples relevant and concrete.`
  
  // Enhanced context building for data stories
  async function buildDataStoriesContext(baseContext) {
    let enhanced = {...baseContext}
    
    try {
      // Add ds_helpers.py summary
      const dsHelpersSummary = `
# ds_helpers.py Function Reference

## Data Loading & Cleaning
- ds.load_clean('file.csv') - Loads CSV/Excel, auto-cleans column names, converts data types
- ds.clean_columns(df) - Converts headers to snake_case
- ds.alias_columns(df) - Creates short, student-friendly column aliases

## Column Discovery  
- ds.columns_guide(df) - Shows mapping: alias ← original column name
- ds.col(df, 'search_term') - Fuzzy column finder (finds partial matches)

## Data Exploration
- ds.browse(df) - Interactive widget for filtering/exploring data
- ds.roles(df) - Categorizes columns (numeric, dates, categorical)

## Simple Plotting (for middle schoolers)
- ds.bar_chart(df, 'column', 'title') - Creates bar charts
- ds.scatter_plot(df, 'x_col', 'y_col', 'title') - Creates scatter plots  
- ds.line_plot(df, 'x_col', 'y_col', 'title') - Creates line plots

## Utilities
- ds.collapse_small_categories(series, top_n=10) - Groups low-frequency categories
`
      
      // Find CSV files and get previews
      const csvPreviews = await getCsvPreviews()
      
      // Combine contexts
      enhanced.dataStoriesContext = dsHelpersSummary + csvPreviews
      
    } catch (error) {
      console.log("Could not enhance context:", error)
    }
    
    return enhanced
  }
  
  // Get CSV file previews
  async function getCsvPreviews() {
    try {
      // Find CSV files in workspace
      const files = await codioIDE.workspace.getFileTree()
      const csvFiles = findCsvFiles(files)
      
      let previews = "\n# Available Data Files\n\n"
      
      for (const csvFile of csvFiles) {
        try {
          const content = await codioIDE.workspace.readFile(csvFile)
          const lines = content.split('\n').slice(0, 6) // header + 5 rows
          previews += `## ${csvFile}\n\`\`\`\n${lines.join('\n')}\n\`\`\`\n\n`
        } catch (err) {
          previews += `## ${csvFile}\n(Could not read file)\n\n`
        }
      }
      
      return previews
    } catch (error) {
      return "\n# Data Files\n(Could not scan for CSV files)\n"
    }
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
    
    // Function that automatically collects all available context 
    // returns the following object: {guidesPage, assignmentData, files, error}
    const context = await codioIDE.coachBot.getContext()
    
    // Enhanced context for data stories
    const enhancedContext = await buildDataStoriesContext(context)

    // the messages object that will contain the user prompt and/or any assistant responses to be sent to the LLM - will also maintain history
    // Refer to Anthropic's guide on the messages API here: https://docs.anthropic.com/en/api/messages
    let messages = []
    
    while (true) {

      // receive text input from chat
      const input = await codioIDE.coachBot.input()

      // Define your conditions to exit infinte loop 
      if (input == "Thanks") {
        break
      }
    
      // Add user prompt to messages object
      messages.push({
          "role": "user", 
          "content": input
      })
  
      // Send the API request to the LLM with all prompts and context 
      // Prevent menu: true keeps the loop going until gracefully exited
      const result = await codioIDE.coachBot.ask({
        systemPrompt: systemPrompt,
        messages: messages,
        context: enhancedContext
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

 

  
  
