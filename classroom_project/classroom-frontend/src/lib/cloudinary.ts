import { CLOUDINARY_CLOUD_NAME } from "@/constants";

// Full-width class banner - plain image, no text overlay (the class name
// already renders directly beneath it, so baking a duplicate label into the
// image itself would say the same thing twice). w_1600 covers up to a
// standard desktop viewport at 1x; dpr_auto covers high-DPR screens above
// that without requesting a needlessly huge asset on every device.
export const buildClassBannerUrl = (publicId: string, width = 1600): string =>
  `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto,c_fill,w_${width},dpr_auto/${publicId}`;

// Built at render time from the stored public_id, never from a stored URL -
// so the crop/format/quality transformation can change later without a
// migration. Face-gravity cropping matters specifically for portraits:
// centre-cropping cuts off heads. `size` is the delivered pixel dimension
// (square); requesting it larger than the display size keeps it sharp on
// high-DPR screens via dpr_auto.
export const buildCloudinaryAvatarUrl = (publicId: string, size = 80): string =>
  `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto,c_fill,g_face,w_${size},h_${size},dpr_auto/${publicId}`;

// Same circular-thumbnail delivery as the avatar helper above, minus
// g_face - a class banner isn't a portrait, so face-detection cropping has
// nothing to find and would just crop arbitrarily.
export const buildClassBannerThumbUrl = (publicId: string, size = 80): string =>
  `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto,c_fill,w_${size},h_${size},dpr_auto/${publicId}`;

// Generated, not uploaded: this is the class detail banner's fallback once
// there's no real uploaded class/subject photo - still a real
// Cloudinary-delivered image (built off the account's own default `sample`
// asset, recoloured to a flat fill via e_colorize), just generated instead
// of stored, so it covers every subject including ones added later without
// needing a batch upload.
//
// The subject name renders as a small caption strip bottom-left (g_south_west
// + a semi-transparent backing bar), not large centred text - a caption sits
// *on* a photo without fighting it, so this same overlay keeps working
// unchanged once the base layer becomes a real photo instead of a flat
// colour fill.
export const buildSubjectBannerUrl = (subjectName: string, hexColor: string, width = 1600, height = 320): string => {
  const text = encodeURIComponent(subjectName);
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/w_${width},h_${height},c_fill,e_colorize:100,co_rgb:${hexColor}/l_text:Arial_32_bold:${text},co_white,b_rgb:00000099,g_south_west,x_24,y_24/sample`;
};

// A real uploaded photo (imageCldPubId, via the upload widget) always wins
// over a seeded placeholder (image - a DiceBear URL for fixture people, see
// lib/seedWorkspace.ts on the backend) - once someone uploads their own
// picture, the generated placeholder should stop showing. Neither present
// means AvatarFallback (initials) renders instead; this returns undefined
// rather than an empty string so `<AvatarImage src={undefined}>` skips
// rendering entirely instead of trying to load a blank URL.
export const buildAvatarSrc = (
  imageCldPubId?: string | null,
  image?: string | null,
): string | undefined => {
  if (imageCldPubId) return buildCloudinaryAvatarUrl(imageCldPubId);
  if (image) return image;
  return undefined;
};
