// components/LearningEntryFormModal.tsx
"use client";

import React, { useState, useEffect, FormEvent, useCallback, useRef, ChangeEvent, DragEvent } from 'react';
import { User } from 'firebase/auth';
// Import types for Learning Entry and Custom Fields
import { StudentLearningEntry, CustomLearningField, Attachment } from '@/lib/types/learning';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
// Assuming you have a generic Modal component
import Modal from '@/components/Modal'; // Adjust path if needed
// Assuming date-fns or similar for date formatting/parsing
import { format } from 'date-fns'; // For formatting date input default value
// Optional: Only needed if rendering markdown *within the form* (e.g., preview)
// import ReactMarkdown from 'react-markdown';
// import remarkGfm from 'remark-gfm';

// Helper component for rendering individual custom field inputs
import CustomFieldInput from './CustomFieldInput'; // Adjust path if needed

// Interface for temporary file info (matches the one used in stream component)
// This is what we store in the formData state for file inputs
interface TempFile {
    file: File;
    id: string; // Unique ID (like field name or custom field ID)
    previewUrl?: string; // Data URL for image previews
}

// Valid file types accepted by the form (can be refined)
const ALLOWED_FILE_TYPES = "image/*,application/pdf,.doc,.docx,.txt,.zip,.csv,.xls,.xlsx,.ppt,.pptx";
// Define limits
const MAX_FILES_TOTAL = 10; // Example total limit across all file inputs
const MAX_FILE_SIZE_MB = 20; // Example max size per individual file in MB
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024; // Convert to bytes


// Predefined options for standard dropdowns (copied from create page)
const yearOptions = [
    { value: 'FY', label: 'FY (1st Year)' },
    { value: 'SY', label: 'SY (2nd Year)' },
    { value: 'TY', label: 'TY (3rd Year)' },
    { value: 'LY', label: 'LY (4th Year)' },
];
const learningTypeOptions = [
    { value: 'PBL', label: 'PBL (Project Based Learning)' },
    { value: 'SBL', label: 'SBL (Skill Based Learning)' },
    { value: 'TBL', label: 'TBL (Tasked Based Learning)' },
     { value: 'Custom', label: 'Custom Type...' }, // Option to enter a custom type
];


interface LearningEntryFormModalProps {
    classroomId: string;
    // entryId is optional: present for editing, null for creating
    entryId: string | null;
    currentUser: User | null; // The logged-in user (should be the student creating/editing)
    isTeacher: boolean; // Indicates if the current user is a teacher (teachers don't use this form)
    onClose: () => void; // Handler to close the modal
    onSuccess: () => void; // Handler to call after successful save/update (triggers refetch in parent)
}

const LearningEntryFormModal: React.FC<LearningEntryFormModalProps> = ({
    classroomId,
    entryId, // If provided, it's edit mode
    currentUser, // The student user
    isTeacher, // Should be false if form is accessible
    onClose,
    onSuccess,
}) => {
    const isEditMode = !!entryId; // Determine if it's edit mode

    // --- Form Data State ---
    // Using a single state object for all form data for simpler updates
    const [formData, setFormData] = useState<{
        title: string;
        entryDate: string; // YYYY-MM-DD format for date input
        weekNumber: number | undefined;
        learningType: string; // Can be 'PBL', 'SBL', 'TBL', 'Custom', or a custom string
        customLearningTypeText: string; // State for the custom type input
        tasksPerformed: string;
        planning: string;
        nextSteps: string;
        challenges: string;
        learning: string;
        durationHours: number | undefined;
        links: string[]; // Array of link strings (from textarea)
        isSubmitted: boolean;
        submissionDate: string | null; // YYYY-MM-DD string or null

        // State for Main File Uploads (Temporary files - stores TempFile or null)
        reportFile: TempFile | null;
        presentationFile: TempFile | null;
        certificateFile: TempFile | null;

        // State for Custom Fields Data - Keyed by Custom Field ID (stores any type of value including TempFile for file fields)
        customFieldsData: { [key: string]: any };

    }>({
        title: '',
        entryDate: format(new Date(), 'yyyy-MM-dd'), // Default to today's date
        weekNumber: undefined,
        learningType: learningTypeOptions[0]?.value || '', // Default to first option value
        customLearningTypeText: '', // Initialize custom type state
        tasksPerformed: '',
        planning: '',
        nextSteps: '',
        challenges: '',
        learning: '',
        durationHours: undefined,
        links: [],
        isSubmitted: false,
        submissionDate: null, // Null by default

        // Initialize temporary file states
        reportFile: null,
        presentationFile: null,
        certificateFile: null,

        // Initialize custom fields data object
        customFieldsData: {},
    });

    // --- State for Loading/Error ---
    // Loading state for initial data fetches (entry data if editing, custom fields always)
    const [isLoadingInitialData, setIsLoadingInitialData] = useState(true); // Combined initial loading
    const [isSubmitting, setIsSubmitting] = useState(false); // Loading state for form submission
    const [error, setError] = useState<string | null>(null); // General error state for form/submission
    const [successMessage, setSuccessMessage] = useState<string | null>(null); // Optional success message (less common in modals)

    // --- State for Custom Fields Definition ---
    const [customFields, setCustomFields] = useState<CustomLearningField[]>([]);
    // No separate error needed for custom fields fetch; will use general error state


    // --- Auth Check (Basic client-side, API enforces) ---
    // This form should only be accessible to students.
    // Parent component (`LearningClassroomEntries`) already handles preventing teacher access,
    // but adding a check here makes the modal component safer in isolation.
    // We can rely on the parent not rendering this modal for teachers/unauthenticated.
    // Returning null here as a final safeguard.
    if (!currentUser || isTeacher) {
        console.warn("LearningEntryFormModal accessed by unauthorized user.");
        return null;
    }

    // --- Effects ---

    // Effect 1 & 2: Fetch Custom Fields and Entry Data (Combined Fetch)
    useEffect(() => {
        if (!classroomId || !currentUser) {
            setError("Missing Classroom ID or user information.");
            setIsLoadingInitialData(false);
            return;
        }
        // If editing, ensure entryId is also available
        if (isEditMode && !entryId) {
             setError("Missing Entry ID for editing.");
             setIsLoadingInitialData(false);
             return;
        }

        setIsLoadingInitialData(true);
        setError(null);
        setCustomFields([]); // Clear previous fields
        // Reset form data to initial defaults before fetching
        setFormData({
            title: '', entryDate: format(new Date(), 'yyyy-MM-dd'), weekNumber: undefined,
            learningType: learningTypeOptions[0]?.value || '', customLearningTypeText: '',
            tasksPerformed: '', planning: '', nextSteps: '', challenges: '', learning: '',
            durationHours: undefined, links: [], isSubmitted: false, submissionDate: null,
            reportFile: null, presentationFile: null, certificateFile: null,
            customFieldsData: {},
        });


        const fetchInitialData = async () => {
            try {
                const idToken = await currentUser.getIdToken(true);
                const headers = { 'Authorization': `Bearer ${idToken}` };

                // Fetch custom fields
                const customFieldsPromise = fetch(`/api/learning-classrooms/${classroomId}/custom-fields`, { headers })
                    .then(res => {
                         if (!res.ok) {
                             const errData = res.json().catch(() => ({}));
                             throw new Error(errData.message || `Failed to fetch custom fields (${res.status})`);
                         }
                         return res.json();
                     });

                let entryPromise = Promise.resolve({ entry: null }); // Default to resolved promise with null entry
                if (isEditMode) {
                    // Fetch entry data if in edit mode
                    entryPromise = fetch(`/api/learning-classrooms/${classroomId}/learning-entries/${entryId}`, { headers })
                         .then(res => {
                              if (!res.ok) {
                                   const errData = res.json().catch(() => ({}));
                                   throw new Error(errData.message || `Failed to fetch entry (${res.status})`);
                              }
                              return res.json();
                          });
                }

                // Use Promise.all to fetch custom fields and entry data concurrently
                const [customFieldsResult, entryResult] = await Promise.all([customFieldsPromise, entryPromise]);

                // Process custom fields result
                let fetchedCustomFields: CustomLearningField[] = [];
                if (customFieldsResult.customFields && Array.isArray(customFieldsResult.customFields)) {
                    fetchedCustomFields = customFieldsResult.customFields.sort((a: CustomLearningField, b: CustomLearningField) => (a.order ?? 0) - (b.order ?? 0));
                    setCustomFields(fetchedCustomFields);
                } else {
                     console.warn("Received unexpected data format for custom fields:", customFieldsResult);
                }

                // Process entry data result (if in edit mode)
                if (isEditMode) {
                    if (entryResult?.entry) {
                         const entry = entryResult.entry as StudentLearningEntry;
                         console.log("Fetched entry data:", entry);

                         // Populate form state with fetched entry data
                         setFormData(prev => {
                             // Handle potential 'Custom' learning type
                             const isDefaultType = learningTypeOptions.some(opt => opt.value === entry.learningType);
                             const initialLearningType = isDefaultType ? entry.learningType : 'Custom';
                             const initialCustomLearningTypeText = isDefaultType ? '' : entry.learningType || '';

                             // Initialize customFieldsData based on fetched custom fields and entry data
                             const initialCustomData: { [key: string]: any } = {};
                              fetchedCustomFields.forEach(field => {
                                 const fetchedValue = entry.customFieldsData?.[field.id]; // Get value from fetched entry data
                                  // Handle file type specifically: if fetched value is metadata, create TempFile
                                  if (field.fieldType === 'file' && fetchedValue && typeof fetchedValue === 'object' && 'filename' in fetchedValue && 'size' in fetchedValue && 'fileType' in fetchedValue) {
                                       initialCustomData[field.id] = {
                                          id: field.id,
                                           file: { // Simulate File object structure
                                              name: fetchedValue.filename || 'Attached File',
                                              size: fetchedValue.size || 0,
                                              type: fetchedValue.fileType || '',
                                          } as File, // Cast for type compatibility
                                         previewUrl: undefined, // Previews not loaded on fetch
                                       } as TempFile; // Cast to TempFile
                                   }
                                  else {
                                      // For other types, use the fetched value directly, or default if not found
                                      initialCustomData[field.id] = fetchedValue !== undefined && fetchedValue !== null ? fetchedValue : (field.fieldType === 'checkbox' ? false : ''); // Default non-file types
                                   }
                             });

                            return {
                                ...prev, // Keep any initial default state not overwritten
                                title: entry.title || '',
                                entryDate: entry.entryDate ? format(new Date(entry.entryDate.toString()), 'yyyy-MM-dd') : '',
                                weekNumber: entry.weekNumber,
                                learningType: initialLearningType,
                                customLearningTypeText: initialCustomLearningTypeText,
                                tasksPerformed: entry.tasksPerformed || '',
                                planning: entry.planning || '',
                                nextSteps: entry.nextSteps || '',
                                challenges: entry.challenges || '',
                                learning: entry.learning || '',
                                durationHours: entry.durationHours,
                                links: Array.isArray(entry.links) ? entry.links : [],
                                isSubmitted: entry.isSubmitted ?? false,
                                submissionDate: entry.submissionDate ? format(new Date(entry.submissionDate.toString()), 'yyyy-MM-dd') : null,
                                // Populate customFieldsData from the entry (overwriting initial defaults)
                                customFieldsData: initialCustomData, // Use the data populated from fetched entry

                                // Populate temporary file state for main files from fetched metadata
                                // Assuming fetched entry includes metadata if file was attached
                                reportFile: entry.reportFileMetadata ? { id: 'reportFile', file: { name: entry.reportFileMetadata.filename || 'Report', size: entry.reportFileMetadata.size || 0, type: entry.reportFileMetadata.fileType || '' } as File, previewUrl: undefined } : null,
                                presentationFile: entry.presentationFileMetadata ? { id: 'presentationFile', file: { name: entry.presentationFileMetadata.filename || 'Presentation', size: entry.presentationFileMetadata.size || 0, type: entry.presentationFileMetadata.fileType || '' } as File, previewUrl: undefined } : null,
                                certificateFile: entry.certificateFileMetadata ? { id: 'certificateFile', file: { name: entry.certificateFileMetadata.filename || 'Certificate', size: entry.certificateFileMetadata.size || 0, type: entry.certificateFileMetadata.fileType || '' } as File, previewUrl: undefined } : null,
                                // TODO: Populate additional files state if they were saved separately or in customFieldsData

                            };
                        });
                    } else {
                        // Handle entry fetch failure in edit mode
                        throw new Error(entryResult?.message || "Could not load entry data for editing.");
                    }
                } else {
                     // If not edit mode, custom fields are already set, just turn off loading
                     // Initialize customFieldsData here if not edit mode
                     setFormData(prev => {
                         const initialCustomData: { [key: string]: any } = {};
                         fetchedCustomFields.forEach(field => {
                             if (field.fieldType === 'checkbox') initialCustomData[field.id] = false;
                             else if (field.fieldType === 'file') initialCustomData[field.id] = null;
                             else if (field.fieldType === 'number') initialCustomData[field.id] = '';
                             else initialCustomData[field.id] = '';
                         });
                         return { ...prev, customFieldsData: { ...initialCustomData, ...(prev.customFieldsData || {}) } }; // Merge with any defaults
                     });
                }


            } catch (err: any) {
                 console.error("❌ Error fetching initial data:", err);
                 setError(err.message || "Could not load form data.");
            } finally {
                 setIsLoadingInitialData(false);
                 console.log("Initial Data Fetch complete.");
            }
        };

        fetchInitialData();

         // Dependencies: Re-run when classroomId, entryId, isEditMode, currentUser change.
         // No need to include customFields in dependencies here, as their fetch is part of this effect
    }, [classroomId, entryId, isEditMode, currentUser]);


    // --- Handlers ---

    // Handle changes for standard inputs (text, number, select, textarea, date) and checkbox
    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;

        setFormData(prev => {
             const newState = { ...prev };

             if (type === 'checkbox') {
                newState[name as keyof typeof newState] = (e.target as HTMLInputElement).checked;
                 // If 'isSubmitted' is checked and submissionDate is null, set it to today
                 if (name === 'isSubmitted' && (e.target as HTMLInputElement).checked && !prev.submissionDate) {
                     newState.submissionDate = format(new Date(), 'yyyy-MM-dd');
                 } else if (name === 'isSubmitted' && !(e.target as HTMLInputElement).checked) {
                     // If unchecked, clear submission date? Policy decision. Let's keep it unless manually cleared.
                 }

            } else if (type === 'number') {
                 // Convert number input value to number or undefined
                 const numValue = parseFloat(value);
                 newState[name as keyof typeof newState] = isNaN(numValue) || value.trim() === '' ? undefined : numValue; // Use undefined for empty/invalid number
            } else if (name === 'learningType') {
                // Special handling for learningType select change
                newState.learningType = value;
                 // If the user switches *away* from 'Custom', clear the custom text state
                 if (value !== 'Custom') {
                     newState.customLearningTypeText = '';
                 }
             } else if (name === 'submissionDate') {
                  // Handle manual change of submission date (only if isSubmitted is true)
                  newState.submissionDate = value || null; // Allow clearing date field
                  if(value) newState.isSubmitted = true; // Automatically mark as submitted if date is set
             }
            else {
                // Standard text, textarea, date, url inputs
                newState[name as keyof typeof newState] = value;
            }
             return newState;
         });

        setError(null); // Clear errors on input
         setSuccessMessage(null);
    }, []); // No dependencies if state updater function is used correctly


     // Handle changes for custom field inputs (passed down to CustomFieldInput component)
     // This handler receives the fieldId and the new value (which can be string, number, boolean, TempFile)
     const handleCustomFieldChange = useCallback((fieldId: string, value: any) => {
         console.log(`Handling custom field change for ${fieldId}:`, value);
         // Find the field definition to check its type (especially for 'file')
          const fieldDefinition = customFields.find(f => f.id === fieldId);
           if (!fieldDefinition) {
               console.warn(`Custom field definition not found for ID: ${fieldId}`);
               return; // Should not happen
           }

          setFormData(prev => ({
              ...prev,
             customFieldsData: {
                 ...prev.customFieldsData,
                  [fieldId]: value, // Store the raw value (string, number, boolean, TempFile, null)
             },
         }));
         setError(null);
     }, [customFields]); // Dependency on customFields to access field definitions


     // Handle changes for the specific main file inputs (Report, Presentation, Certificate)
     // This handler creates a TempFile object and updates the specific file field in formData state.
     const handleMainFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>, fieldName: 'reportFile' | 'presentationFile' | 'certificateFile')) => {
         const file = e.target.files?.[0] || null;
         // Clear the file input value immediately to allow selecting the same file again
         if (e.target) e.target.value = '';

         if (!file) {
             // If file was cleared or nothing selected
             setFormData(prev => ({ ...prev, [fieldName]: null }));
             setError(null); // Clear potential previous file errors
             return;
         }

         // Basic file validation (size)
         const maxSizeMB = MAX_FILE_SIZE_MB;
         // TODO: Implement total file count check across all main files and additional files
         // const currentTotalFiles = (formData.reportFile ? 1 : 0) + (formData.presentationFile ? 1 : 0) + (formData.certificateFile ? 1 : 0) + (formData.additionalFiles?.length || 0);
         // if (currentTotalFiles >= MAX_FILES_TOTAL) { ... set error ... return; }

         if (file.size > MAX_FILE_SIZE_BYTES) { // Use BYTES constant
             setError(`File "${file.name}" exceeds the maximum size of ${MAX_FILE_SIZE_MB}MB.`);
              setFormData(prev => ({ ...prev, [fieldName]: null })); // Clear invalid file from state
             return;
         }
          // Optional: More specific type validation based on the expected file type for the main field (e.g., accept only PDF/DOC for Report)


         // Create temporary file object, generate preview if image
         const newTempFile: TempFile = { file: file, id: fieldName }; // Use fieldName as TempFile ID

         if (file.type.startsWith("image/")) {
              const reader = new FileReader();
              reader.onloadend = () => {
                  if (typeof reader.result === 'string') {
                      setFormData(prev => ({
                           ...prev,
                           [fieldName]: { ...newTempFile, previewUrl: reader.result }
                        }));
                  } else {
                       // Handle non-string result error or fallback
                       setFormData(prev => ({ ...prev, [fieldName]: newTempFile }));
                  }
              };
              reader.onerror = () => {
                  console.error("Error reading file:", file.name);
                  setFormData(prev => ({ ...prev, [fieldName]: newTempFile })); // Save without preview on error
              };
              reader.readAsDataURL(file);
         } else {
             setFormData(prev => ({ ...prev, [fieldName]: newTempFile })); // Save file without preview
         }

         setError(null); // Clear general errors


     }, []); // No dependencies needed if using functional state updates


    // TODO: Add handlers for additionalFiles (drag/drop or file input for 'file' custom fields)
    // This logic will live inside CustomFieldInput when type='file' is fully implemented there.


    // --- Form Submission ---
    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        setIsSubmitting(true);
        setError(null);
        setSuccessMessage(null);

        // --- Client-side Validation ---
        // Check required standard fields
        if (!formData.title.trim() || !formData.entryDate || !formData.learningType || !formData.tasksPerformed.trim() || !formData.planning.trim() || !formData.nextSteps.trim() || !formData.challenges.trim() || !formData.learning.trim()) {
             setError('Please fill out all required standard fields.');
             setIsSubmitting(false);
             return;
        }

        // Check required custom fields
        const missingRequiredCustomFields = customFields.filter(field =>
            field.isRequired && (
                formData.customFieldsData?.[field.id] === undefined ||
                formData.customFieldsData?.[field.id] === null ||
                (typeof formData.customFieldsData?.[field.id] === 'string' && formData.customFieldsData?.[field.id].trim() === '') ||
                (field.fieldType === 'file' && formData.customFieldsData?.[field.id] === null) // Check for null file for file type
             )
        );
        if (missingRequiredCustomFields.length > 0) {
            const missingNames = missingRequiredCustomFields.map(field => field.fieldName).join(', ');
             setError(`Please fill out all required additional details: ${missingNames}.`);
             setIsSubmitting(false);
             return;
        }
         // Check custom type input if 'Custom' is selected
         if (formData.learningType === 'Custom' && !formData.customLearningTypeText.trim()) {
             setError('Please specify the custom learning type name.');
             setIsSubmitting(false);
             return;
         }


        // --- Prepare Data Payload ---
        // Determine the actual learning type value to send
        const learningTypePayload = formData.learningType === 'Custom'
                                      ? formData.customLearningTypeText.trim()
                                      : formData.learningType;

        // Prepare links array (split by newline)
        const linksPayload = Array.isArray(formData.links) ? formData.links.filter(link => link.trim() !== '') : [];


        // Prepare file attachments metadata (temporary placeholders for main files)
        // We send metadata for files *currently selected* in the form (TempFile objects).
        const fileMetadataPayload: { [key: string]: any } = {};
        if (formData.reportFile) fileMetadataPayload.reportFileMetadata = { filename: formData.reportFile.file.name, size: formData.reportFile.file.size, fileType: formData.reportFile.file.type };
        if (formData.presentationFile) fileMetadataPayload.presentationFileMetadata = { filename: formData.presentationFile.file.name, size: formData.presentationFile.file.size, fileType: formData.presentationFile.file.type };
        if (formData.certificateFile) fileMetadataPayload.certificateFileMetadata = { filename: formData.certificateFile.file.name, size: formData.certificateFile.file.size, fileType: formData.certificateFile.file.type };


        // Prepare custom fields data payload
        const customFieldsDataPayload: { [key: string]: any } = {};
         customFields.forEach(field => {
              const value = formData.customFieldsData?.[field.id];
               // Handle 'file' type custom fields specifically - send metadata or null
              if (field.fieldType === 'file') {
                   if (value && typeof value === 'object' && 'file' in value && value.file instanceof File) { // Check if value is a TempFile object with a File
                       customFieldsDataPayload[field.id] = { filename: value.file.name, size: value.file.size, fileType: value.file.type };
                   } else if (value === null) {
                       customFieldsDataPayload[field.id] = null; // Send null if file was cleared
                   }
                   // If value is already metadata (from initial load in edit mode for *unsaved* file), send it as is
                   else if (value && typeof value === 'object' && 'filename' in value && 'size' in value && 'fileType' in value) {
                       customFieldsDataPayload[field.id] = value; // Send existing metadata
                   }
                   // Otherwise, ignore potentially invalid value for file type field
              }
              else if (value !== undefined) { // Include if value exists
                  // For other types, send the value directly
                   customFieldsDataPayload[field.id] = value;
              }
         });


        // Convert date strings back to Date objects for backend to handle as Timestamp
        const entryDatePayload = new Date(formData.entryDate);
        // submissionDate can be null
        const submissionDatePayload = formData.isSubmitted && formData.submissionDate ? new Date(formData.submissionDate) : null;


        const payload = {
             // Standard fields
             title: formData.title.trim(),
             entryDate: entryDatePayload,
             weekNumber: formData.weekNumber,
             learningType: learningTypePayload, // Use the determined value
             tasksPerformed: formData.tasksPerformed.trim(),
             planning: formData.planning.trim(),
             nextSteps: formData.nextSteps.trim(),
             challenges: formData.challenges.trim(),
             learning: formData.learning.trim(),
             durationHours: formData.durationHours,
             links: linksPayload,
             isSubmitted: formData.isSubmitted,
             submissionDate: submissionDatePayload,

             // File metadata (temporary) - spreads reportFileMetadata, presentationFileMetadata, etc.
             ...fileMetadataPayload,

             // Custom fields data - key is field ID, value is the data (includes metadata for file types)
             customFieldsData: customFieldsDataPayload,
        };

        try {
            const idToken = await currentUser.getIdToken(true);

            console.log("Submitting learning entry payload:", payload);

            // Use the correct API endpoint based on mode (POST for create, PATCH for edit)
            const method = isEditMode ? 'PATCH' : 'POST';
            const apiUrl = isEditMode ? `/api/learning-classrooms/${classroomId}/learning-entries/${entryId}` : `/api/learning-classrooms/${classroomId}/learning-entries`;

            const response = await fetch(apiUrl, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`,
                },
                body: JSON.stringify(payload), // Send the prepared payload
            });

            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({}));
                const apiError = errorBody.message || `Failed to ${isEditMode ? 'update' : 'create'} entry (${response.status})`;
                 // Handle specific forbidden errors if necessary (though parent/API rules should prevent)
                if (response.status === 403) setError("Permission denied. You may not be the owner.");
                else setError(apiError);
                throw new Error(apiError);
            }

            const result = await response.json(); // Expect { message: ..., entryId: ... } for POST, { message: ... } for PATCH
            console.log(`Learning entry ${isEditMode ? 'updated' : 'created'} successfully:`, result);

            // *** TODO: Initiate Actual File Uploads here if there are TempFile objects ***
            // Loop through formData.reportFile, formData.presentationFile, formData.certificateFile,
            // and formData.customFieldsData values if their field type is 'file' and value is TempFile.
            // Upload file.file to Firebase Storage.
            // After all uploads complete, send a *second* PATCH request to the entry's API endpoint
            // to update the reportFileUrl, presentationFileUrl, certificateFileUrl,
            // and the actual file URLs within the customFieldsData map.
            // This process is asynchronous and requires showing upload progress.

            // For now, since we are only saving metadata, we skip the actual upload.

            // Call the onSuccess handler provided by the parent (e.g., to refetch entries)
            // This also closes the modal via handleModalClose in the parent.
            onSuccess();

        } catch (err: any) {
            console.error(`❌ Error ${isEditMode ? 'updating' : 'creating'} learning entry:`, err);
            setError(err.message || `Could not ${isEditMode ? 'update' : 'create'} entry.`);
        } finally {
            setIsSubmitting(false);
        }
    };


    // --- Render ---

    // Show a combined loading state for initial data fetch (entry + custom fields)
    if (isLoadingInitialData) {
        // Use the generic Modal component wrapper
        return (
            <Modal isOpen={true} onClose={onClose} title={isEditMode ? "Loading Entry..." : "Loading Form..."}>
                <div className="flex justify-center items-center py-8">
                    <LoadingSpinner />
                </div>
            </Modal>
        );
    }

     // Show error if initial fetch failed (either entry or custom fields)
     // Only show this specific error state if we failed to load initial data
    if (error && isLoadingInitialData === false) {
         return (
             // Use the generic Modal component wrapper
             <Modal isOpen={true} onClose={onClose} title="Error Loading Form">
                  <div className="py-4">
                     <ErrorMessage message={error || "An unexpected error occurred during loading."} />
                      <p className="mt-4 text-center"><button onClick={onClose} className="text-blue-600 hover:underline">Close</button></p>
                  </div>
             </Modal>
         );
     }


    // Main Modal Content (when essential data is loaded and no fetch error)
    // Use the generic Modal component
    // Modal visibility is controlled by parent's state (showEntryFormModal)
    return (
        <Modal isOpen={true} onClose={onClose} title={isEditMode ? "Edit Learning Entry" : "Create New Learning Entry"}>

            {/* Display Error/Success Messages */}
            {/* Only show error if not loading initial data */}
            {/* Keep error state check here for submission errors */}
            {error && !isLoadingInitialData && <div className="mb-4"><ErrorMessage message={error} /></div>}
            {successMessage && <div className="mb-4"><div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative" role="alert"><strong className="font-bold mr-1">Success:</strong><span>{successMessage}</span></div></div>}


            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">

                {/* Standard Fields */}
                 <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">Entry Title <span className="text-red-500">*</span></label>
                    <input type="text" id="title" name="title" value={formData.title} onChange={handleInputChange} required className="w-full px-3 py-2 border border-gray-300 rounded-md text-black focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50" disabled={isSubmitting} />
                </div>

                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div>
                        <label htmlFor="entryDate" className="block text-sm font-medium text-gray-700 mb-1">Date <span className="text-red-500">*</span></label>
                         {/* Use type="date" for native date picker */}
                        <input type="date" id="entryDate" name="entryDate" value={formData.entryDate} onChange={handleInputChange} required className="w-full px-3 py-2 border border-gray-300 rounded-md text-black focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50" disabled={isSubmitting} />
                     </div>
                     <div>
                        <label htmlFor="weekNumber" className="block text-sm font-medium text-gray-700 mb-1">Week Number (Optional)</label>
                        {/* Use type="number" */}
                        {/* Handle number input value correctly (store as number or undefined, display empty string when undefined) */}
                        <input type="number" id="weekNumber" name="weekNumber" value={formData.weekNumber === undefined ? '' : formData.weekNumber} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md text-black focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50" disabled={isSubmitting} placeholder="e.g., 3" min="1"/>
                     </div>
                 </div>

                 <div>
                     <label htmlFor="learningType" className="block text-sm font-medium text-gray-700 mb-1">Learning Type <span className="text-red-500">*</span></label>
                      {/* Reuse learningTypeOptions */}
                      <select
                          id="learningType"
                          name="learningType"
                          value={formData.learningType}
                          onChange={handleInputChange}
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-black disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={isSubmitting}
                      >
                          {/* Map over learningTypeOptions array of objects */}
                          {learningTypeOptions.map(option => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                      </select>
                       {/* --- Conditional Input for Custom Type --- */}
                       {/* Use formData.learningType === 'Custom' */}
                       {formData.learningType === 'Custom' && (
                           <div className="mt-2">
                               {/* Use formData.customLearningTypeText state */}
                               <label htmlFor="customLearningTypeText" className="sr-only">Custom Type Name</label>
                               <input
                                  type="text"
                                  id="customLearningTypeText"
                                  name="customLearningTypeText"
                                  value={formData.customLearningTypeText}
                                  onChange={handleCustomTypeInputChange} // Use dedicated handler
                                  required={formData.learningType === 'Custom'} // Make required only if custom is selected
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-black disabled:opacity-50 disabled:cursor-not-allowed"
                                  disabled={isSubmitting}
                                  placeholder="Specify custom type (e.g., Design Thinking)"
                               />
                           </div>
                       )}
                 </div>

                 <div>
                    <label htmlFor="tasksPerformed" className="block text-sm font-medium text-gray-700 mb-1">Tasks Performed <span className="text-red-500">*</span></label>
                    <textarea id="tasksPerformed" name="tasksPerformed" value={formData.tasksPerformed} onChange={handleInputChange} required rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-md text-black focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 resize-y" disabled={isSubmitting} />
                </div>
                <div>
                    <label htmlFor="planning" className="block text-sm font-medium text-gray-700 mb-1">Planning <span className="text-red-500">*</span></label>
                    <textarea id="planning" name="planning" value={formData.planning} onChange={handleInputChange} required rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-md text-black focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 resize-y" disabled={isSubmitting} />
                </div>
                 <div>
                    <label htmlFor="nextSteps" className="block text-sm font-medium text-gray-700 mb-1">Next Steps <span className="text-red-500">*</span></label>
                    <textarea id="nextSteps" name="nextSteps" value={formData.nextSteps} onChange={handleInputChange} required rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-md text-black focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 resize-y" disabled={isSubmitting} />
                </div>
                 <div>
                    <label htmlFor="challenges" className="block text-sm font-medium text-gray-700 mb-1">Challenges / Roadblocks <span className="text-red-500">*</span></label>
                    <textarea id="challenges" name="challenges" value={formData.challenges} onChange={handleInputChange} required rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-md text-black focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 resize-y" disabled={isSubmitting} />
                </div>
                 <div>
                    <label htmlFor="learning" className="block text-sm font-medium text-gray-700 mb-1">Key Learning / Takeaways <span className="text-red-500">*</span></label>
                    <textarea id="learning" name="learning" value={formData.learning} onChange={handleInputChange} required rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-md text-black focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 resize-y" disabled={isSubmitting} />
                </div>

                 <div>
                    <label htmlFor="durationHours" className="block text-sm font-medium text-gray-700 mb-1">Duration (Hours, Optional)</label>
                    <input type="number" id="durationHours" name="durationHours" value={formData.durationHours === undefined ? '' : formData.durationHours} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md text-black focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50" disabled={isSubmitting} placeholder="e.g., 5" min="0" step="0.5"/>
                </div>

                 {/* Links Input (Optional) - Textarea, split by newline */}
                <div>
                    <label htmlFor="links" className="block text-sm font-medium text-gray-700 mb-1">Relevant Links (Optional - One per line)</label>
                    <textarea
                         id="links"
                         name="links"
                         value={Array.isArray(formData.links) ? formData.links.join('\n') : ''}
                         onChange={(e) => setFormData(prev => ({ ...prev, links: e.target.value.split('\n').map(link => link.trim()).filter(link => link !== '') }))} // Split by newline, trim, filter empty
                         rows={2}
                         className="w-full px-3 py-2 border border-gray-300 rounded-md text-black focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 resize-y"
                         disabled={isSubmitting}
                         placeholder="Enter links on separate lines"
                     />
                </div>


                {/* --- Main File Uploads (Report, Presentation, Certificate) --- */}
                {/* Using the combined formData state */}
                <div className="pt-4 border-t border-gray-200 space-y-4">
                    <h3 className="text-lg font-semibold text-gray-800">Main Files (Optional)</h3>
                     {/* Report File */}
                     <div>
                         <label className="block text-sm font-medium text-gray-700 mb-1">Report File (PDF, Doc)</label>
                         {/* Display selected file name or input */}
                         {formData.reportFile ? (
                             <div className="flex items-center justify-between bg-gray-100 p-2 rounded-md text-sm">
                                 <span className="truncate">{formData.reportFile.file.name}</span>
                                  <button type="button" onClick={() => handleRemoveMainFile('reportFile')} className="text-gray-500 hover:text-red-600" disabled={isSubmitting}>
                                     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" /></svg>
                                  </button>
                             </div>
                         ) : (
                             // Use htmlFor to link label to the hidden input
                            <label htmlFor="reportFile-input" className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-700 cursor-pointer hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M.965 7.451a.75.75 0 0 1 .831.134l.91.91A6.481 6.481 0 0 0 3.8 6.176V3a1.5 1.5 0 0 1 3 0v.5H8V3a3 3 0 0 0-6 0v3.176l-.176-.176a.75.75 0 0 1-.134-.83ZM10 3.5h.5V3a1.5 1.5 0 0 1 3 0v3.176a6.483 6.483 0 0 0 1.124 2.32l.91-.91a.75.75 0 0 1 1.075.029.75.75 0 0 1-.029 1.075l-1.5 1.5a.75.75 0 0 1-1.06 0l-1.5-1.5a.75.75 0 0 1 .029-1.075.75.75 0 0 1 1.075.029l.176.176V3.5Z" /></svg>
                                <span>Select File</span>
                                {/* Hidden file input, linked by ID */}
                                <input type="file" id="reportFile-input" name="reportFile-input" className="sr-only" onChange={(e) => handleMainFileChange(e, 'reportFile')} disabled={isSubmitting} accept=".pdf,.doc,.docx,.txt"/>
                             </label>
                         )}
                     </div>
                     {/* Presentation File */}
                      <div>
                         <label className="block text-sm font-medium text-gray-700 mb-1">Presentation File (PPT, PDF)</label>
                         {formData.presentationFile ? (
                             <div className="flex items-center justify-between bg-gray-100 p-2 rounded-md text-sm">
                                 <span className="truncate">{formData.presentationFile.file.name}</span>
                                  <button type="button" onClick={() => handleRemoveMainFile('presentationFile')} className="text-gray-500 hover:text-red-600" disabled={isSubmitting}>
                                     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" /></svg>
                                  </button>
                             </div>
                         ) : (
                            <label htmlFor="presentationFile-input" className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-700 cursor-pointer hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M8 1.75a.75.75 0 0 0-1.5 0V2.5h1.5V1.75ZM4 3a.75.75 0 0 0 0 1.5h8A.75.75 0 0 0 12 3H4ZM2.5 6a.5.5 0 0 0 0 1h11a.5.5 0 0 0 0-1h-11Z" clipRule="evenodd" /><path d="M3.02 13.617A2.25 2.25 0 0 0 5.25 15.5h5.5a2.25 2.25 0 0 0 2.23-1.883l1.481-7.406A.75.75 0 0 0 13.75 5H2.25a.75.75 0 0 0-.73 1.211l1.49 7.406ZM11.5 7.5a.5.5 0 0 1 1 0v2.25h2.25a.5.5 0 0 1 0 1H12.5v2.25a.5.5 0 0 1-1 0v-2.25H9.25a.5.5 0 0 1 0-1h2.25V7.5Z" /></svg>
                                <span>Select File</span>
                                <input type="file" id="presentationFile-input" name="presentationFile-input" className="sr-only" onChange={(e) => handleMainFileChange(e, 'presentationFile')} disabled={isSubmitting} accept=".ppt,.pptx,.pdf"/>
                             </label>
                         )}
                     </div>
                      {/* Certificate File */}
                      <div>
                         <label className="block text-sm font-medium text-gray-700 mb-1">Certificate File (PDF, Image)</label>
                         {formData.certificateFile ? (
                             <div className="flex items-center justify-between bg-gray-100 p-2 rounded-md text-sm">
                                 <span className="truncate">{formData.certificateFile.file.name}</span>
                                  <button type="button" onClick={() => handleRemoveMainFile('certificateFile')} className="text-gray-500 hover:text-red-600" disabled={isSubmitting}>
                                     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" /></svg>
                                  </button>
                             </div>
                         ) : (
                            <label htmlFor="certificateFile-input" className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-700 cursor-pointer hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M3 3.75C3 2.784 3.784 2 4.75 2h6.5c.966 0 1.75.784 1.75 1.75v8.5A1.75 1.75 0 0 1 11.25 14h-6.5A1.75 1.75 0 0 1 3 12.25v-8.5ZM4.75 3.5a1.25 1.25 0 0 0-1.25 1.25v8.5c0 .69.56 1.25 1.25 1.25h6.5c.69 0 1.25-.56 1.25-1.25v-8.5a1.25 1.25 0 0 0-1.25-1.25h-6.5ZM8 9a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 8 9Zm-.75-3a.75.75 0 0 0 0 1.5h1.5a.75.75 0 0 0 0-1.5h-1.5Z" clipRule="evenodd" /></svg>
                                <span>Select File</span>
                                <input type="file" id="certificateFile-input" name="certificateFile-input" className="sr-only" onChange={(e) => handleMainFileChange(e, 'certificateFile')} disabled={isSubmitting} accept="image/*,.pdf"/>
                             </label>
                         )}
                     </div>
                     {/* TODO: Add logic for additionalFiles array if general file uploads are needed */}
                 </div>


                {/* --- Custom Fields Section --- */}
                 {/* Only render if custom fields exist and are loaded */}
                {customFields.length > 0 && (
                    <div className="pt-4 border-t border-gray-200 space-y-4">
                        <h3 className="text-lg font-semibold text-gray-800">Additional Details</h3>
                         {/* Map over fetched custom field definitions */}
                         {customFields.map(field => (
                             // *** Render CustomFieldInput for each custom field ***
                             <CustomFieldInput
                                 key={field.id} // Use field ID as key
                                 field={field} // The field definition object
                                 // Pass the corresponding value from customFieldsData state
                                 // Use specific defaults based on field type if value is undefined/null
                                 value={formData.customFieldsData?.[field.id] === undefined || formData.customFieldsData?.[field.id] === null ? (field.fieldType === 'checkbox' ? false : '') : formData.customFieldsData?.[field.id]}
                                 onChange={handleCustomFieldChange} // Pass the specific handler for custom fields
                                 disabled={isSubmitting} // Disable input while submitting
                                  // Note: File type handling requires extra props and logic in CustomFieldInput
                                  // We've added a placeholder implementation in CustomFieldInput
                                  // that expects the value passed here to be a TempFile | null for file types.
                               />
                         ))}
                    </div>
                )}
                {/* Message if custom fields loaded but none defined */}
                 {customFields.length === 0 && !isLoadingInitialData && !error} {/* Check combined loading/error */}
                 {customFields.length === 0 && !isLoadingInitialData && !error && (
                     <div className="pt-4 border-t border-gray-200 text-sm italic text-gray-500">
                         No additional details fields defined for this learning page.
                     </div>
                 )}


                 {/* Submission Status (Optional checkbox) */}
                 {/* Allow student to mark as submitted */}
                 <div className="pt-4 border-t border-gray-200">
                       <div className="flex items-center">
                            <input
                                type="checkbox"
                                id="isSubmitted"
                                name="isSubmitted"
                                checked={formData.isSubmitted}
                                onChange={handleInputChange}
                                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                                disabled={isSubmitting}
                            />
                            <label htmlFor="isSubmitted" className="ml-2 block text-sm text-gray-900 cursor-pointer">
                                Mark as Submitted / Final
                            </label>
                       </div>
                       {/* Display submission date if submitted */}
                       {/* Use formData.submissionDate which is YYYY-MM-DD string */}
                       {formData.isSubmitted && formData.submissionDate && (
                            <p className="mt-1 text-xs text-gray-500 italic">Submitted on: {new Date(formData.submissionDate).toLocaleDateString()}</p>
                       )}
                        {/* Optional: Allow manually setting submission date if needed */}
                        {/* {formData.isSubmitted && (
                             <div className="mt-2">
                                 <label htmlFor="submissionDate" className="block text-sm font-medium text-gray-700 mb-1">Submission Date</label>
                                  <input type="date" id="submissionDate" name="submissionDate" value={formData.submissionDate || ''} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md text-black disabled:opacity-50" disabled={isSubmitting} />
                             </div>
                        )} */}
                 </div>


                {/* Action Buttons */}
                <div className="flex justify-end gap-4 mt-6">
                     {/* Cancel Button */}
                    <button type="button" onClick={onClose} className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus-within:ring-2 focus:ring-offset-2 focus-within:ring-offset-2 focus:ring-gray-400 focus-within:ring-gray-400 transition duration-150 text-sm flex items-center justify-center disabled:opacity-50 disabled:pointer-events-none" disabled={isSubmitting}>
                         Cancel
                    </button>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        className="px-6 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 text-sm font-medium flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed"
                         // Disable if submitting or if required fields are empty (standard & custom)
                         // Note: Full validation check is done in handleSubmit again for safety
                        disabled={isSubmitting || !formData.title.trim() || !formData.entryDate || !formData.learningType || !formData.tasksPerformed.trim() || !formData.planning.trim() || !formData.nextSteps.trim() || !formData.challenges.trim() || !formData.learning.trim() || (formData.learningType === 'Custom' && !formData.customLearningTypeText.trim()) || customFields.some(field => field.isRequired && (formData.customFieldsData?.[field.id] === undefined || formData.customFieldsData?.[field.id] === null || (typeof formData.customFieldsData?.[field.id] === 'string' && formData.customFieldsData?.[field.id].trim() === '') || (field.fieldType === 'file' && formData.customFieldsData?.[field.id] === null)))} // Added custom type check AND required custom fields check
                    >
                        {isSubmitting ? (
                             <svg className="animate-spin h-4 w-4 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                         ) : null}
                        {isSubmitting ? (isEditMode ? 'Saving...' : 'Creating...') : (isEditMode ? 'Save Changes' : 'Create Entry')}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

// --- FIX: Add export default ---
export default LearningEntryFormModal;