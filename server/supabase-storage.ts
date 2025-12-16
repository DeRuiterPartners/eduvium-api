import { createClient } from "@supabase/supabase-js";

/**
 * Helper: Get required environment variable
 */
function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`[SupabaseStorage] Missing required environment variable: ${name}`);
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Lazy initialization of Supabase client
 */
let _supabaseClient: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (_supabaseClient) return _supabaseClient;

  const supabaseUrl = getRequiredEnv("SUPABASE_URL");
  const supabaseServiceKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  console.log("[SupabaseStorage] Initializing Supabase client", {
    url: supabaseUrl,
    hasServiceKey: !!supabaseServiceKey,
  });

  _supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return _supabaseClient;
}

/**
 * Sanitize module name for use in storage paths
 * Converts spaces to hyphens and makes lowercase
 */
export function sanitizeModuleName(module: string): string {
  return module.toLowerCase().replace(/\s+/g, "-");
}

/**
 * Create bucket if it doesn't exist
 */
export async function createBucketIfNotExists(bucketName: string): Promise<void> {
  const supabase = getSupabaseClient();

  try {
    // Check if bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      throw listError;
    }

    const bucketExists = buckets?.some((bucket) => bucket.name === bucketName);

    if (!bucketExists) {
      console.log(`[SupabaseStorage] Creating bucket: ${bucketName}`);
      
      const { error: createError } = await supabase.storage.createBucket(bucketName, {
        public: false, // Private bucket, we'll generate signed URLs
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: null, // Allow all types
      });

      if (createError) {
        throw createError;
      }

      console.log(`[SupabaseStorage] Bucket ${bucketName} created`);
    } else {
      console.log(`[SupabaseStorage] Bucket ${bucketName} already exists`);
    }
  } catch (error) {
    console.error(`[SupabaseStorage] Error creating bucket ${bucketName}:`, error);
    throw new Error(
      `Failed to create Supabase bucket: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * Generate a public URL for a file (or signed URL if bucket is private)
 */
export async function generateFileUrl(
  bucketName: string,
  filePath: string,
  expiresIn: number = 3600
): Promise<string> {
  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      throw error;
    }

    return data.signedUrl;
  } catch (error) {
    console.error(
      `[SupabaseStorage] Error generating URL for ${bucketName}/${filePath}:`,
      error
    );
    throw new Error(
      `Failed to generate file URL: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * Upload file to Supabase Storage
 */
export async function uploadFile(
  bucketName: string,
  module: string,
  filename: string,
  buffer: Buffer,
  contentType?: string
): Promise<string> {
  const supabase = getSupabaseClient();

  try {
    await createBucketIfNotExists(bucketName);

    const sanitizedModule = sanitizeModuleName(module);
    const filePath = `${sanitizedModule}/${filename}`;

    console.log(
      `[SupabaseStorage] Uploading file ${filePath} to bucket ${bucketName}`
    );

    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, buffer, {
        contentType: contentType || "application/octet-stream",
        upsert: false, // Don't overwrite existing files
      });

    if (error) {
      throw error;
    }

    console.log(`[SupabaseStorage] Uploaded ${filePath}`);

    // Generate a signed URL (valid for 1 year)
    const fileUrl = await generateFileUrl(bucketName, filePath, 31536000); // 1 year
    console.log(`[SupabaseStorage] Generated URL for ${filePath}`);
    
    return fileUrl;
  } catch (error) {
    console.error(
      `[SupabaseStorage] Error uploading file to ${bucketName}/${module}/${filename}:`,
      error
    );
    throw new Error(
      `Failed to upload file to Supabase: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * Download file from Supabase Storage
 */
export async function downloadFile(
  bucketName: string,
  module: string,
  filename: string
): Promise<Buffer> {
  const supabase = getSupabaseClient();

  try {
    const sanitizedModule = sanitizeModuleName(module);
    const filePath = `${sanitizedModule}/${filename}`;

    console.log(
      `[SupabaseStorage] Downloading file ${filePath} from bucket ${bucketName}`
    );

    const { data, error } = await supabase.storage
      .from(bucketName)
      .download(filePath);

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error("No data returned from download");
    }

    // Convert Blob to Buffer
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`[SupabaseStorage] Downloaded ${filePath}`);
    return buffer;
  } catch (error) {
    console.error(
      `[SupabaseStorage] Error downloading file from ${bucketName}/${module}/${filename}:`,
      error
    );
    throw new Error(
      `Failed to download file from Supabase: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * Delete file from Supabase Storage
 */
export async function deleteFile(
  bucketName: string,
  module: string,
  filename: string
): Promise<void> {
  const supabase = getSupabaseClient();

  try {
    const sanitizedModule = sanitizeModuleName(module);
    const filePath = `${sanitizedModule}/${filename}`;

    console.log(
      `[SupabaseStorage] Deleting file ${filePath} from bucket ${bucketName}`
    );

    const { error } = await supabase.storage
      .from(bucketName)
      .remove([filePath]);

    if (error) {
      // If file doesn't exist, that's okay
      if (error.message?.includes("not found") || error.message?.includes("does not exist")) {
        console.log(
          `[SupabaseStorage] File not found (already deleted): ${bucketName}/${module}/${filename}`
        );
        return;
      }
      throw error;
    }

    console.log(`[SupabaseStorage] Deleted ${filePath}`);
  } catch (error) {
    console.error(
      `[SupabaseStorage] Error deleting file from ${bucketName}/${module}/${filename}:`,
      error
    );
    throw new Error(
      `Failed to delete file from Supabase: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * Check if a file exists
 */
export async function fileExists(
  bucketName: string,
  module: string,
  filename: string
): Promise<boolean> {
  const supabase = getSupabaseClient();

  try {
    const sanitizedModule = sanitizeModuleName(module);
    const filePath = `${sanitizedModule}/${filename}`;

    const { data, error } = await supabase.storage
      .from(bucketName)
      .list(sanitizedModule, {
        search: filename,
      });

    if (error) {
      console.error("[SupabaseStorage] Error checking file existence:", error);
      return false;
    }

    return data?.some((file) => file.name === filename) ?? false;
  } catch (error) {
    console.error("[SupabaseStorage] Error checking file existence:", error);
    return false;
  }
}

