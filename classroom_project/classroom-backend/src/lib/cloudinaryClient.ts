import { v2 as cloudinary } from "cloudinary";

// Signed server-side access (Search/Admin API), separate from the
// frontend's unsigned upload widget - the API secret can only ever live
// here, never in a VITE_-prefixed env var shipped to the browser.
const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

export const isCloudinaryApiConfigured = Boolean(cloudName && apiKey && apiSecret);

if (isCloudinaryApiConfigured) {
    // Non-null: isCloudinaryApiConfigured already verified all three are
    // set, but the boolean check doesn't narrow the outer const bindings
    // for TypeScript here.
    cloudinary.config({
        cloud_name: cloudName!,
        api_key: apiKey!,
        api_secret: apiSecret!,
        secure: true,
    });
}

export { cloudinary };
