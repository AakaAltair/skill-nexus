// /home/user/skill-fire/app/api/nexai/route.ts

import { NextRequest, NextResponse } from "next/server";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  Part, // Represents parts of a message (text, functionCall, functionResponse)
  Content // Represents a full message turn { role, parts }
} from "@google/generative-ai";
import { evaluate } from 'mathjs'; // For calculator tool

// --- Environment Variable Checks ---
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("GEMINI_API_KEY is not defined in environment variables");
}
const SEARCH_API_KEY = process.env.YOUR_SEARCH_API_KEY;
const SEARCH_ENGINE_ID = process.env.YOUR_SEARCH_ENGINE_ID; // Needed for Google CSE

if (!SEARCH_API_KEY || !SEARCH_ENGINE_ID) {
    console.warn("⚠️ Search API Key or Engine ID might be missing. Web search tool will fail.");
}

// --- Gemini Client Initialization ---
const genAI = new GoogleGenerativeAI(apiKey);

// --- System Prompt Definition ---
const system_prompt = `
You are Nexai, a friendly and intelligent tech mentor for students. Your goal is to help students discover their interests in tech, guide them on learning paths, recommend projects, and keep them updated on the latest tech trends.
You should be conversational, engaging, and motivational. Ensure you provide structured responses with clear guidance, insights, and encouragement. When asked to provide lists or comparisons (like courses), **present them in a clear tabular format using Markdown tables** if appropriate.

Key Features of Your Responses:
- Maintain a warm and friendly tone.
- Provide detailed explanations with examples.
- Keep track of previous conversation context to ensure continuity.
- Guide students through tech learning paths and career choices.
- Offer project suggestions based on student interests and skills.
- Keep students updated with the latest tech trends, tools, and opportunities using the web search tool when necessary.
- Use the calculator tool for mathematical calculations.
- If unable to find specific information (like course dates/costs) after searching, state that clearly but still present the information you *did* find.

### Few-Shot Examples to Handle Contextual Conversation:
[... Your Examples ...]
`.trim();

// System instruction object for Gemini API
const systemInstruction: Content = { role: "system", parts: [{ text: system_prompt }] };

// --- Tool Definitions (Keep Both) ---
const webSearchTool = {
    functionDeclarations: [ {
        name: "search_web",
        description: "Searches the web for recent information, news, articles, course listings, or answers to questions about current events or topics. Use this for latest trends, specific course details, or information beyond my training data. DO NOT use for math calculations.",
        parameters: { type: "object", properties: { query: { type: "string", description: "The specific question or topic to search." } }, required: ["query"] }
      } ]
};
const calculatorTool = {
    functionDeclarations: [ {
        name: "calculate",
        description: "Performs arithmetic calculations (addition, subtraction, multiplication, division, etc.). Use for queries like 'add 2 and 2', 'what is 5*8?'.",
        parameters: { type: "object", properties: { expression: { type: "string", description: "The mathematical expression to evaluate (e.g., '2+2', '4*4')." } }, required: ["expression"] }
      } ]
};

// --- Model Configuration ---
const modelConfig = {
  model: "gemini-1.5-pro-latest", // Keep Pro for better adherence
  tools: [webSearchTool, calculatorTool],
  systemInstruction: systemInstruction, // Applies the system prompt
};

// --- Generation Configuration ---
const generationConfig = {
  temperature: 0.7,
  maxOutputTokens: 4096,
};

// --- Function to Execute Tools ---
async function callTool(functionCall: any): Promise<Part> {
    const { name, args } = functionCall;
    let functionResponsePayload;
    console.log(`🤖 Tool Call Requested: ${name}`, args);
    try {
        if (name === "search_web") {
            // ... [Your REAL search implementation or MOCK] ...
            const searchQuery = args.query;
            if (!searchQuery) throw new Error("Search query missing.");
            if (!SEARCH_API_KEY || !SEARCH_ENGINE_ID) throw new Error("Search API Key/ID missing.");
            const apiUrl = `https://www.googleapis.com/customsearch/v1?key=${SEARCH_API_KEY}&cx=${SEARCH_ENGINE_ID}&q=${encodeURIComponent(searchQuery)}`;
            console.log(`🔍 Calling Search API...`);
            const searchResponse = await fetch(apiUrl);
            if (!searchResponse.ok) { const body = await searchResponse.text(); throw new Error(`Search API Error ${searchResponse.status}: ${body}`); }
            const data = await searchResponse.json();
            if (data.error) { throw new Error(`Search API Returned Error: ${data.error.message}`); }
            if (!data.items || data.items.length === 0) {
                functionResponsePayload = { status: "success_no_results", results: [], message: `No web results for "${searchQuery}".` };
            } else {
                const results = data.items.slice(0, 5).map((item: any) => ({ title: item.title, link: item.link, snippet: item.snippet }));
                functionResponsePayload = { status: "success", results: results, message: `Found ${results.length} results.` };
            }
        } else if (name === "calculate") {
            // ... [Calculation logic using mathjs] ...
             const expression = args.expression;
             if (!expression) throw new Error("Calculation expression missing.");
             try {
                const result = evaluate(expression);
                const resultString = typeof result === 'number' ? result.toString() : JSON.stringify(result);
                functionResponsePayload = { status: "success", result: resultString, message: `Calculated.` };
             } catch (mathError: any) { functionResponsePayload = { status: "error", message: `Calculation failed: ${mathError.message}` }; }
        } else {
             console.warn(`Function ${name} not implemented!`);
             functionResponsePayload = { status: "error", message: `Function '${name}' not implemented.` };
        }
    } catch (error: any) {
         console.error(`❌ Error executing tool '${name}':`, error);
         functionResponsePayload = { status: "error", message: `Tool error: ${error.message}` };
    }
    return { functionResponse: { name, response: functionResponsePayload } };
}

// --- API Route Handler ---
export async function POST(req: NextRequest) {
  console.log("\n--- New Request ---");
  try {
    // --- 1. Parse Request ---
    const { message, history: clientHistory = [] } = await req.json();
    if (!message) return NextResponse.json({ response: "Message empty." }, { status: 400 });
    console.log("Received Message:", message);
    console.log("Received History Length:", clientHistory.length);

    // --- 2. Prepare Model ---
    if (typeof genAI === 'undefined') throw new Error("genAI not available.");
    const model = genAI.getGenerativeModel(modelConfig);

    // --- 3. Validate & Prepare History for startChat ---
    let validHistoryForStartChat: Content[] = [];
    if (Array.isArray(clientHistory) && clientHistory.length > 0) {
        const firstUserIndex = clientHistory.findIndex((item: any) => item?.role === 'user');
        if (firstUserIndex !== -1) {
            validHistoryForStartChat = clientHistory.slice(firstUserIndex).filter(
                (item: any): item is Content =>
                    item && (item.role === 'user' || item.role === 'model') && Array.isArray(item.parts) && item.parts.length > 0
            );
        }
    }
    console.log("History passed to startChat Length:", validHistoryForStartChat.length);

    // --- 4. Start Chat ---
    const chat = model.startChat({
      history: validHistoryForStartChat,
      generationConfig: generationConfig,
      // systemInstruction is in modelConfig
    });

    // --- 5. Send Message ---
    console.log("➡️ Sending message...");
    const result = await chat.sendMessage(message);
    const response = result.response;

    // --- 6. Handle Response ---
    if (!response || !response.candidates || response.candidates.length === 0) { /* ... Error handling ... */ }

    // --- 7. Check/Handle Function Calls ---
    const functionCalls = response.functionCalls();
    if (functionCalls && functionCalls.length > 0) {
        // ... [Function call execution loop] ...
        console.log(`⚙️ Function call(s): ${functionCalls.map(fc=>fc.name).join(',')}`);
        const functionResponses: Part[] = [];
        for (const funcCall of functionCalls) { functionResponses.push(await callTool(funcCall)); }
        console.log("➡️ Sending function response(s)...");
        const resultAfter = await chat.sendMessage(functionResponses);
        const finalResponse = resultAfter.response;
        if (!finalResponse || !finalResponse.candidates || finalResponse.candidates.length === 0) { /* ... Error ... */ }
        const text = finalResponse.text();
        console.log("✅ Final text response:", text ? text.substring(0,50)+'...' : '(Empty)');
        if (!text) { /* ... Error ... */ }
        return NextResponse.json({ response: text });
    } else {
        // --- 8. Handle Direct Response ---
        const text = response.text();
        console.log("✅ Direct text response:", text ? text.substring(0,50)+'...' : '(Empty)');
        if (!text) { /* ... Error ... */ }
        return NextResponse.json({ response: text });
    }
  } catch (error: any) {
    // --- 9. Catch-All Error Handling ---
    console.error("❌ API Route Error:", error);
    // ... [Error formatting and response] ...
     let errorMessage = error.message || "Unexpected error.";
     if (error.status === 429) errorMessage = "Rate limit exceeded.";
     const errorResponsePayload = { response: `Oops! ${errorMessage.substring(0, 200)}...` };
     return NextResponse.json(errorResponsePayload, { status: error.status === 429 ? 429 : 500 });
  }
}