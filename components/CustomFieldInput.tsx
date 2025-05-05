// components/CustomFieldInput.tsx
"use client"; // Needs to be client component

import React, { useCallback } from 'react'; // Import useCallback
import { CustomLearningField } from '@/lib/types/learning'; // Import the type

// Interface for temporary file info (matching the one used in form modal)
interface TempFile {
    file: File;
    id: string; // Unique ID (like field name or custom field ID)
    previewUrl?: string; // Data URL for image previews
}

// Define limits (should be consistent with form modal)
const MAX_FILE_SIZE_MB = 20; // Example max size per individual file in MB
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024; // Convert to bytes


interface CustomFieldInputProps {
    field: CustomLearningField; // The definition of the custom field
    value: any; // The current value for this field from the form state (could be string, number, boolean, or TempFile for file type)
    onChange: (fieldId: string, value: any) => void; // Handler to update the value in parent state (passes fieldId and the new value)
    disabled: boolean; // Disable input while submitting form
}

const CustomFieldInput: React.FC<CustomFieldInputProps> = ({ field, value, onChange, disabled }) => {
    const inputClasses = "w-full px-3 py-2 border border-gray-300 rounded-md text-black focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed";

    // Determine the input type attribute for HTML inputs
    const htmlInputType = field.fieldType === 'number' ? 'number' :
                          field.fieldType === 'date' ? 'date' :
                          field.fieldType === 'url' ? 'url' :
                          field.fieldType === 'file' ? 'file' : // Note: 'file' type input doesn't use value prop directly
                          field.fieldType === 'checkbox' ? 'checkbox' :
                          'text'; // Default to text

    // Helper to handle number input change, returning number or undefined
    const handleNumberInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>): number | undefined => {
        const numValue = parseFloat(e.target.value);
        // Store undefined if the input is empty or not a valid number
        return isNaN(numValue) || e.target.value.trim() === '' ? undefined : numValue;
    }, []); // No dependencies


    // Handle specific input types
    switch (field.fieldType) {
        case 'textarea':
            return (
                <div>
                    <label htmlFor={`custom-field-${field.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                        {field.fieldName} {field.isRequired && <span className="text-red-500">*</span>}
                    </label>
                    <textarea
                        id={`custom-field-${field.id}`}
                        name={`custom-field-${field.id}`}
                        value={value || ''} // Ensure value is string for textarea
                        onChange={(e) => onChange(field.id, e.target.value)}
                        required={field.isRequired}
                        rows={3} // Default rows for textarea
                        className={`${inputClasses} resize-y`}
                        disabled={disabled}
                    />
                </div>
            );
        case 'select':
             // Ensure options is an array for select type
            const options = Array.isArray(field.options) ? field.options : [];
            return (
                <div>
                    <label htmlFor={`custom-field-${field.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                        {field.fieldName} {field.isRequired && <span className="text-red-500">*</span>}
                    </label>
                    <select
                        id={`custom-field-${field.id}`}
                        name={`custom-field-${field.id}`}
                        value={String(value || '')} // Ensure value is string for select
                        onChange={(e) => onChange(field.id, e.target.value)}
                        required={field.isRequired}
                        className={`${inputClasses} cursor-pointer`}
                        disabled={disabled}
                    >
                        {/* Add a default empty option if not required or if current value is empty */}
                         {(!field.isRequired || String(value || '') === '') && <option value="">Select {field.fieldName}</option>}
                         {options.map(option => (
                             <option key={option} value={option}>{option}</option>
                         ))}
                    </select>
                </div>
            );
        case 'checkbox':
            return (
                 <div className="flex items-center">
                     <input
                         type="checkbox"
                         id={`custom-field-${field.id}`}
                         name={`custom-field-${field.id}`}
                         checked={!!value} // Ensure boolean for checked prop
                         onChange={(e) => onChange(field.id, e.target.checked)} // Pass boolean value
                         required={field.isRequired}
                         className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50 cursor-pointer"
                         disabled={disabled}
                     />
                     <label htmlFor={`custom-field-${field.id}`} className="ml-2 block text-sm text-gray-900 cursor-pointer">
                         {field.fieldName} {field.isRequired && <span className="text-red-500">*</span>}
                     </label>
                 </div>
             );
         case 'file':
             // --- File Input Implementation ---
             // 'value' for a file type field in parent state is expected to be a TempFile | null
             const fileValue = value as TempFile | null; // Cast value for clarity

             return (
                 <div>
                     <label className="block text-sm font-medium text-gray-700 mb-1">
                        {field.fieldName} {field.isRequired && <span className="text-red-500">*</span>}
                         <span className="ml-2 text-xs text-gray-500 font-normal">(Max {MAX_FILE_SIZE_MB}MB)</span> {/* Add size hint */}
                     </label>
                     {fileValue ? (
                          // Display selected file name and remove button if a file is selected (value is TempFile)
                         <div className="flex items-center justify-between bg-gray-100 p-2 rounded-md text-sm">
                             {/* Optional: Image preview if fileValue has previewUrl */}
                              {fileValue.previewUrl ? (
                                  <img src={fileValue.previewUrl} alt="Preview" className="w-6 h-6 object-cover rounded mr-2 flex-shrink-0"/>
                              ) : (
                                  // Generic file icon placeholder
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 mr-2 text-gray-500 flex-shrink-0"><path fillRule="evenodd" d="M8.5 2.25a.75.75 0 0 0-1.5 0v8.69L5.03 9.22a.75.75 0 1 0-1.06 1.06l3.5 3.5a.75.75 0 0 0 1.06 0l3.5-3.5a.75.75 0 1 0-1.06-1.06L8.5 10.94V2.25Z" clipRule="evenodd" /></svg>
                              )}
                              <span className="truncate flex-grow">{fileValue.file.name}</span>
                              {/* Remove button calls onChange with null value */}
                              <button type="button" onClick={() => onChange(field.id, null)} className="text-gray-500 hover:text-red-600" disabled={disabled}>
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" /></svg>
                               </button>
                          </div>
                     ) : (
                         // Display file input label if no file is selected (value is null)
                        <label htmlFor={`custom-field-${field.id}-file`} className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-700 cursor-pointer hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M11.5 7.5a.5.5 0 0 1 1 0v2.25h2.25a.5.5 0 0 1 0 1H12.5v2.25a.5.5 0 0 1-1 0v-2.25H9.25a.5.5 0 0 1 0-1h2.25V7.5Z" /><path d="M3.02 13.617A2.25 2.25 0 0 0 5.25 15.5h5.5a2.25 2.25 0 0 0 2.23-1.883l1.481-7.406A.75.75 0 0 0 13.75 5H2.25a.75.75 0 0 0-.73 1.211l1.49 7.406ZM11.5 7.5a.5.5 0 0 1 1 0v2.25h2.25a.5.5 0 0 1 0 1H12.5v2.25a.5.5 0 0 1-1 0v-2.25H9.25a.5.5 0 0 1 0-1h2.25V7.5Z" /></svg>
                             <span>Select File</span>
                              {/* Hidden file input */}
                             <input
                                 type="file"
                                 id={`custom-field-${field.id}-file`} // Unique ID for the input
                                 name={`custom-field-${field.id}-file`}
                                 className="sr-only"
                                  // Handle file selection change
                                 onChange={(e) => {
                                      const selectedFile = e.target.files?.[0] || null;
                                       // Clear input value immediately to allow selecting the same file again
                                      if (e.target) e.target.value = '';

                                      if (!selectedFile) {
                                          // If cleared, update state to null via parent handler
                                          onChange(field.id, null);
                                          return;
                                      }

                                       // Validate size
                                      if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
                                           console.error(`File "${selectedFile.name}" exceeds ${MAX_FILE_SIZE_MB}MB.`);
                                           alert(`File "${selectedFile.name}" exceeds the maximum size of ${MAX_FILE_SIZE_MB}MB.`); // Simple alert
                                            // Update state to null for this field
                                           onChange(field.id, null);
                                          return;
                                      }
                                      // TODO: Check total file count across all file inputs

                                      // Create TempFile object and update state via parent handler
                                      const newTempFile: TempFile = { file: selectedFile, id: field.id }; // Use field ID as TempFile ID

                                       // Generate preview if image
                                      if (selectedFile.type.startsWith("image/")) {
                                           const reader = new FileReader();
                                           reader.onloadend = () => {
                                               if (typeof reader.result === 'string') {
                                                   onChange(field.id, { ...newTempFile, previewUrl: reader.result }); // Update state with preview
                                               } else {
                                                    onChange(field.id, newTempFile); // Update state without preview
                                               }
                                           };
                                           reader.onerror = () => {
                                               console.error("Error reading file:", selectedFile.name);
                                                onChange(field.id, newTempFile); // Save without preview on error
                                           };
                                           reader.readAsDataURL(selectedFile);
                                      } else {
                                          // For non-image files, update state directly
                                           onChange(field.id, newTempFile);
                                      }
                                  }}
                                 disabled={disabled}
                                 accept={ALLOWED_FILE_TYPES} // Use defined accepted types
                             />
                         </label>
                     )}
                 </div>
             );
        default: // text, number, date, url - use standard input
            return (
                <div>
                    <label htmlFor={`custom-field-${field.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                        {field.fieldName} {field.isRequired && <span className="text-red-500">*</span>}
                    </label>
                    <input
                        type={htmlInputType} // Use the determined HTML input type
                        id={`custom-field-${field.id}`}
                        name={`custom-field-${field.id}`}
                         // Ensure value is correct type (string for text/url/date, number for number)
                         // Use String(value || '') for text-like inputs to handle undefined/null gracefully
                         // For number input, value='' is needed for placeholder when empty
                         // For checkbox, value is boolean
                        value={fieldType === 'number' ? (value === undefined || value === null ? '' : value) : (value === undefined || value === null ? '' : String(value))}
                        onChange={(e) => {
                            let newValue: any = e.target.value;
                             if (fieldType === 'number') {
                                // Use the helper for number input change
                                newValue = handleNumberInputChange(e);
                            }
                             // Date input value is YYYY-MM-DD string
                             // Checkbox value is boolean handled by type="checkbox" case in parent
                            onChange(field.id, newValue); // Call the parent handler with field ID and new value
                        }}
                        required={field.isRequired}
                        className={`${inputClasses}`}
                        disabled={disabled}
                         // Add step="any" for number inputs if decimals are allowed
                         {...(fieldType === 'number' ? { step: 'any' } : {})}
                    />
                </div>
            );
    }
};

// --- FIX: Add export default ---
export default CustomFieldInput;