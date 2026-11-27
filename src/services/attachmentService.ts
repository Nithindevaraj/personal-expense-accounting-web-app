import { supabase, isSupabaseConfigured } from '../lib/supabase';

const BUCKET_NAME = 'receipts';

/**
 * Upload an attachment (Image File or PDF Blob) to Supabase Storage bucket 'receipts'.
 * Returns public CDN URL if successful, or falls back to local dataUrl if offline/unconfigured.
 */
export async function uploadReceiptAttachment(
  fileOrBlob: Blob | File,
  fileName: string,
  accountId: string = 'default'
): Promise<string> {
  if (!isSupabaseConfigured) {
    return blobToDataUrl(fileOrBlob);
  }

  try {
    const timestamp = Date.now();
    const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${accountId}/${timestamp}_${cleanName}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(path, fileOrBlob, {
        cacheControl: '3600',
        upsert: false,
        contentType: fileOrBlob.type || 'application/octet-stream',
      });

    if (uploadError) {
      console.warn('Supabase storage upload failed, falling back to local dataUrl:', uploadError.message);
      return blobToDataUrl(fileOrBlob);
    }

    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(path);

    return publicUrlData?.publicUrl || (await blobToDataUrl(fileOrBlob));
  } catch (err) {
    console.warn('Storage upload exception, falling back to local dataUrl:', err);
    return blobToDataUrl(fileOrBlob);
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
