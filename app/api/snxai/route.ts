// /app/api/snxai/route.ts

import { NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/serverAuthUtils'; // Your helper to verify token
import { firestore } from '@/lib/firebaseAdmin'; // Import Firestore Admin SDK instance
// Import FieldValue for serverTimestamp
import { FieldValue } from 'firebase-admin/firestore';
import { GoogleGenerativeAI, Part, Content, FunctionDeclarationSchemaType } from '@google/generative-ai'; // Added types

// --- Tool Definitions ---
// Describe the function(s) the AI can call

const tools = [
  {
    functionDeclarations: [
      // Tool to get the logged-in user's profile details
      {
        name: 'getLoggedInUserProfile',
        description: "Retrieves the profile information (like name, headline, summary, skills list, etc.) for the currently logged-in user making the request.",
        parameters: { type: FunctionDeclarationSchemaType.OBJECT, properties: {} },
      },
      // Tool to search for projects
      {
          name: 'searchProjects',
          description: "Searches for projects on the platform based on keywords in title/description, specific skills, or current status.",
          parameters: {
              type: FunctionDeclarationSchemaType.OBJECT,
              properties: {
                  keyword: { type: FunctionDeclarationSchemaType.STRING, description: "Keywords to search in the project title or description." },
                  skill: { type: FunctionDeclarationSchemaType.STRING, description: "A specific skill associated with the project (e.g., 'React', 'Python', 'Firebase')." },
                  status: { type: FunctionDeclarationSchemaType.STRING, description: "Filter by project status (e.g., 'Planning', 'In Progress', 'Completed', 'Abandoned')." }
              },
              required: []
          }
      },
      // Tool: List Placement Drives
      {
          name: 'listPlacementDrives',
          description: "Finds open or closed placement drives by company name, role title, status, location, or eligible branch.",
          parameters: {
              type: FunctionDeclarationSchemaType.OBJECT,
              properties: {
                  company: { type: FunctionDeclarationSchemaType.STRING, description: "Search by company name (e.g., 'Google', 'Microsoft')." },
                  role: { type: FunctionDeclarationSchemaType.STRING, description: "Search by job role title (e.g., 'Software Engineer', 'Data Analyst')." },
                  status: { type: FunctionDeclarationSchemaType.STRING, description: "Filter by drive status (e.g., 'Open', 'Closed', 'Upcoming')." },
                  location: { type: FunctionDeclarationSchemaType.STRING, description: "Filter by location (e.g., 'Bangalore', 'Remote')." },
                  branch: { type: FunctionDeclarationSchemaType.STRING, description: "Filter by eligible engineering branch (e.g., 'CSE', 'IT', 'ECE')." },
                  keyword: { type: FunctionDeclarationSchemaType.STRING, description: "Keywords to search in the drive description." }
              },
              required: []
          }
      },
       // Tool: List Student Achievements
      {
           name: 'listAchievements',
           description: "Finds student achievement posts (success stories) by company name, role title, placed student's name, or skills mentioned.",
           parameters: {
               type: FunctionDeclarationSchemaType.OBJECT,
               properties: {
                   company: { type: FunctionDeclarationSchemaType.STRING, description: "Search by company name the student was placed in (e.g., 'Amazon', 'Infosys')." },
                   role: { type: FunctionDeclarationSchemaType.STRING, description: "Search by the role title the student was placed in." },
                   studentName: { type: FunctionDeclarationSchemaType.STRING, description: "Search by the name of the student who was placed." },
                   skill: { type: FunctionDeclarationSchemaType.STRING, description: "Search for achievements mentioning a specific skill." },
                   location: { type: FunctionDeclarationSchemaType.STRING, description: "Filter by the location mentioned in the achievement." },
                   keyword: { type: FunctionDeclarationSchemaType.STRING, description: "Keywords to search in the achievement text/description." }
               },
               required: []
           }
       },
        // Tool: Search Resources
        {
            name: 'searchResources',
            description: "Searches for shared resources (links, documents) based on keywords, type, branch, year, subject, or tags.",
            parameters: {
                type: FunctionDeclarationSchemaType.OBJECT,
                properties: {
                    keyword: { type: FunctionDeclarationSchemaType.STRING, description: "Keywords to search in the resource title or description." },
                    type: { type: FunctionDeclarationSchemaType.STRING, description: "Filter by resource type (e.g., 'Notes', 'Video', 'Book', 'Question Paper')." },
                    branch: { type: FunctionDeclarationSchemaType.STRING, description: "Filter by engineering branch (e.g., 'CSE', 'IT', 'ECE')." },
                    year: { type: FunctionDeclarationSchemaType.STRING, description: "Filter by academic year (e.g., '1', '2', '3', '4')." },
                    subject: { type: FunctionDeclarationSchemaType.STRING, description: "Filter by subject name (e.g., 'Data Structures', 'Operating Systems')." },
                    tag: { type: FunctionDeclarationSchemaType.STRING, description: "Filter by a specific tag associated with the resource." }
                },
                required: []
            }
        },
       // Tool: Update Profile Summary
       {
           name: 'updateMyProfileSummary',
           description: "Updates the 'summary' section of the logged-in user's profile.",
           parameters: {
               type: FunctionDeclarationSchemaType.OBJECT,
               properties: {
                   newSummary: {
                       type: FunctionDeclarationSchemaType.STRING,
                       description: "The new text content for the profile summary section."
                   }
               },
               required: ['newSummary']
           }
       },
       // Tool: Initiate Project Creation (Triggers UI)
       {
           name: 'initiateCreateProject',
           description: "Starts the process for the user to create a new project. Use this when the user expresses intent to create a project. This will open a form for the user to fill in the details.",
           parameters: {
               type: FunctionDeclarationSchemaType.OBJECT,
               properties: {
                   initialTitle: {
                       type: FunctionDeclarationSchemaType.STRING,
                       description: "An optional initial title for the project, if the user mentioned one."
                   },
                   // Add other potential initial fields if the AI can extract them reliably
                   // initialDescription: { type: FunctionDeclarationSchemaType.STRING },
                   // initialType: { type: FunctionDeclarationSchemaType.STRING },
               },
               required: [] // No required parameters for the AI to *call* the trigger
           }
       },
      // Tool: Create Community Post - This triggers a UI action
      {
          name: 'createCommunityPost',
          description: "Initiates the process to create a new post on the Community Feed. This tool informs the user it will open a form to gather details for the post.",
          parameters: {
              type: FunctionDeclarationSchemaType.OBJECT,
              properties: {
                  textContent: { type: FunctionDeclarationSchemaType.STRING, description: "The main text content for the post (can be empty if only media/link)." },
                  linkUrl: { type: FunctionDeclarationSchemaType.STRING, description: "A URL to include with the post." },
                  category: { type: FunctionDeclarationSchemaType.STRING, description: "A category for the post (e.g., 'Event', 'Announcement', 'Discussion')." },
                  isEvent: { type: FunctionDeclarationSchemaType.BOOLEAN, description: "Set to true if the post is an event announcement." },
                  eventDetails: { type: FunctionDeclarationSchemaType.OBJECT, description: "Details for an event post, including date and location.", properties: { date: { type: FunctionDeclarationSchemaType.STRING }, location: { type: FunctionDeclarationSchemaType.STRING } }, required: ['date', 'location'] }
              },
              required: []
          }
      },
      // Tool: Open Modal On Frontend (General UI trigger)
       {
        name: 'openModalOnFrontend',
        description: "Use this function to ask the user's interface (frontend) to open a specific modal dialog. This is useful for complex data entry (like creating a project) or confirmations (like deleting an item). Do NOT call this to get data, only to display a UI element.",
        parameters: {
          type: FunctionDeclarationSchemaType.OBJECT,
          properties: {
              modalId: { type: FunctionDeclarationSchemaType.STRING, description: "The unique identifier of the modal to open (e.g., 'createProjectForm', 'editSummary', 'confirmDelete', 'createCommunityPostForm')." },
              modalProps: { type: FunctionDeclarationSchemaType.OBJECT, description: "Optional data or configuration to pass to the modal content component." }
          },
          required: ['modalId']
        }
      },
      // Add more tool declarations here as needed...
    ],
  },
];

// --- Initialize Gemini ---
if (!process.env.GEMINI_API_KEY) { console.error("FATAL ERROR: GEMINI_API_KEY environment variable not set."); }
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash', tools: tools });

// --- Helper: getUserBasicInfo ---
async function getUserBasicInfo(userId: string): Promise<{ displayName: string; photoURL: string } | null> {
    try {
        const profileCollection = 'studentProfiles'; // Ensure this is the correct collection
        const userDoc = await firestore.collection(profileCollection).doc(userId).get();
        if (!userDoc.exists) return null;
        const data = userDoc.data();
        return {
            displayName: data?.displayName || data?.name || 'Anonymous',
            photoURL: data?.photoURL || ''
        };
    } catch (error) {
        console.error(`Error fetching basic user info for ${userId}:`, error);
        return null;
    }
}


// --- Main POST Handler ---
export async function POST(request: Request) {
    let currentUser;
    try { currentUser = await authenticateUser(request); if (!currentUser) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 }); }
    catch (error: any) { console.error('Authentication error:', error); return NextResponse.json({ message: 'Authentication Failed', error: error.message }, { status: 401 }); }

    let message: string;
    let history: any[];
    try { const body = await request.json(); message = body.message; history = body.history; if (!message) return NextResponse.json({ message: 'Message is required' }, { status: 400 }); }
    catch (error) { console.error('Error parsing request body:', error); return NextResponse.json({ message: 'Invalid request body.' }, { status: 400 }); }

    console.log(`SNXai request from ${currentUser.uid}: "${message}"`);

  try {
    const formattedHistory: Content[] = (Array.isArray(history) ? history : [])
        .filter(turn => turn && turn.role && Array.isArray(turn.parts))
        .map((turn: any) => ({ role: turn.role === 'user' ? 'user' : 'model', parts: turn.parts.filter((part: any) => part && typeof part.text === 'string') })) || [];

    const chat = model.startChat({ history: formattedHistory });

    console.log('Sending message to Gemini:', message);
    let result = await chat.sendMessage(message);
    let response = result.response;
    console.log('Gemini initial response:', JSON.stringify(response, null, 2));

    while (response.functionCalls && response.functionCalls()) {
        const functionCalls = response.functionCalls();
        console.log(`Gemini requested ${functionCalls.length} function call(s):`, JSON.stringify(functionCalls, null, 2));

        const toolResponses: Part[] = [];
        const backendToolCalls = [];
        let uiActionResponse: NextResponse | null = null;

        for (const call of functionCalls) {
            // --- Special Handling for UI/Form Triggers ---
            if (call.name === 'openModalOnFrontend') {
                console.log(`AI requested UI action: ${call.name}`);
                const { modalId, modalProps } = call.args;
                if (!modalId || typeof modalId !== 'string') { console.error('Error: openModalOnFrontend called without valid modalId'); uiActionResponse = NextResponse.json({ aiMessage: "I tried to open a modal, but couldn't identify which one."}); break; }
                uiActionResponse = NextResponse.json({ aiMessage: `Okay, opening the ${modalId.replace(/([A-Z])/g, ' $1').toLowerCase()}...`, action: { type: 'openModal', modalId: modalId, data: modalProps || {} } }); break;
            } else if (call.name === 'createCommunityPost') {
                console.log(`AI requested tool ${call.name}, translating to UI action.`);
                const initialFormData = call.args || {};
                uiActionResponse = NextResponse.json({ aiMessage: "Okay, I can help draft a community post. I'll open the form.", action: { type: 'openModal', modalId: 'createCommunityPostForm', data: { initialData: initialFormData } } }); break;
            } else if (call.name === 'initiateCreateProject') { // <<< NEW Interception
                 console.log(`AI requested tool ${call.name}, translating to UI action.`);
                 const initialProjectData = call.args || {};
                 uiActionResponse = NextResponse.json({ aiMessage: "Sure, let's get your new project set up. I'll open the form.", action: { type: 'openModal', modalId: 'createProjectForm', data: { initialData: initialProjectData } } }); break;
            }
            // --- End Special Handling ---
            else {
                backendToolCalls.push(call); // Add to backend execution list
            }
        }

        if (uiActionResponse) { console.log('Returning UI Action Response.'); return uiActionResponse; }

        // --- Execute Backend Tools ---
        if (backendToolCalls.length > 0) {
             console.log(`Executing ${backendToolCalls.length} backend tool(s)...`);
             const toolExecutionPromises = backendToolCalls.map(async (call) => {
                console.log(`Executing tool: ${call.name} with args:`, call.args);
                try {
                    const toolResult = await callTool(call.name, call.args, currentUser.uid);
                    const serializableResult = toolResult === undefined ? null : toolResult;
                    return { functionResponse: { name: call.name, response: { content: serializableResult } } };
                } catch (toolError: any) {
                    console.error(`Error executing tool ${call.name} for user ${currentUser.uid}:`, toolError);
                    return { functionResponse: { name: call.name, response: { content: { error: `Tool execution failed: ${toolError.message || 'Unknown error'}` } } };
                }
             });
             const resolvedToolResponses = await Promise.all(toolExecutionPromises);
             toolResponses.push(...resolvedToolResponses);

             console.log('Sending tool responses to Gemini:', JSON.stringify(toolResponses, null, 2));
             result = await chat.sendMessage(toolResponses);
             response = result.response;
             console.log('Gemini response after tool execution:', JSON.stringify(response, null, 2));
        } else {
             console.warn("Function calls requested, but no backend tools executed or UI actions returned.");
             return NextResponse.json({ aiMessage: "I received an instruction, but I couldn't process it correctly." });
        }
    } // End of while loop

    // --- Final Response Handling ---
    if (response.text()) {
      console.log('Final AI text response:', response.text());
      return NextResponse.json({ aiMessage: response.text() });
    } else {
      console.error('AI response finished without text content after loop:', response);
       const finishReason = response.candidates?.[0]?.finishReason;
       const safetyRatings = response.candidates?.[0]?.safetyRatings;
       console.error(`Finish Reason: ${finishReason}, Safety Ratings: ${JSON.stringify(safetyRatings)}`);
       let errorMessage = "I processed the information but couldn't generate a final text response.";
       if (finishReason === 'SAFETY') errorMessage = "My response was blocked due to safety settings.";
       else if (finishReason === 'RECITATION') errorMessage = "My response was blocked due to potential recitation issues.";
       else if (finishReason === 'MAX_TOKENS') errorMessage = "The response became too long.";
       else if (finishReason === 'TOOL_FUNCTION_REPEAT') errorMessage = "I got stuck trying to use a tool repeatedly.";
       else if (finishReason === 'OTHER') errorMessage = "An unexpected issue occurred.";
      return NextResponse.json({ aiMessage: errorMessage });
    }

  } catch (error: any) {
    console.error('Error in SNXai API processing:', error);
    if (error.response && error.response.promptFeedback?.blockReason === 'SAFETY') { return NextResponse.json({ aiMessage: "I cannot process that request due to safety guidelines." }, { status: 400 }); }
    if (error.message?.includes('SAFETY')) { return NextResponse.json({ aiMessage: "I can't respond to that query due to safety considerations." }, { status: 400 }); }
    return NextResponse.json({ message: 'Internal Server Error processing AI response', error: error.message }, { status: 500 });
  }
}


// ===============================================
// --- Helper Function to Execute Backend Tools ---
// ===============================================
async function callTool(toolName: string, toolArgs: any, userId: string): Promise<any> {
  console.log(`---> Executing Tool: ${toolName} for user ${userId} with args:`, toolArgs);

  const profileCollection = 'studentProfiles'; // CHANGE IF YOUR PROFILE DATA IS ELSEWHERE

  switch (toolName) {
    case 'getLoggedInUserProfile':
        try { /* ... implementation ... */ } catch (error: any) { /* ... */ }
        break;
    case 'updateMyProfileSummary':
        try { /* ... implementation ... */ } catch (error: any) { /* ... */ }
        break;
    case 'searchProjects':
        try { /* ... implementation ... */ } catch (error: any) { /* ... */ }
        break;
    case 'listPlacementDrives':
        try { /* ... implementation ... */ } catch (error: any) { /* ... */ }
        break;
     case 'listAchievements':
        try { /* ... implementation ... */ } catch (error: any) { /* ... */ }
        break;
     case 'searchResources':
        try { /* ... implementation ... */ } catch (error: any) { /* ... */ }
        break;

    // Note: 'createCommunityPost' and 'initiateCreateProject' are handled before this switch

    default:
      console.warn(`Unknown tool requested by AI: ${toolName}`);
      return { status: 'error', message: `The requested action ('${toolName}') is not supported.` };
  }
}