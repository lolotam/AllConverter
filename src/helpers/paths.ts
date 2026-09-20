// Shared data locations. Kept out of index.tsx so services can use them without
// importing the app entrypoint.
export const uploadsDir = "./data/uploads/";
export const outputDir = "./data/output/";
// Partial (resumable) uploads live here until they are complete
export const incompleteUploadsDir = "./data/uploads-incomplete/";
// Profile pictures, one file per user, named by user id
export const avatarsDir = "./data/avatars/";
